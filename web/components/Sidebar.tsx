
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Compass, Heart, Users, TrendingUp } from 'lucide-react';

interface Stream {
  id: string;
  appName: string;
  streamName: string;
  inputCodec: string;
  viewers: number;
}

export default function Sidebar() {
  const [streams, setStreams] = useState<Stream[]>([]);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await fetch('/api/streams');
        if (res.ok) {
          const data = await res.json();
          setStreams(data);
        }
      } catch (error) {
        console.error('Failed to fetch streams', error);
      }
    };
    
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-[260px] bg-background border-r border-white/5 flex-col hidden lg:flex h-[calc(100vh-64px)] sticky top-[64px] overflow-y-auto pt-6 px-4">
      
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
           <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2">Discover</h3>
           <div className="space-y-1">
              <Link href="/" className="flex items-center gap-3 px-3 py-2 bg-secondary/50 text-accent rounded-xl font-medium">
                 <Compass size={18} />
                 <span>Browse</span>
              </Link>
              <Link href="/" className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium">
                 <TrendingUp size={18} />
                 <span>Trending</span>
              </Link>
              <Link href="/" className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium">
                 <Users size={18} />
                 <span>Following</span>
              </Link>
           </div>
        </div>

        {/* Live Channels Section */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2 flex justify-between items-center">
             <span>Live Channels</span>
             <span className="bg-red-500/10 text-red-500 text-[10px] px-1.5 py-0.5 rounded-full">{streams.length}</span>
          </h3>
          
          <div className="space-y-1">
            {streams.length === 0 ? (
               <div className="px-3 py-4 text-sm text-zinc-600 italic">
                  No active streams
               </div>
            ) : (
               streams.map((stream) => (
                <Link key={stream.id} href={`/watch/${stream.streamName}`} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors group">
                   <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-accent/50 transition-colors">
                         <Video size={18} className="text-zinc-500 group-hover:text-accent" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                   </div>
                   <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center">
                         <p className="font-semibold text-sm truncate text-zinc-200 group-hover:text-white">{stream.streamName}</p>
                      </div>
                      <p className="text-xs text-zinc-500 truncate group-hover:text-zinc-400">Just Chatting</p>
                   </div>
                   <div className="text-xs text-zinc-500 font-mono">
                      {stream.viewers}
                   </div>
                </Link>
               ))
            )}
          </div>
        </div>
      </div>

    </aside>
  );
}
