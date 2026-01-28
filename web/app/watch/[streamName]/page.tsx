
'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';

import { MediaPlayer, MediaProvider } from '@vidstack/react';
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
}

export default function WatchPage({ params }: { params: Promise<{ streamName: string }> }) {
  const unwrappedParams = use(params);
  const streamName = unwrappedParams.streamName;
  const searchParams = useSearchParams();
  const appName = searchParams.get('app') || 'live';

  const [streamInfo, setStreamInfo] = useState<Stream | null>(null);
  const [activeVariant, setActiveVariant] = useState('src');
  const [sourceUrl, setSourceUrl] = useState('');

  // Fetch Stream Info
  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        const res = await fetch('/api/streams');
        if (res.ok) {
          const data: Stream[] = await res.json();
          const found = data.find(s => s.streamName === streamName && s.appName === appName);
          if (found) setStreamInfo(found);
        }
      } catch (error) {
        console.error('Failed to fetch stream info', error);
      }
    };
    fetchStreamInfo();
  }, [streamName, appName]);

  // Update source URL when active variant changes
  useEffect(() => {
    const url = `/hls/${appName}/${streamName}_${activeVariant}.m3u8`;
    setSourceUrl(url);
  }, [activeVariant, appName, streamName]);

  return (
    <main className="min-h-screen bg-black text-[#cdd6f4] font-sans flex flex-col">
      <div className="p-4 bg-[#181825] border-b border-[#45475a] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-[#313244] rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {streamName}
            {streamInfo && (
              <span className="text-xs bg-[#313244] px-2 py-1 rounded text-[#89b4fa] uppercase border border-[#45475a]">
                {streamInfo.inputCodec}
              </span>
            )}
          </h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-[0_0_40px_rgba(108,92,231,0.1)] border border-[#313244] relative">
          <MediaPlayer 
            title={streamName}
            src={sourceUrl}
            autoPlay
            aspectRatio="16/9"
          >
            <MediaProvider />
            <DefaultVideoLayout icons={defaultLayoutIcons} />
          </MediaPlayer>
        </div>

        <div className="w-full max-w-6xl mt-8 bg-[#181825] p-6 rounded-xl border border-[#45475a]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Settings size={20} className="text-[#f9e2af]" />
            Quality Selector
          </h3>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#a6adc8] uppercase w-16">SRC:</span>
              <button
                onClick={() => setActiveVariant('src')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  activeVariant === 'src' 
                    ? 'bg-[#6c5ce7] text-white' 
                    : 'bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4]'
                }`}
              >
                Source (Max)
              </button>
            </div>

            {streamInfo && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#a6adc8] uppercase w-16">
                  {streamInfo.inputCodec}:
                </span>
                {streamInfo.variants.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => setActiveVariant(`${v.codec}_${v.height}p`)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      activeVariant === `${v.codec}_${v.height}p`
                        ? 'bg-[#6c5ce7] text-white' 
                        : 'bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4]'
                    }`}
                  >
                    {v.height >= 2160 ? '4K' : `${v.height}p`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
