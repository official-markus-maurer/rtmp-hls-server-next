
import Link from 'next/link';
import { Search, User, Bell, Radio } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="h-[64px] bg-secondary/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
      {/* Left: Logo */}
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group">
           <div className="bg-accent text-white p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
             <Radio size={24} />
           </div>
           <span className="font-bold text-lg tracking-tight">StreamHub</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link href="/" className="text-white hover:text-accent transition-colors">
            Live
          </Link>
          <Link href="/" className="hover:text-white transition-colors">
            Categories
          </Link>
          <Link href="/" className="hover:text-white transition-colors">
            Community
          </Link>
        </div>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-[480px] mx-8">
        <div className="relative w-full group">
          <input 
            type="text" 
            placeholder="Search channels..." 
            className="w-full bg-black/20 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all"
          />
          <Search size={16} className="absolute left-3.5 top-2.5 text-zinc-500 group-focus-within:text-accent transition-colors" />
        </div>
      </div>

      {/* Right: User Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-secondary"></span>
        </button>
        <button className="w-9 h-9 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-full flex items-center justify-center text-accent transition-colors">
          <User size={20} />
        </button>
      </div>
    </nav>
  );
}
