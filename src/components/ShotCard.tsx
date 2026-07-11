'use client';

import React, { useState, useEffect } from 'react';
import type { Shot } from '@/lib/types';
import ContextInspector from './ContextInspector';

interface ShotCardProps {
  shotsInTurn: Shot[];
  shotIndex: number;
  onSelectForEdit: (shot: Shot) => void;
  onDeleteShot: (id: string) => void;
  onReusePrompt: (prompt: string) => void;
  onRegenerate: (shotId: string) => void;
  isEditingActive: boolean;
}

export default function ShotCard({
  shotsInTurn,
  shotIndex,
  onSelectForEdit,
  onDeleteShot,
  onReusePrompt,
  onRegenerate,
  isEditingActive,
}: ShotCardProps) {
  const versions = [...shotsInTurn].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const [selectedVersionIdx, setSelectedVersionIdx] = useState(versions.length - 1);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  useEffect(() => {
    setSelectedVersionIdx(versions.length - 1);
  }, [shotsInTurn.length]);

  const activeShot = versions[selectedVersionIdx];
  if (!activeShot) return null;

  const parentShotNumber = activeShot.parent_shot_id
    ? shotIndex + 1
    : shotIndex > 0
      ? shotIndex
      : undefined;

  return (
    <div className="border border-zinc-800 bg-zinc-950/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700">
      <div className="p-4 flex justify-between items-center bg-zinc-900/30 border-b border-zinc-900/50">
        <div>
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Shot {shotIndex + 1}
            {versions.length > 1 && (
              <span className="text-zinc-500 font-normal ml-1">v{selectedVersionIdx + 1}</span>
            )}
          </h4>
          <span className="text-[10px] text-zinc-500 italic truncate max-w-[150px] block">
            &quot;{activeShot.prompt}&quot;
          </span>
        </div>

        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
              {versions.map((ver, idx) => (
                <button
                  key={ver.id}
                  onClick={() => setSelectedVersionIdx(idx)}
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${
                    idx === selectedVersionIdx
                      ? 'bg-zinc-800 text-indigo-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  v{idx + 1}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => onDeleteShot(activeShot.id)}
            disabled={activeShot.status === 'generating'}
            className="p-1 bg-zinc-900 hover:bg-rose-600/80 text-zinc-500 hover:text-white rounded border border-zinc-800 transition-colors disabled:opacity-40"
            title="Delete this shot version"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="aspect-video w-full relative bg-black flex items-center justify-center border-b border-zinc-900">
        {activeShot.status === 'generating' || activeShot.status === 'pending' ? (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <p className="text-zinc-400 text-xs font-semibold">Gemini Omni is generating...</p>
          </div>
        ) : activeShot.status === 'error' ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-rose-400">
            <p className="text-xs font-bold uppercase tracking-wider">Generation Error</p>
            <p className="text-[10px] text-zinc-500 max-w-[200px] truncate">{activeShot.error}</p>
          </div>
        ) : (
          <video src={activeShot.output_video_url || ''} controls className="w-full h-full object-contain" />
        )}
      </div>

      <div className="p-4 space-y-3 bg-zinc-950">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setIsInspectorOpen(prev => !prev)}
            className={`flex items-center gap-1 text-[11px] font-semibold ${
              isInspectorOpen ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>What we sent</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onRegenerate(activeShot.id)}
              disabled={activeShot.status === 'generating'}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-lg disabled:opacity-40"
            >
              Regenerate
            </button>
            <button
              onClick={() => onReusePrompt(activeShot.prompt)}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-lg"
            >
              Reuse
            </button>
            <button
              onClick={() => onSelectForEdit(activeShot)}
              disabled={activeShot.status !== 'done' || isEditingActive}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-40 text-zinc-300 text-xs font-bold rounded-lg"
            >
              Edit shot
            </button>
          </div>
        </div>

        {isInspectorOpen && (
          <ContextInspector summary={activeShot.context_summary} parentShotNumber={parentShotNumber} />
        )}
      </div>
    </div>
  );
}
