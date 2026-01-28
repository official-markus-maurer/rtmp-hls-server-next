const NodeMediaServer = require('node-media-server');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

// --- Configuration ---
const HTTP_PORT = 8080;
const RTMP_PORT = 1935;
const FFMPEG_PATH = path.resolve(__dirname, '../bin/ffmpeg.exe');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Set FFmpeg path
if (fs.existsSync(FFMPEG_PATH)) {
    ffmpeg.setFfmpegPath(FFMPEG_PATH);
    console.log(`[Config] Using FFmpeg at: ${FFMPEG_PATH}`);
} else {
    console.error(`[Config] FFmpeg not found at ${FFMPEG_PATH}. Please ensure it is installed.`);
    process.exit(1);
}

// --- Node Media Server (RTMP) ---
const nmsConfig = {
    rtmp: {
        port: RTMP_PORT,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        port: 8000, // Internal NMS HTTP port (we use Express for main serving)
        allow_origin: '*',
        mediaroot: PUBLIC_DIR
    }
};

const nms = new NodeMediaServer(nmsConfig);

// Track active FFmpeg processes: { sessionId: { cmd, streamPath, appName, streamName } }
    const activeTranscodes = new Map();

// Helper to create HLS output options
const getHlsOptions = (streamPath, streamName, codec, preset = 'p4') => {
    // codec: 'libx264' (software), 'h264_nvenc', 'hevc_nvenc', 'av1_nvenc'
    
    // We will output to a specific directory for this stream
    const outputDir = path.join(PUBLIC_DIR, streamPath, streamName);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Base HLS flags
    const hlsFlags = [
        '-hls_time 4',
        '-hls_list_size 10',
        '-hls_flags delete_segments+append_list',
        '-f hls'
    ];

    // Hardware acceleration args
    const inputArgs = ['-hwaccel cuda', '-hwaccel_output_format cuda'];
    
    // Construct the command
    // Note: To keep it simple and reliable first, we will do a single quality stream + copy
    // Scaling in NVENC requires specific filters (scale_npp or scale_cuda).
    // For now, let's implement the "Source" (copy) and one Transcoded version to prove it works.
    // Complex multi-variant playlists in one command can be tricky with fluent-ffmpeg.
    
    // User requested: "in addition to the nvenc h264 add proper h265 and av1 nvenc versions"
    // We will produce:
    // 1. _src.m3u8 (Copy)
    // 2. _transcoded.m3u8 (Transcoded with requested codec)
    
    return { outputDir, inputArgs };
};

