'use client';

import React from 'react';
import type { ContextSummary } from '@/lib/types';

interface ContextInspectorProps {
  summary: ContextSummary | null;
  parentShotNumber?: number;
}

export default function ContextInspector({ summary, parentShotNumber }: ContextInspectorProps) {
  if (!summary) return null;

  const isEdit = summary.editMode || !!summary.baseVideoUrl;
  const imageCount = summary.multimodalInputs?.filter(m => m.type === 'image').length ?? 0;
  const videoCount = summary.multimodalInputs?.filter(m => m.type === 'video').length ?? 0;
  const audioCount = summary.multimodalInputs?.filter(m => m.type === 'audio').length ?? 0;

  return (
    <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800 space-y-3 font-mono text-[11px] text-zinc-300">
      <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-900 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span>Omni Flash Context Inspector</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold uppercase tracking-wider text-[9px]">
          Physics: ON
        </span>

        {summary.consistencyInstruction ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold uppercase tracking-wider text-[9px]">
            Consistency: ON {parentShotNumber ? `(Shot ${parentShotNumber})` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">
            Consistency: OFF
          </span>
        )}

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold uppercase tracking-wider text-[9px] ${
            (summary.omniEndpoint || 'interactions.create') === 'interactions.edit'
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              : 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
          }`}
        >
          {(summary.omniEndpoint || 'interactions.create') === 'interactions.edit'
            ? 'Omni Edit (stateful)'
            : 'Omni Generate'}
        </span>

        {isEdit && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold uppercase tracking-wider text-[9px]">
            Edit Mode: ON
          </span>
        )}

        {summary.swapInstruction && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold uppercase tracking-wider text-[9px]">
            Element Swap
          </span>
        )}
      </div>

      {summary.userPrompt && (
        <div>
          <span className="text-[10px] text-zinc-500 block mb-1">User prompt:</span>
          <p className="text-zinc-300 bg-zinc-900/40 p-2 rounded border border-zinc-900 leading-relaxed">
            {summary.userPrompt}
          </p>
        </div>
      )}

      {summary.instructions && summary.instructions.length > 0 && (
        <div>
          <span className="text-[10px] text-zinc-500 block mb-1">System instructions sent:</span>
          <ul className="space-y-1">
            {summary.instructions.map((inst, i) => (
              <li
                key={i}
                className="text-zinc-400 leading-normal bg-zinc-900/30 p-1.5 rounded border border-zinc-900 text-[10px]"
              >
                {inst}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.baseVideoUrl && (
        <div>
          <span className="text-[10px] text-zinc-500 block mb-1">Base video (edit target):</span>
          <div className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800/80 rounded">
            <video src={summary.baseVideoUrl} className="w-16 h-10 rounded object-cover bg-black" muted />
            <span className="truncate text-[9px] text-zinc-500 flex-1">{summary.baseVideoUrl}</span>
          </div>
        </div>
      )}

      {summary.referencedShots && summary.referencedShots.length > 0 && (
        <div>
          <span className="text-[10px] text-zinc-500 block mb-1">Referenced @shot tags:</span>
          <div className="grid grid-cols-1 gap-1.5">
            {summary.referencedShots.map(ref => (
              <div
                key={ref.shotId}
                className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800/80 rounded"
              >
                <video src={ref.videoUrl} className="w-12 h-8 rounded object-cover bg-black" muted />
                <span className="text-zinc-300 font-mono text-[10px]">@{ref.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="text-[10px] text-zinc-500 block mb-1">Referenced @asset tags:</span>
        {summary.references && summary.references.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {summary.references.map(ref => (
              <div
                key={ref.assetId}
                className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800/80 rounded"
              >
                <div className="w-6 h-6 rounded overflow-hidden bg-zinc-950 flex-shrink-0">
                  {ref.type === 'video' ? (
                    <video src={ref.url} className="w-full h-full object-cover" muted />
                  ) : ref.type === 'audio' ? (
                    <div className="w-full h-full flex items-center justify-center text-[8px]">🎵</div>
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

      <div className="pt-2 border-t border-zinc-900 text-[10px] space-y-1.5">
        <div className="flex gap-2 text-zinc-500">
          <span className="font-semibold">Multimodal payload:</span>
          <span>
            {imageCount} image{imageCount !== 1 ? 's' : ''}, {videoCount} video
            {videoCount !== 1 ? 's' : ''}, {audioCount} audio
          </span>
        </div>

        {(summary.previousInteractionId || summary.interactionId) && (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-zinc-500">Interaction chain:</span>
            <span className="text-zinc-400 select-all truncate text-[9px] bg-zinc-900 px-1 py-0.5 rounded">
              {summary.previousInteractionId || '—'} → {summary.interactionId || 'pending'}
            </span>
          </div>
        )}

        {summary.originalSize != null && summary.compressedSize != null && (
          <div className="text-zinc-500">
            Compression: {(summary.originalSize / 1024 / 1024).toFixed(2)} MB →{' '}
            {(summary.compressedSize / 1024 / 1024).toFixed(2)} MB
          </div>
        )}
      </div>
    </div>
  );
}
