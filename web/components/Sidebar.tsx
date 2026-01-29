
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Compass, Heart, Users, TrendingUp, Settings } from 'lucide-react';

interface Stream {
  id: string;
  appName: string;
  streamName: string;
  inputCodec: string;
  viewers: number;
  avatar: string | null;
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
    const interval = setInterval(fetchStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-[240px] h-[calc(100vh-64px)] bg-secondary/30 border-r border-white/5 flex flex-col sticky top-[64px] overflow-y-auto hidden lg:flex">
      <div className="p-4 space-y-6">
        
        {/* Discover Section */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2">Discover</h3>
          <div className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-white bg-white/5 rounded-lg transition-colors">
              <Compass size={20} className="text-accent" />
              <span>Browse</span>
            </Link>
            <Link href="/trending" className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <TrendingUp size={20} />
              <span>Trending</span>
            </Link>
            <Link href="/following" className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Users size={20} />
              <span>Following</span>
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </div>
        </div>

        {/* Live Channels Section */}
        <div>
           <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Live Channels</h3>
              <span className="text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">{streams.length}</span>
           </div>
           
           <div className="space-y-1">
              {streams.map((stream) => (
                 <Link href={`/watch/${stream.streamName}`} key={stream.id} className="flex items-center gap-3 px-2 py-2 group hover:bg-white/5 rounded-lg transition-colors">
                    <div className="relative">
                       <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-transparent group-hover:border-accent/50 transition-colors overflow-hidden">
                          {stream.avatar ? (
                            <img src={stream.avatar} alt={stream.streamName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-700 text-xs text-zinc-400">
                              {stream.streamName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                       </div>
                       <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-secondary"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium text-white truncate group-hover:text-accent transition-colors">{stream.streamName}</p>
                       <p className="text-xs text-zinc-500 truncate">Just Chatting</p>
                    </div>
                 </Link>
              ))}
              
              {streams.length === 0 && (
                 <div className="px-2 py-4 text-center">
                    <p className="text-xs text-zinc-500">No channels live</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </aside>
  );
}
