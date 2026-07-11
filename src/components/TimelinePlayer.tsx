'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Shot } from '@/lib/types';

interface TimelinePlayerProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: { prompt: string; videoUrl: string; index: number }[];
}

export default function TimelinePlayer({ isOpen, onClose, playlist }: TimelinePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.warn('Playback block auto-interrupted:', err);
      });
    }
  }, [currentIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen || playlist.length === 0) return null;

  const currentItem = playlist[currentIndex];

  const handleEnded = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose(); // auto-close when done
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Playing Timeline
          </h2>
          <p className="text-sm text-zinc-400">
            Shot {currentIndex + 1} of {playlist.length}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Video Screen */}
      <div className="relative w-full max-w-4xl px-4 flex flex-col items-center">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
          <video
            ref={videoRef}
            src={currentItem.videoUrl}
            onEnded={handleEnded}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>

        {/* Prompt caption overlay */}
        <div className="mt-6 text-center max-w-2xl">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">
            Shot {currentItem.index + 1} Prompt
          </p>
          <p className="text-zinc-200 text-lg italic font-light">
            "{currentItem.prompt}"
          </p>
        </div>
      </div>

      {/* Timeline progress indicators */}
      <div className="absolute bottom-10 left-10 right-10 flex gap-2">
        {playlist.map((item, idx) => {
          const isActive = idx === currentIndex;
          const isPlayed = idx < currentIndex;

          return (
            <div
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="flex-1 h-1.5 rounded-full cursor-pointer transition-all duration-300 relative group"
            >
              <div
                className={`absolute inset-0 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-indigo-500'
                    : isPlayed
                    ? 'bg-zinc-500'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              />
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800 text-[10px] text-zinc-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Shot {idx + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
