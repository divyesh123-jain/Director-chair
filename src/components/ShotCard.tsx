'use client';

import React, { useState, useEffect } from 'react';
import type { Shot } from '@/lib/types';
import ContextInspector from './ContextInspector';

interface ShotCardProps {
  shotsInTurn: Shot[]; // All versions of the shot for this turn_index
  shotIndex: number;   // 0-indexed number of the slot in the timeline
  onSelectForEdit: (shot: Shot) => void;
  onDeleteShot: (id: string) => void;
  onReusePrompt: (prompt: string) => void;
  isEditingActive: boolean;
}

export default function ShotCard({
  shotsInTurn,
  shotIndex,
  onSelectForEdit,
  onDeleteShot,
  onReusePrompt,
  isEditingActive,
}: ShotCardProps) {
  // Sort versions by creation date to assign v1, v2...
  const versions = [...shotsInTurn].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Default to the latest version
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(versions.length - 1);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Update selected version if a new version is generated
  useEffect(() => {
    setSelectedVersionIdx(versions.length - 1);
  }, [shotsInTurn.length]);

  const activeShot = versions[selectedVersionIdx];
  if (!activeShot) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-950/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700">
      {/* Card Header with Slot Index & Version Stack */}
      <div className="p-4 flex justify-between items-center bg-zinc-900/30 border-b border-zinc-900/50">
        <div>
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Shot {shotIndex + 1}
          </h4>
          <span className="text-[10px] text-zinc-500 italic truncate max-w-[150px] block">
            "{activeShot.prompt}"
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Switcher Stack */}
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

          {/* Delete Version Button */}
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

      {/* Video Content / Loading State / Error State */}
      <div className="aspect-video w-full relative bg-black flex items-center justify-center border-b border-zinc-900">
        {activeShot.status === 'generating' || activeShot.status === 'pending' ? (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            {/* Spinning Loader */}
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <div>
              <p className="text-zinc-400 text-xs font-semibold">Gemini Omni is generating...</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Translating prompt constraints into video frames</p>
            </div>
          </div>
        ) : activeShot.status === 'error' ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-rose-400">
            <svg className="w-8 h-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-wider">Generation Error</p>
            <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed truncate">
              {activeShot.error || 'Request aborted.'}
            </p>
          </div>
        ) : (
          <video
            src={activeShot.output_video_url || ''}
            controls
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="p-4 space-y-3 bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          {/* Collapse Inspector Trigger */}
          <button
            onClick={() => setIsInspectorOpen(prev => !prev)}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
              isInspectorOpen ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>What we sent</span>
            <svg
              className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                isInspectorOpen ? 'rotate-180 text-indigo-400' : 'text-zinc-600'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {/* Reuse Prompt Button */}
            <button
              onClick={() => onReusePrompt(activeShot.prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all"
              title="Reuse prompt in chat"
            >
              Reuse 🔄
            </button>

            {/* Edit Button */}
            <button
              onClick={() => onSelectForEdit(activeShot)}
              disabled={activeShot.status !== 'done' || isEditingActive}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-900 text-zinc-300 text-xs font-bold rounded-lg transition-all"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit shot
            </button>
          </div>
        </div>

        {/* Collapsed Context Inspector Panel */}
        {isInspectorOpen && (
          <div className="pt-2 animate-fadeIn">
            <ContextInspector
              summary={activeShot.context_summary}
              parentShotNumber={shotIndex} // references prior top-level shot
            />
          </div>
        )}
      </div>
    </div>
  );
}
