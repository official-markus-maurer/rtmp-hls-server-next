
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, User, Bell, Radio, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

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
        {user ? (
          <>
             <button className="relative p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white">
               <Bell size={20} />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-secondary"></span>
             </button>
             
             <div className="flex items-center gap-3 pl-2 border-l border-white/10">
                <div className="text-right hidden lg:block">
                   <p className="text-sm font-bold text-white leading-none">{user.name}</p>
                   {user.streamKey && <p className="text-xs text-zinc-500 font-mono mt-0.5">Stream Key: ...{user.streamKey.slice(-4)}</p>}
                </div>
                <Link href="/settings" className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors overflow-hidden border border-white/10">
                  {user.image ? (
                    <Image src={user.image} alt="Avatar" width={36} height={36} className="object-cover w-full h-full" />
                  ) : (
                    <User size={20} />
                  )}
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                  title="Log Out"
                >
                  <LogOut size={20} />
                </button>
             </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-semibold text-white hover:text-accent transition-colors"
            >
              Log In
            </Link>
            <Link 
              href="/register" 
              className="px-4 py-2 text-sm font-semibold bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
