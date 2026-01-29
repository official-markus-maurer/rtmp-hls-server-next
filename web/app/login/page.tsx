
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid credentials');
      } else {
        router.refresh(); // Refresh to update session state
        router.push('/');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-secondary/50 rounded-2xl border border-white/5 shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Log in to StreamHub</h1>
        
        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Log In
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
