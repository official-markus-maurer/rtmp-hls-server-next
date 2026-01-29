
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video } from 'lucide-react';

interface Stream {
  id: string;
  appName: string;
  streamName: string;
  inputCodec: string;
  viewers: number;
  avatar: string | null;
}

export default function Home() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(Date.now()); // For cache busting

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await fetch('/api/streams');
        if (res.ok) {
          const data = await res.json();
          setStreams(data);
          setTimestamp(Date.now()); // Update timestamp to refresh images
        }
      } catch (error) {
        console.error('Failed to fetch streams', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
    const interval = setInterval(fetchStreams, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Live Channels</h1>
      
      {loading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="group animate-pulse">
                 <div className="aspect-video bg-zinc-800 rounded-lg"></div>
                 <div className="flex gap-3 mt-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                       <div className="w-3/4 h-4 bg-zinc-800 rounded"></div>
                       <div className="w-1/2 h-3 bg-zinc-800 rounded"></div>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      ) : streams.length === 0 ? (
         <div className="text-center py-20 text-zinc-500">
            <Video size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No streams are currently live.</p>
            <p className="text-sm">Start streaming to RTMP URL to appear here.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {streams.map((stream) => (
            <div key={stream.id} className="group">
              <Link href={`/watch/${stream.streamName}`} className="block relative aspect-video bg-zinc-800 rounded-lg overflow-hidden transition-transform group-hover:translate-y-[-4px] group-hover:shadow-lg hover:shadow-accent/20">
                 <div className="absolute top-2 left-2 bg-red-600 px-1.5 rounded text-xs font-bold uppercase tracking-wide z-10">Live</div>
                 <div className="absolute bottom-2 left-2 bg-black/60 px-1.5 rounded text-xs z-10">
                    {stream.viewers} viewers
                 </div>
                 <div className="w-full h-full flex items-center justify-center bg-zinc-900 overflow-hidden">
                    <img 
                      src={`/hls/${stream.appName}/${stream.streamName}/thumbnail.jpg?t=${timestamp}`}
                      alt={stream.streamName}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        // Fallback if thumbnail not ready
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                      }}
                    />
                    <Video size={48} className="text-zinc-700 fallback-icon hidden" />
                 </div>
              </Link>
              
              <div className="flex gap-3 mt-3">
                 <div className="w-10 h-10 rounded-full bg-zinc-700 flex-shrink-0 overflow-hidden border border-white/10">
                    {stream.avatar ? (
                      <img src={stream.avatar} alt={stream.streamName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                        {stream.streamName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                 </div>
                 <div className="overflow-hidden">
                    <Link href={`/watch/${stream.streamName}`} className="font-bold text-sm hover:text-accent truncate block">
                      {stream.streamName}
                    </Link>
                    <p className="text-xs text-zinc-400 truncate">Just Chatting</p>
                    <div className="flex gap-1 mt-1">
                       <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 hover:bg-zinc-700 transition-colors cursor-pointer">{stream.inputCodec}</span>
                    </div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
