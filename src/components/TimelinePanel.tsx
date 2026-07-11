'use client';

import React, { useState } from 'react';
import type { Shot } from '@/lib/types';
import ShotCard from './ShotCard';
import TimelinePlayer from './TimelinePlayer';

interface TimelinePanelProps {
  shots: Shot[];
  onSelectForEdit: (shot: Shot) => void;
  onDeleteShot: (id: string) => void;
  onReusePrompt: (prompt: string) => void;
  isEditingActive: boolean;
}

export default function TimelinePanel({
  shots,
  onSelectForEdit,
  onDeleteShot,
  onReusePrompt,
  isEditingActive,
}: TimelinePanelProps) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Group shots by turn_index
  const groupedShots: { [turn: number]: Shot[] } = {};
  for (const shot of shots) {
    if (groupedShots[shot.turn_index] === undefined) {
      groupedShots[shot.turn_index] = [];
    }
    groupedShots[shot.turn_index].push(shot);
  }

  // Sort turn keys numerically
  const turnKeys = Object.keys(groupedShots)
    .map(Number)
    .sort((a, b) => a - b);

  // Prepare playlist for G3 playback: latest done version of each turn
  const playlist = turnKeys
    .map(turn => {
      const versions = groupedShots[turn].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latestDone = versions.reverse().find(v => v.status === 'done' && v.output_video_url);
      if (latestDone && latestDone.output_video_url) {
        return {
          prompt: latestDone.prompt,
          videoUrl: latestDone.output_video_url,
          index: turn,
        };
      }
      return null;
    })
    .filter(Boolean) as { prompt: string; videoUrl: string; index: number }[];

  return (
    <div className="w-[420px] border-l border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden">
      {/* Header Panel */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
        <div>
          <h3 className="font-semibold text-zinc-200 text-sm tracking-wide uppercase">Narrative Timeline</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Order of top-level video shots</p>
        </div>

        {/* Play Timeline Button (G3) */}
        <button
          onClick={() => setIsPlayerOpen(true)}
          disabled={playlist.length === 0}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play Timeline
        </button>
      </div>

      {/* Cards stack */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {turnKeys.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-4 text-center">
            <svg className="w-8 h-8 text-zinc-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-zinc-500 text-xs">No shots generated yet.</p>
            <p className="text-[10px] text-zinc-600 mt-1">Prompt in the center panel to begin compiling your story.</p>
          </div>
        ) : (
          turnKeys.map((turn, index) => (
            <ShotCard
              key={turn}
              shotsInTurn={groupedShots[turn]}
              shotIndex={index}
              onSelectForEdit={onSelectForEdit}
              onDeleteShot={onDeleteShot}
              onReusePrompt={onReusePrompt}
              isEditingActive={isEditingActive}
            />
          ))
        )}
      </div>

      {/* Full screen timeline sequence modal (G3) */}
      <TimelinePlayer
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        playlist={playlist}
      />
    </div>
  );
}
