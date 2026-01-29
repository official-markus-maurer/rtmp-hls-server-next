
'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings, Share2, MoreVertical, Heart, UserPlus, MessageSquare, Clock, Activity } from 'lucide-react';

import { MediaPlayer, MediaProvider, useMediaState, useMediaPlayer } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface StreamVariant {
  codec: string;
  height: number;
  name: string;
}

interface Stream {
  id: string;
  appName: string;
  streamName: string;
  inputCodec: string;
  variants: StreamVariant[];
  viewers: number;
  startTime: number;
  avatar: string | null;
}

export default function WatchPage({ params }: { params: Promise<{ streamName: string }> }) {
  const unwrappedParams = use(params);
  const streamName = unwrappedParams.streamName;
  const searchParams = useSearchParams();
  const appName = searchParams.get('app') || 'live';

  const [streamInfo, setStreamInfo] = useState<Stream | null>(null);
  const [viewers, setViewers] = useState(0);
  const [uptime, setUptime] = useState('00:00:00');
  
  // Master playlist URL
  // We need to handle the case where the master playlist URL might need the nested folder structure
  // e.g. /hls/live/RyuuM3gum1n/RyuuM3gum1n.m3u8
  const sourceUrl = `/hls/${appName}/${streamName}/${streamName}.m3u8`;

  // Fetch Stream Info
  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        const res = await fetch('/api/streams');
        if (res.ok) {
          const data: Stream[] = await res.json();
          const found = data.find(s => s.streamName === streamName && s.appName === appName);
          if (found) {
             setStreamInfo(found);
             setViewers(found.viewers);
          }
        }
      } catch (error) {
        console.error('Failed to fetch stream info', error);
      }
    };
    
    fetchStreamInfo();
    const interval = setInterval(fetchStreamInfo, 5000); // Poll for viewer updates
    return () => clearInterval(interval);
  }, [streamName, appName]);

  // Calculate Uptime
  useEffect(() => {
    if (!streamInfo?.startTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = now - streamInfo.startTime;
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setUptime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [streamInfo?.startTime]);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content (Player + Info) */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Player Container */}
        <div className="w-full bg-black aspect-video relative group">
          <MediaPlayer 
            title={streamName}
            src={sourceUrl}
            autoPlay
            aspectRatio="16/9"
            streamType="live"
            className="w-full h-full"
          >
            <MediaProvider />
            <DefaultVideoLayout 
              icons={defaultLayoutIcons} 
              slots={{
                settingsMenuStartItems: null,
              }}
            />
            <LatencyDisplay />
            <style jsx global>{`
              /* Hide Playback Speed submenu and items */
              [data-part="menu-item"][aria-label*="Speed"],
              [data-part="menu-item"][aria-label*="speed"],
              .vds-menu-item[aria-label*="Speed"],
              .vds-menu-item[aria-label*="speed"] {
                display: none !important;
              }

              /* Hide bitrate hint in quality menu */
              [data-part="menu-item"][aria-label*="Quality"] .vds-menu-item-hint,
              [data-part="menu-radio"][aria-label*="Quality"] .vds-menu-item-hint {
                display: none !important;
              }
            `}</style>
          </MediaPlayer>
        </div>

        {/* Stream Info Section */}
        <div className="p-4 space-y-4">
           <div className="flex justify-between items-start">
              <div className="flex gap-4">
                 <div className="w-16 h-16 rounded-full bg-zinc-700 relative overflow-hidden border-2 border-white/10">
                    {streamInfo?.avatar ? (
                      <img src={streamInfo.avatar} alt={streamName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-zinc-400 font-bold">
                        {streamName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-background"></div>
                 </div>
                 <div>
                    <h1 className="text-xl font-bold">{streamName}</h1>
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                       <p className="text-accent hover:underline cursor-pointer">Ryuu</p>
                       <span>•</span>
                       <p className="hover:text-accent cursor-pointer">Just Chatting</p>
                    </div>
                    <div className="flex gap-2 mt-2">
                       <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">English</span>
                       <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">Live</span>
                    </div>
                 </div>
              </div>
              
              <div className="flex gap-2">
                 <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-md font-semibold transition-colors">
                    <Heart size={18} />
                    <span>Follow</span>
                 </button>
                 <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-md font-semibold transition-colors">
                    <UserPlus size={18} />
                    <span>Subscribe</span>
                 </button>
              </div>
           </div>

           <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2 text-red-500 font-semibold">
                    <UserPlus size={20} />
                    <span>{viewers} viewers</span>
                 </div>
                 <div className="flex items-center gap-2 text-zinc-400">
                    <Clock size={20} />
                    <span>{uptime}</span>
                 </div>
              </div>
              <div className="flex gap-2">
                 <button className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors">
                    <Share2 size={20} />
                 </button>
                 <button className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors">
                    <MoreVertical size={20} />
                 </button>
              </div>
           </div>
           
           {/* Debug Info (Hidden/Small) */}
           {streamInfo && (
              <div className="mt-8 p-4 bg-zinc-900 rounded-md text-xs text-zinc-500 font-mono">
                 <p>Codec: {streamInfo.inputCodec}</p>
                 <p>Source: {sourceUrl}</p>
              </div>
           )}
        </div>
      </div>

      {/* Chat Sidebar (Placeholder) */}
      <div className="w-[340px] border-l border-zinc-800 bg-secondary hidden lg:flex flex-col">
         <div className="h-[50px] border-b border-zinc-800 flex items-center justify-center font-semibold text-sm uppercase tracking-wide">
            Stream Chat
         </div>
         <div className="flex-1 p-4 flex flex-col items-center justify-center text-zinc-500 gap-2">
            <MessageSquare size={32} />
            <p>Welcome to the chat room!</p>
         </div>
         <div className="p-4 border-t border-zinc-800">
            <div className="bg-zinc-800/50 rounded-md p-2 text-zinc-500 text-sm">
               Send a message...
            </div>
            <div className="flex justify-between items-center mt-2">
               <div className="text-xs font-bold text-accent">0 / 500</div>
               <button className="bg-accent/50 text-white/50 px-3 py-1 rounded text-sm font-semibold cursor-not-allowed">Chat</button>
            </div>
         </div>
      </div>
    </div>
  );
}

function LatencyDisplay() {
  const liveEdge = useMediaState('liveEdge');
  const currentTime = useMediaState('currentTime');
  const duration = useMediaState('duration');
  
  // Estimate latency: Duration (Live Edge) - Current Time
  // Note: For HLS, duration keeps increasing. 'seekableEnd' is better but not directly in useMediaState hooks sometimes.
  // Vidstack's liveEdgeTolerance might be relevant, but let's try a simple calc if possible.
  // Actually, vidstack provides `live` state. 
  // A better approximation for latency in HLS player is (seekableEnd - currentTime).
  
  const player = useMediaPlayer();
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        if (player) {
            const state = player.state;
            const seekableEnd = state.seekableEnd;
            const current = state.currentTime;
            if (seekableEnd > 0 && current > 0) {
                setLatency(Math.max(0, seekableEnd - current));
            }
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <div className="absolute top-4 right-4 bg-black/60 px-2 py-1 rounded text-xs font-mono text-white flex items-center gap-2 z-50 pointer-events-none">
       <Activity size={12} className={latency < 10 ? "text-green-500" : "text-yellow-500"} />
       <span>Latency: {latency.toFixed(1)}s</span>
    </div>
  );
}