nms.on('postPublish', (id, StreamPath, args) => {
    console.log('[DEBUG] postPublish fired');
    
    let sessionID = id;
    let streamPath = StreamPath;
    
    // Debug Object Structure if path is missing
    if (typeof id === 'object') {
        sessionID = id.id;
        // Try to find path in various properties
        streamPath = StreamPath || id.publishStreamPath || id.streamPath;
        
        if (!streamPath && id.connectCmdObj) {
            // Fallback: Construct path from connectCmdObj
            // connectCmdObj usually has { app: 'live', type: 'non-private', flashVer: '...', tcUrl: '...' }
            // But stream name might be separate.
            // In NMS, publishStreamPath is usually set.
            console.log('[DEBUG] Session Keys:', Object.keys(id));
            console.log('[DEBUG] ConnectCmdObj:', JSON.stringify(id.connectCmdObj));
        }
    }

    if (!streamPath) {
        console.error('[Error] StreamPath is undefined. Waiting for metadata...');
        // Sometimes metadata arrives slightly later? 
        // But postPublish should have it.
        return;
    }

    console.log(`[RTMP] Stream started: ${streamPath} (ID: ${sessionID})`);
    
    const appName = streamPath.split('/')[1];
    const streamName = streamPath.split('/')[2];
    
    // Determine transcoding profile based on App Name
    // NEW: We now output ALL codecs regardless of app name, but we can default to 'live'
    // For simplicity, we treat any app name as valid for Multi-Codec Transcoding.
    
    // Note: We need to use `rtmpUrl` which is `rtmp://localhost...`
    // However, if the stream path was derived from fallback, we must ensure rtmpUrl is correct.
    const validRtmpUrl = `rtmp://localhost:${RTMP_PORT}${streamPath}`;
    
    // Ensure output directory exists (path.join was causing issues if appName was undefined)
    if (!appName || !streamName) {
        console.error('[Error] Invalid App or Stream Name. Path:', streamPath);
        return;
    }
    
    const outputDir = path.join(PUBLIC_DIR, appName);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Multi-Codec Transcoding Command
    // We will probe the stream first to determine codec and resolution
    
    ffmpeg.ffprobe(validRtmpUrl, (err, metadata) => {
        if (err) {
            console.error('[Error] FFprobe failed:', err);
            return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
            console.error('[Error] No video stream found');
            return;
        }

        const inputCodec = videoStream.codec_name; // h264, hevc, av1
        const width = videoStream.width;
        const height = videoStream.height;
        
        console.log(`[FFmpeg] Input: ${inputCodec} ${width}x${height}`);

        const cmd = ffmpeg(validRtmpUrl)
            .inputOptions(['-hwaccel cuda', '-hwaccel_output_format cuda']);
            
        // --- 1. Source Copy (Always) ---
        // Determine segment type based on input codec
        const sourceOutputOptions = [
            '-c:v copy',
            '-c:a copy',
            '-f hls',
            '-hls_time 4',
            '-hls_list_size 10',
            '-hls_flags delete_segments'
        ];

        if (inputCodec === 'av1') {
            sourceOutputOptions.push('-hls_segment_type fmp4');
            sourceOutputOptions.push(`-hls_fmp4_init_filename ${path.join(outputDir, `${streamName}_src_init.mp4`)}`);
            sourceOutputOptions.push(`-hls_segment_filename ${path.join(outputDir, `${streamName}_src_%03d.m4s`)}`);
        } else {
            sourceOutputOptions.push(`-hls_segment_filename ${path.join(outputDir, `${streamName}_src_%03d.ts`)}`);
        }

        cmd.output(path.join(outputDir, `${streamName}_src.m3u8`))
           .outputOptions(sourceOutputOptions);

        const variants = []; // To track what we generated

        // Helper to add variant
        const addVariant = (targetCodec, targetHeight, bitrate) => {
             // Don't upscale
             if (height < targetHeight) return;

             let codecName, scaleFilter, segmentExt, segmentTypeOpts;
             
             if (targetCodec === 'h264') {
                 codecName = 'h264_nvenc';
                 scaleFilter = `scale_cuda=-1:${targetHeight}`; // Maintain aspect ratio
                 segmentExt = 'ts';
                 segmentTypeOpts = [];
             } else if (targetCodec === 'hevc') {
                 codecName = 'hevc_nvenc';
                 scaleFilter = `scale_cuda=-1:${targetHeight}`;
                 segmentExt = 'ts';
                 segmentTypeOpts = [];
             } else if (targetCodec === 'av1') {
                 codecName = 'av1_nvenc';
                 scaleFilter = `scale_cuda=-1:${targetHeight}`;
                 segmentExt = 'm4s';
                 segmentTypeOpts = [
                     '-hls_segment_type fmp4',
                     `-hls_fmp4_init_filename ${path.join(outputDir, `${streamName}_${targetCodec}_${targetHeight}p_init.mp4`)}`
                 ];
             }

             const variantName = `${streamName}_${targetCodec}_${targetHeight}p`;
             variants.push({ codec: targetCodec, height: targetHeight, name: variantName });

             cmd.output(path.join(outputDir, `${variantName}.m3u8`))
                .outputOptions([
                    `-c:v ${codecName}`, 
                    '-preset p4', 
                    `-b:v ${bitrate}`, 
                    '-c:a aac', '-b:a 128k',
                    `-vf ${scaleFilter}`, 
                    '-f hls', '-hls_time 4', '-hls_list_size 10', '-hls_flags delete_segments',
                    ...segmentTypeOpts,
                    `-hls_segment_filename ${path.join(outputDir, `${variantName}_%03d.${segmentExt}`)}`
                ]);
        };

        // Determine which variants to generate based on input codec
        if (inputCodec === 'h264') {
            addVariant('h264', 2160, '12000k'); // 4K
            addVariant('h264', 1080, '4500k');
            addVariant('h264', 720, '2048k');
        } else if (inputCodec === 'hevc') {
            addVariant('hevc', 2160, '8000k');
            addVariant('hevc', 1080, '3000k');
            addVariant('hevc', 720, '1500k');
        } else if (inputCodec === 'av1') {
            addVariant('av1', 2160, '6000k');
            addVariant('av1', 1080, '2500k');
            addVariant('av1', 720, '1200k');
        } else {
            console.warn(`[FFmpeg] Unsupported input codec: ${inputCodec}. Only doing copy.`);
        }

        cmd.on('start', (commandLine) => {
            console.log(`[FFmpeg] Started for ${streamPath}`);
            console.log(`[FFmpeg] Command: ${commandLine}`);
        });

        cmd.on('error', (err) => {
            console.error(`[FFmpeg] Error for ${streamPath}: ${err.message}`);
        });

        cmd.on('end', () => {
            console.log(`[FFmpeg] Ended for ${streamPath}`);
        });

        cmd.run();
        
        // Store variants for UI
        activeTranscodes.set(sessionID, { cmd, streamPath, appName, streamName, inputCodec, variants });
    });
});

