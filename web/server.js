
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const express = require('express');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3030;
const RTMP_PORT = 1935;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Configuration
const BIN_DIR = path.resolve(__dirname, '../bin');
const FFMPEG_PATH = path.join(BIN_DIR, 'ffmpeg.exe');
const FFPROBE_PATH = path.join(BIN_DIR, 'ffprobe.exe');

console.log(`[Config] FFmpeg: ${FFMPEG_PATH}`);
console.log(`[Config] FFprobe: ${FFPROBE_PATH}`);

// Media Directory
const MEDIA_ROOT = path.join(__dirname, 'public', 'hls');
if (!fs.existsSync(MEDIA_ROOT)) {
    fs.mkdirSync(MEDIA_ROOT, { recursive: true });
}

// Track active processes
const activeTranscodes = new Map();

// Helper to run ffprobe
function getStreamMetadata(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            url
        ];
        
        const proc = spawn(FFPROBE_PATH, args);
        let stdout = '';
        
        proc.stdout.on('data', (data) => stdout += data);
        
        proc.on('close', (code) => {
            if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}`));
            try {
                resolve(JSON.parse(stdout));
            } catch (e) {
                reject(e);
            }
        });
        
        proc.on('error', reject);
    });
}

app.prepare().then(() => {
    const server = express();

    // Enable CORS
    server.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    // Serve HLS files with correct headers
    server.use('/hls', express.static(MEDIA_ROOT, {
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

    // API Endpoint for Active Streams
    server.get('/api/streams', (req, res) => {
        const streams = [];
        activeTranscodes.forEach((data, id) => {
            streams.push({
                id: id,
                appName: data.appName,
                streamName: data.streamName,
                inputCodec: data.inputCodec,
                variants: data.variants || []
            });
        });
        res.json(streams);
    });

    // Handle all other requests with Next.js
    server.all(/^\/(.*)/, (req, res) => {
        return handle(req, res);
    });

    // Start HTTP Server
    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });

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
            port: 8000,
            allow_origin: '*',
            mediaroot: MEDIA_ROOT
        }
    };

    const nms = new NodeMediaServer(nmsConfig);

    nms.on('postPublish', async (id, StreamPath, args) => {
        let sessionID = id;
        let streamPath = StreamPath;
        if (typeof id === 'object') {
            sessionID = id.id;
            streamPath = StreamPath || id.publishStreamPath || id.streamPath;
        }

        if (!streamPath) return;
        console.log(`[RTMP] Stream started: ${streamPath} (ID: ${sessionID})`);
        
        const appName = streamPath.split('/')[1];
        const streamName = streamPath.split('/')[2];
        const validRtmpUrl = `rtmp://localhost:${RTMP_PORT}${streamPath}`;
        
        const outputDir = path.join(MEDIA_ROOT, appName);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        try {
            const metadata = await getStreamMetadata(validRtmpUrl);
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            
            if (!videoStream) {
                console.error('[Error] No video stream found');
                return;
            }

            const inputCodec = videoStream.codec_name;
            const width = videoStream.width;
            const height = videoStream.height;
            console.log(`[FFmpeg] Input: ${inputCodec} ${width}x${height}`);

            // Construct FFmpeg args
            const ffmpegArgs = [];
            
            // Input Options
            ffmpegArgs.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda');
            ffmpegArgs.push('-i', validRtmpUrl);

            // Output 1: Source Copy
            ffmpegArgs.push('-c:v', 'copy');
            ffmpegArgs.push('-c:a', 'copy');
            ffmpegArgs.push('-f', 'hls');
            ffmpegArgs.push('-hls_time', '4');
            ffmpegArgs.push('-hls_list_size', '10');
            ffmpegArgs.push('-hls_flags', 'delete_segments');
            
            if (inputCodec === 'av1') {
                ffmpegArgs.push('-hls_segment_type', 'fmp4');
                ffmpegArgs.push('-hls_fmp4_init_filename', path.join(outputDir, `${streamName}_src_init.mp4`));
                ffmpegArgs.push('-hls_segment_filename', path.join(outputDir, `${streamName}_src_%03d.m4s`));
            } else {
                ffmpegArgs.push('-hls_segment_filename', path.join(outputDir, `${streamName}_src_%03d.ts`));
            }
            ffmpegArgs.push(path.join(outputDir, `${streamName}_src.m3u8`));

            const variants = [];
            const addVariant = (targetCodec, targetHeight, bitrate) => {
                 if (height < targetHeight) return;

                 let codecName, scaleFilter;
                 
                 if (targetCodec === 'h264') {
                     codecName = 'h264_nvenc';
                     scaleFilter = `scale_cuda=-1:${targetHeight}`;
                 } else if (targetCodec === 'hevc') {
                     codecName = 'hevc_nvenc';
                     scaleFilter = `scale_cuda=-1:${targetHeight}`;
                 } else if (targetCodec === 'av1') {
                     codecName = 'av1_nvenc';
                     scaleFilter = `scale_cuda=-1:${targetHeight}`;
                 }

                 const variantName = `${streamName}_${targetCodec}_${targetHeight}p`;
                 variants.push({ codec: targetCodec, height: targetHeight, name: variantName });

                 // Variant Output Options
                 ffmpegArgs.push('-c:v', codecName);
                 ffmpegArgs.push('-preset', 'p4');
                 ffmpegArgs.push('-b:v', bitrate);
                 ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
                 ffmpegArgs.push('-vf', scaleFilter);
                 ffmpegArgs.push('-f', 'hls');
                 ffmpegArgs.push('-hls_time', '4');
                 ffmpegArgs.push('-hls_list_size', '10');
                 ffmpegArgs.push('-hls_flags', 'delete_segments');
                 
                 if (targetCodec === 'av1') {
                      ffmpegArgs.push('-hls_segment_type', 'fmp4');
                      ffmpegArgs.push('-hls_fmp4_init_filename', path.join(outputDir, `${variantName}_init.mp4`));
                      ffmpegArgs.push('-hls_segment_filename', path.join(outputDir, `${variantName}_%03d.m4s`));
                 } else {
                      ffmpegArgs.push('-hls_segment_filename', path.join(outputDir, `${variantName}_%03d.ts`));
                 }
                 ffmpegArgs.push(path.join(outputDir, `${variantName}.m3u8`));
            };

            // Dynamic Variants Logic
            if (inputCodec === 'h264') {
                addVariant('h264', 2160, '12000k');
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
            }

            console.log(`[FFmpeg] Spawning process`);
            const cmd = spawn(FFMPEG_PATH, ffmpegArgs);

            cmd.stdout.on('data', d => {}); // consume stdout
            cmd.stderr.on('data', d => {
                 // console.error(`[FFmpeg Log] ${d}`); // Optional: enable for debugging
            });

            cmd.on('close', (code) => {
                console.log(`[FFmpeg] Process exited with code ${code}`);
            });

            activeTranscodes.set(sessionID, { cmd, streamPath, appName, streamName, inputCodec, variants });

        } catch (err) {
            console.error('[Error] FFprobe/FFmpeg failed:', err);
        }
    });

    nms.on('donePublish', (id, StreamPath, args) => {
        let sessionID = id;
        let streamPath = StreamPath;
        if (typeof id === 'object') {
            sessionID = id.id;
            streamPath = StreamPath || id.publishStreamPath || id.streamPath;
        }

        if (activeTranscodes.has(sessionID)) {
            const { cmd } = activeTranscodes.get(sessionID);
            console.log(`[FFmpeg] Killing process for ${streamPath}`);
            cmd.kill('SIGKILL');
            activeTranscodes.delete(sessionID);
        }
    });

    nms.run();
});
