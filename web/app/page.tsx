
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Copy, RefreshCw, Radio } from 'lucide-react';

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

export default function Home() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [rtmpPort, setRtmpPort] = useState(1935);
  const [host, setHost] = useState('localhost');

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/streams');
      if (res.ok) {
        const data = await res.json();
        setStreams(data);
      }
    } catch (error) {
      console.error('Failed to fetch streams', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    setHost(window.location.hostname);
    
    // Poll every 5 seconds
    const interval = setInterval(fetchStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast here
  };

  return (
    <main className="min-h-screen bg-[#1e1e2e] text-[#cdd6f4] p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold mb-2">My Streaming Server</h1>
          <p className="text-[#a6adc8]">Powered by Node Media Server & FFmpeg</p>
        </header>

        <section className="mb-12">
          <h2 className="text-2xl font-bold border-b-2 border-[#45475a] pb-2 mb-6 flex items-center gap-2">
            <Radio className="w-6 h-6 text-[#f9e2af]" />
            Stream Setup
          </h2>
          
          <div className="bg-[#2b2b3b] p-6 rounded-xl border border-[#45475a]">
            <h3 className="text-xl font-semibold mb-4">Universal Ingest</h3>
            
            <div className="mb-4">
              <span className="block text-sm text-[#a6adc8] uppercase tracking-wider mb-1">Server URL</span>
              <div className="flex items-center gap-2 bg-[#181825] p-3 rounded-lg border border-[#45475a]">
                <code className="text-[#a6e3a1] flex-1 font-mono">rtmp://{host}:{rtmpPort}/live</code>
                <button 
                  onClick={() => copyToClipboard(`rtmp://${host}:${rtmpPort}/live`)}
                  className="bg-[#6c5ce7] hover:bg-[#5b4bc4] text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>

            <div className="mb-4">
              <span className="block text-sm text-[#a6adc8] uppercase tracking-wider mb-1">Stream Key</span>
              <div className="bg-[#181825] p-3 rounded-lg border border-[#45475a] text-[#a6e3a1] font-mono">
                (any_name)
              </div>
              <p className="text-sm text-[#a6adc8] mt-1">e.g. <code>ryuu</code>, <code>test1</code></p>
            </div>

            <div>
              <span className="block text-sm text-[#a6adc8] uppercase tracking-wider mb-1">Output Formats</span>
              <div className="text-[#cdd6f4]">
                Source (Native) + Transcoded Variants (Dynamic downscaling based on input)
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center border-b-2 border-[#45475a] pb-2 mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Play className="w-6 h-6 text-[#f38ba8]" />
              Active Streams
            </h2>
            <button 
              onClick={fetchStreams}
              className="p-2 hover:bg-[#313244] rounded-full transition-colors"
              title="Refresh"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {streams.length === 0 ? (
            <div className="text-center py-12 bg-[#2b2b3b] rounded-xl border border-[#45475a] text-[#a6adc8] italic">
              No streams are currently active. Start streaming to see them here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {streams.map((stream) => (
                <div key={stream.id} className="bg-[#2b2b3b] p-6 rounded-xl border border-[#45475a] hover:border-[#6c5ce7] transition-colors">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-bold">{stream.streamName}</h3>
                    <span className="bg-[#181825] text-[#89b4fa] px-3 py-1 rounded text-sm font-bold uppercase border border-[#45475a]">
                      {stream.inputCodec}
                    </span>
                  </div>

                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-xs text-[#a6adc8] uppercase w-full">Available Variants</span>
                      {stream.variants.map((v) => (
                        <span key={v.name} className="bg-[#313244] text-[#cdd6f4] px-2 py-1 rounded text-xs border border-[#45475a]">
                          {v.codec.toUpperCase()} {v.height}p
                        </span>
                      ))}
                      <span className="bg-[#313244] text-[#a6e3a1] px-2 py-1 rounded text-xs border border-[#45475a]">
                        SRC (Max)
                      </span>
                    </div>
                  </div>

                  <Link 
                    href={`/watch/${stream.streamName}?app=${stream.appName}`}
                    className="block w-full bg-[#6c5ce7] hover:bg-[#5b4bc4] text-white text-center font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Play size={18} fill="currentColor" /> Watch Stream
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
