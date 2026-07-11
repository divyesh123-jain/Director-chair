'use client';

import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/30 font-mono">
            D
          </div>
          <span className="text-lg font-bold tracking-tight text-white bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Director's Chair
          </span>
        </div>

        <Link
          href="/login"
          className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 rounded-xl transition-all duration-200"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center relative z-10 w-full max-w-7xl mx-auto px-6 py-12 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 text-xs font-semibold rounded-full mb-8 shadow-sm">
          <span>Introducing Gemini Omni Video Editing</span>
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
        </div>

        <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-white max-w-5xl leading-[1.1] mb-6">
          The Conversational{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
            Video Studio
          </span>
        </h1>

        <p className="text-base md:text-xl text-zinc-400 max-w-3xl leading-relaxed mb-12">
          Direct scenes, manage visual assets, and edit multi-shot stories conversationally.
          Powered by Gemini 2.0 and Nano Banana 2 Lite.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link
            href="/login"
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 transition-all duration-200"
          >
            Start Directing 🎬
          </Link>
          <Link
            href="/signup"
            className="px-8 py-4 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-2xl transition-all duration-200"
          >
            Create Free Account
          </Link>
        </div>

        {/* Visual Mockup/Preview */}
        <div className="w-full max-w-5xl aspect-[16/10] bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-4 shadow-2xl relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none" />
          
          {/* Mock Panels */}
          <div className="w-full h-full rounded-2xl bg-zinc-950 border border-zinc-900 overflow-hidden flex flex-col text-left">
            {/* Header bar */}
            <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="px-3 py-1 bg-zinc-950 text-[10px] text-zinc-500 font-semibold rounded border border-zinc-800">
                director-chair.vercel.app/project/space-odyssey
              </div>
              <div className="w-6" />
            </div>

            {/* Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel */}
              <div className="w-1/4 border-r border-zinc-900 bg-zinc-950 p-4 space-y-4">
                <div className="h-6 bg-zinc-900 rounded-lg w-2/3" />
                <div className="aspect-video bg-zinc-900/60 rounded-xl border border-zinc-800/50 p-3 flex flex-col justify-end">
                  <div className="text-[10px] font-mono text-indigo-400">@hero</div>
                </div>
                <div className="aspect-video bg-zinc-900/60 rounded-xl border border-zinc-800/50 p-3 flex flex-col justify-end">
                  <div className="text-[10px] font-mono text-indigo-400">@spaceship</div>
                </div>
              </div>
              {/* Center Panel */}
              <div className="flex-1 bg-zinc-950/30 p-6 flex flex-col justify-between">
                <div className="space-y-4 max-w-lg">
                  <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs text-zinc-400">
                    "Generate a wide shot of @hero watching the @spaceship launch into orbit"
                  </div>
                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/20 rounded-xl text-xs text-indigo-300">
                    "Awesome, now edit that shot to add a ring system around the gas giant behind it"
                  </div>
                </div>
                {/* Input mockup */}
                <div className="h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center px-4 justify-between">
                  <span className="text-xs text-zinc-500">Ask the director to generate or edit a shot...</span>
                  <span className="px-2.5 py-1 bg-indigo-600 rounded-lg text-[10px] text-white font-bold">SEND</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Section */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 border-t border-zinc-900/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-zinc-900/20 border border-zinc-900 rounded-2xl hover:border-zinc-800/60 transition-all duration-200">
            <div className="w-10 h-10 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center justify-center mb-6">
              💬
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Conversational Directing</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Iterate, crop, pan, and transform scenes naturally. The director understands past context to make changes cleanly.
            </p>
          </div>

          <div className="p-8 bg-zinc-900/20 border border-zinc-900 rounded-2xl hover:border-zinc-800/60 transition-all duration-200">
            <div className="w-10 h-10 bg-violet-600/10 text-violet-400 rounded-xl flex items-center justify-center mb-6">
              🎨
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Consistent Asset Studio</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Generate images and videos using tags like @hero and @location. Automatically saves them directly to your Supabase bucket.
            </p>
          </div>

          <div className="p-8 bg-zinc-900/20 border border-zinc-900 rounded-2xl hover:border-zinc-800/60 transition-all duration-200">
            <div className="w-10 h-10 bg-purple-600/10 text-purple-400 rounded-xl flex items-center justify-center mb-6">
              🎞️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Dynamic Timeline</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Track shot versions, manage story timeline compile sequences, and review exact payload logs inside a full-width player.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900/50 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <span>© {new Date().getFullYear()} Director's Chair. Build for the Gemini Hackathon.</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
