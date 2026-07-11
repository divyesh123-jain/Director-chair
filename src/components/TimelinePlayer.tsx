'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TimelinePlayerProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: { prompt: string; videoUrl: string; index: number }[];
  projectId: string;
  onExport?: () => void;
  exporting?: boolean;
}

export default function TimelinePlayer({
  isOpen,
  onClose,
  playlist,
  onExport,
  exporting,
}: TimelinePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <h2 className="text-xl font-bold text-white">Playing Timeline</h2>
          <p className="text-sm text-zinc-400">
            Shot {currentIndex + 1} of {playlist.length}
          </p>
        </div>
        <div className="flex gap-2">
          {onExport && (
            <button
              onClick={onExport}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
            >
              {exporting ? 'Exporting...' : 'Export MP4'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-4xl px-4 flex flex-col items-center">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
          <video
            ref={videoRef}
            src={currentItem.videoUrl}
            onEnded={handleEnded}
            controls
            autoPlay
            muted
            className="w-full h-full object-contain"
          />
        </div>
        <p className="mt-6 text-zinc-200 text-lg italic">&quot;{currentItem.prompt}&quot;</p>
      </div>
    </div>
  );
}
