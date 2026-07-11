'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleGoogleSignup = async () => {
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) alert(error.message);
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-600/30 font-mono mb-4">
            D
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Create Account</h2>
          <p className="text-xs text-zinc-500 mt-1">Get started with Director's Chair today</p>
        </div>

        {success ? (
          <div className="bg-emerald-950/30 border border-emerald-900/40 p-6 rounded-2xl text-center space-y-3">
            <span className="text-2xl">✉️</span>
            <h3 className="text-sm font-bold text-white">Check your email</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We sent a confirmation link to <span className="text-indigo-400 font-semibold">{email}</span>. Click the link to activate your workspace!
            </p>
            <Link
              href="/login"
              className="block mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignup}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/50 text-zinc-200 hover:text-white font-semibold rounded-2xl transition-all duration-200 shadow-sm"
            >
              {/* Google Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign up with Google
            </button>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 h-[1px] bg-zinc-800" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase px-3 tracking-widest">OR</span>
              <div className="flex-1 h-[1px] bg-zinc-800" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700/60 focus:border-indigo-500/80 focus:outline-none rounded-xl text-sm transition-colors text-white"
                  placeholder="name@domain.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700/60 focus:border-indigo-500/80 focus:outline-none rounded-xl text-sm transition-colors text-white"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all duration-200 mt-2 shadow-lg shadow-indigo-600/20"
              >
                {loading ? 'Registering...' : 'Sign Up'}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-500 mt-8">
              Already have an account?{' '}
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
