'use client';

import React, { useState } from 'react';
import type { Shot } from '@/lib/types';
import ShotCard from './ShotCard';
import TimelinePlayer from './TimelinePlayer';

interface TimelinePanelProps {
  shots: Shot[];
  projectId: string;
  onSelectForEdit: (shot: Shot) => void;
  onDeleteShot: (id: string) => void;
  onReusePrompt: (prompt: string) => void;
  onRegenerate: (shotId: string) => void;
  isEditingActive: boolean;
}

export default function TimelinePanel({
  shots,
  projectId,
  onSelectForEdit,
  onDeleteShot,
  onReusePrompt,
  onRegenerate,
  isEditingActive,
}: TimelinePanelProps) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const groupedShots: { [turn: number]: Shot[] } = {};
  for (const shot of shots) {
    if (groupedShots[shot.turn_index] === undefined) groupedShots[shot.turn_index] = [];
    groupedShots[shot.turn_index].push(shot);
  }

  const turnKeys = Object.keys(groupedShots)
    .map(Number)
    .sort((a, b) => a - b);

  const playlist = turnKeys
    .map(turn => {
      const versions = groupedShots[turn].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latestDone = [...versions].reverse().find(v => v.status === 'done' && v.output_video_url);
      if (latestDone?.output_video_url) {
        return { prompt: latestDone.prompt, videoUrl: latestDone.output_video_url, index: turn };
      }
      return null;
    })
    .filter(Boolean) as { prompt: string; videoUrl: string; index: number }[];

  const handleExport = async () => {
    if (playlist.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/timeline/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          videoUrls: playlist.map(p => p.videoUrl),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeline-${projectId}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-[420px] border-l border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30 gap-2">
        <div>
          <h3 className="font-semibold text-zinc-200 text-sm tracking-wide uppercase">Narrative Timeline</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Order of top-level video shots</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleExport}
            disabled={playlist.length === 0 || exporting}
            className="py-1.5 px-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold"
          >
            {exporting ? '...' : 'Export'}
          </button>
          <button
            onClick={() => setIsPlayerOpen(true)}
            disabled={playlist.length === 0}
            className="flex items-center gap-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white rounded-lg text-xs font-bold"
          >
            Play
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {turnKeys.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-4 text-center">
            <p className="text-zinc-500 text-xs">No shots generated yet.</p>
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
              onRegenerate={onRegenerate}
              isEditingActive={isEditingActive}
            />
          ))
        )}
      </div>

      <TimelinePlayer
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        playlist={playlist}
        projectId={projectId}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
