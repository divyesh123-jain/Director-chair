'use client';

import React from 'react';
import type { ContextSummary } from '@/lib/types';

interface ContextInspectorProps {
  summary: ContextSummary | null;
  parentShotNumber?: number;
}

export default function ContextInspector({ summary, parentShotNumber }: ContextInspectorProps) {
  if (!summary) return null;

  return (
    <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800 space-y-3 font-mono text-[11px] text-zinc-300">
      {/* Title */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-900 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span>Model Context Inspector (G2)</span>
      </div>

      {/* Chips Row */}
      <div className="flex flex-wrap gap-1.5">
        {/* Physics Chip (G1) */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold uppercase tracking-wider text-[9px]">
          Physics: ON
        </span>

        {/* Consistency Chip */}
        {summary.consistencyInstruction ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold uppercase tracking-wider text-[9px]">
            Consistency: ON {parentShotNumber ? `(Shot ${parentShotNumber})` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">
            Consistency: OFF
          </span>
        )}

        {/* Stateful Edit / Base Video */}
        {summary.baseVideoUrl && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold uppercase tracking-wider text-[9px]">
            Edit Mode: ON
          </span>
        )}
      </div>

      {/* Referenced @tags */}
      <div>
        <span className="text-[10px] text-zinc-500 block mb-1">Referenced @tags:</span>
        {summary.references && summary.references.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {summary.references.map(ref => (
              <div
                key={ref.assetId}
                className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800/80 rounded"
              >
                <div className="w-6 h-6 rounded overflow-hidden bg-zinc-950 flex-shrink-0">
                  {ref.type === 'video' ? (
                    <video src={ref.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={ref.url} alt={ref.tag} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="truncate text-zinc-300 font-mono text-[10px]">@{ref.tag}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-[10px] italic">No asset tags referenced in this turn.</p>
        )}
      </div>

      {/* Model Instructions Inspector */}
      <div className="space-y-1.5 pt-2 border-t border-zinc-900 text-[10px]">
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 font-semibold">Gravity/Lighting constraint (G1):</span>
          <p className="text-zinc-400 leading-normal bg-zinc-900/30 p-1.5 rounded border border-zinc-900 select-all">
            {summary.physicsInstruction}
          </p>
        </div>
        {summary.interactionId && (
          <div className="flex items-center gap-1 pt-1 text-zinc-500">
            <span className="font-semibold text-zinc-500">Trace ID:</span>
            <span className="text-zinc-400 select-all truncate text-[9px] bg-zinc-900 px-1 py-0.5 rounded">
              {summary.interactionId}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