nms.on('donePublish', (id, StreamPath, args) => {
    let sessionID = id;
    let streamPath = StreamPath;
    
    if (typeof id === 'object') {
        sessionID = id.id;
        streamPath = id.publishStreamPath;
    }

    console.log(`[RTMP] Stream stopped: ${streamPath} (ID: ${sessionID})`);
    if (activeTranscodes.has(sessionID)) {
        console.log(`[FFmpeg] Killing process for ${streamPath}`);
        const { cmd } = activeTranscodes.get(sessionID);
        cmd.kill('SIGKILL');
        activeTranscodes.delete(sessionID);
    }
});

nms.run();

// --- Express Server (Web Interface) ---
const app = express();

// Enable CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Serve HLS files
    app.use('/hls', express.static(PUBLIC_DIR, {
        setHeaders: (res, path, stat) => {
            if (path.endsWith('.m3u8')) {
                res.set('Content-Type', 'application/vnd.apple.mpegurl');
            } else if (path.endsWith('.ts')) {
                res.set('Content-Type', 'video/mp2t');
            } else if (path.endsWith('.m4s')) {
                res.set('Content-Type', 'video/iso.segment');
            } else if (path.endsWith('.mp4')) {
                res.set('Content-Type', 'video/mp4');
            }
        }
    }));
    
    // Serve Player Page
    app.get('/watch/:streamName', (req, res) => {
        const streamName = req.params.streamName;
        const appName = req.query.app || 'live'; 
        
        // Find session data to get variants
        let variants = [];
        let inputCodec = 'h264';
        
        for (const [id, data] of activeTranscodes.entries()) {
            if (data.streamName === streamName && data.appName === appName) {
                variants = data.variants || [];
                inputCodec = data.inputCodec || 'h264';
                break;
            }
        }
        
        const buttonHtml = variants.map(v => {
            const label = v.height >= 2160 ? '4K' : `${v.height}p`;
            const func = `loadSource('${v.codec}_${v.height}p')`;
            const id = `btn-${v.codec}_${v.height}p`;
            return `<button onclick="${func}" id="${id}">${label}</button>`;
        }).join('\n');

        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Watching ${streamName}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.ui.min.js"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/controls.min.css">
            <style>
                body { background: #000; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .player-container { width: 80%; max-width: 1000px; box-shadow: 0 0 20px rgba(255,255,255,0.1); }
                video { width: 100%; height: 100%; }
                .controls { margin-top: 20px; }
                button { background: #333; color: white; border: 1px solid #555; padding: 10px 20px; cursor: pointer; margin: 0 5px; }
                button:hover { background: #444; }
                button.active { background: #6c5ce7; border-color: #6c5ce7; }
                .codec-group { margin-bottom: 15px; }
                .codec-label { font-weight: bold; margin-right: 10px; width: 60px; display: inline-block; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <h2>${streamName} <span style="font-size: 0.6em; color: #888;">(${inputCodec.toUpperCase()})</span></h2>
            
            <div class="player-container" data-shaka-player-container>
                <video id="video" autoplay data-shaka-player></video>
            </div>
            
            <div class="controls">
                <div class="codec-group">
                    <span class="codec-label">Src:</span>
                    <button onclick="loadSource('src')" id="btn-src">Source (Max)</button>
                </div>
                
                <div class="codec-group">
                    <span class="codec-label">${inputCodec}:</span>
                    ${buttonHtml}
                </div>
            </div>

            <script>
                let player;

                async function init() {
                    const video = document.getElementById('video');
                    const ui = video['ui'];
                    const controls = ui.getControls();
                    player = controls.getPlayer();
                    
                    // Listen for error events.
                    player.addEventListener('error', onErrorEvent);
                    
                    // Initial load
                    loadSource('src');
                }

                async function loadSource(variant) {
                    var url = '/hls/${appName}/${streamName}_' + variant + '.m3u8';
                    
                    // Update buttons
                    document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    var btn = document.getElementById('btn-' + variant);
                    if (btn) btn.classList.add('active');

                    try {
                        await player.load(url);
                        console.log('The video has now been loaded!');
                    } catch (e) {
                        onError(e);
                    }
                }

                function onErrorEvent(event) {
                    // Extract the shaka.util.Error object from the event.
                    onError(event.detail);
                }

                function onError(error) {
                    console.error('Error code', error.code, 'object', error);
                }

                document.addEventListener('shaka-ui-loaded', init);
            </script>
        </body>
        </html>
        `);
    });

    // Stats Page
app.get('/', (req, res) => {
    // Fetch sessions from NMS
    const sessions = nms.sessions;
    const host = req.get('host'); // e.g., localhost:8080
    const rtmpHost = host.split(':')[0]; // localhost

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Streaming Server</title>
        <style>
            :root {
                --primary: #6c5ce7;
                --bg: #1e1e2e;
                --card-bg: #2b2b3b;
                --text: #cdd6f4;
                --text-muted: #a6adc8;
                --border: #45475a;
                --success: #a6e3a1;
                --danger: #f38ba8;
                --warning: #f9e2af;
            }
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 0; margin: 0; background: var(--bg); color: var(--text); }
            .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
            h1, h2, h3 { color: var(--text); }
            h1 { text-align: center; margin-bottom: 40px; font-weight: 800; }
            
            .section-title { font-size: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px; margin-top: 40px; }
            
            .card { background: var(--card-bg); padding: 25px; margin-bottom: 20px; border-radius: 12px; border: 1px solid var(--border); }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            
            .info-row { margin-bottom: 15px; }
            .label { display: block; font-size: 0.9em; color: var(--text-muted); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
            .value-box { 
                background: #181825; 
                padding: 12px; 
                border-radius: 6px; 
                font-family: 'Consolas', monospace; 
                color: var(--success);
                border: 1px solid var(--border);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .value-box code { font-size: 1.1em; }
            .copy-btn {
                background: var(--primary);
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8em;
                transition: opacity 0.2s;
            }
            .copy-btn:hover { opacity: 0.9; }
            
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; color: #1e1e2e; font-weight: bold; font-size: 0.8em; }
            .badge.h264 { background: #89b4fa; }
            .badge.h265 { background: #a6e3a1; }
            .badge.av1 { background: #f38ba8; }
            
            input { width: 100%; background: #181825; border: 1px solid var(--border); color: var(--text); padding: 10px; border-radius: 6px; box-sizing: border-box; }
            
            .empty-state { text-align: center; padding: 40px; color: var(--text-muted); font-style: italic; background: var(--card-bg); border-radius: 12px; }
            
            .helper-text { font-size: 0.9em; color: var(--text-muted); margin-top: 5px; }
        </style>
        <script>
            function copyToClipboard(text, btn) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = btn.innerText;
                    btn.innerText = 'Copied!';
                    setTimeout(() => btn.innerText = originalText, 2000);
                });
            }
        </script>
    </head>
    <body>
        <div class="container">
            <h1>My Streaming Server</h1>

            <h2 class="section-title">📡 Stream Setup</h2>
            <p style="color: var(--text-muted); margin-bottom: 20px;">Use the Universal Ingest below. The server automatically generates H.264, H.265, and AV1 variants for all streams.</p>
            
            <div class="card">
                <h3>Universal Ingest</h3>
                <div class="info-row">
                    <span class="label">Server URL</span>
                    <div class="value-box">
                        <code>rtmp://${rtmpHost}:${RTMP_PORT}/live</code>
                        <button class="copy-btn" onclick="copyToClipboard('rtmp://${rtmpHost}:${RTMP_PORT}/live', this)">Copy</button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="label">Stream Key</span>
                    <div class="value-box">
                        <code>(any_name)</code>
                    </div>
                    <div class="helper-text">e.g. <code>ryuu</code>, <code>test1</code></div>
                </div>
                <div class="info-row">
                    <span class="label">Output Formats</span>
                    <div class="value-box" style="color: var(--text);">
                        Source (4K/1080p) + Transcoded 4K/1080p/720p (H.264, HEVC, AV1)
                    </div>
                </div>
            </div>

            <h2 class="section-title">🔴 Active Streams</h2>
    `;

    // We can access nms.sessions to get active streams
    // nms.sessions is a Map of ID -> Session
    
    if (activeTranscodes.size === 0) {
        html += `<div class="empty-state">No streams are currently active. Start streaming to see them here.</div>`;
    } else {
        // Iterate over active transcodes to find active streams
        activeTranscodes.forEach((data, id) => {
            const { streamPath, appName, streamName } = data;
            
            let type = 'H.264';
            let color = 'h264';
            // let variant = 'h264'; // Unused
            
            // We now support ALL variants, so type display is generic or multi
            
            const srcLink = `http://${host}/hls/${appName}/${streamName}_src.m3u8`;
            const watchLink = `http://${host}/watch/${streamName}?app=${appName}`;

            html += `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0;">${streamName}</h2>
                    <div>
                        <span class="badge h264">H.264</span>
                        <span class="badge h265">H.265</span>
                        <span class="badge av1">AV1</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <a href="${watchLink}" target="_blank" style="background: var(--primary); color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: bold;">▶ Watch Stream</a>
                </div>
                
                <div class="info-row">
                    <span class="label">Source Playback (Copy)</span>
                    <div class="value-box">
                        <code style="word-break: break-all;">${srcLink}</code>
                        <button class="copy-btn" onclick="copyToClipboard('${srcLink}', this)">Copy</button>
                    </div>
                </div>
                
                <div class="info-row">
                    <span class="label">Transcoded Playlists (1080p/720p)</span>
                    <div style="color: var(--text-muted); font-size: 0.9em;">
                        Available in the Watch player.
                    </div>
                </div>
            </div>
            `;
        });
    }

    html += `
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
});

app.listen(HTTP_PORT, () => {
    console.log(`[Web] Stats & HLS server running on http://localhost:${HTTP_PORT}`);
});
