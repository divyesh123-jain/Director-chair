'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Asset, Shot } from '@/lib/types';
import {
  extractAssetTags,
  extractShotTagNumbers,
  listAvailableShotTags,
} from '@/lib/tags';
import TagInput, { type TagSuggestion } from './TagInput';

interface ConversationPanelProps {
  assets: Asset[];
  shots: Shot[];
  editingShot: Shot | null;
  onCancelEdit: () => void;
  onSend: (message: string, isEdit: boolean, parentShotId?: string) => Promise<void>;
  loading: boolean;
  message: string;
  setMessage: (m: string) => void;
}

function getShotVersionLabel(shot: Shot, shots: Shot[]): string {
  const slotShots = shots
    .filter(s => s.turn_index === shot.turn_index)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const versionIdx = slotShots.findIndex(s => s.id === shot.id);
  const topLevel = shots.find(
    s => s.turn_index === shot.turn_index && s.parent_shot_id === null
  );
  const slotNum = (topLevel?.turn_index ?? shot.turn_index) + 1;
  return `Shot ${slotNum} v${versionIdx + 1}`;
}

export default function ConversationPanel({
  assets,
  shots,
  editingShot,
  onCancelEdit,
  onSend,
  loading,
  message,
  setMessage,
}: ConversationPanelProps) {
  const [resolvedTags, setResolvedTags] = useState<string[]>([]);
  const [unknownTags, setUnknownTags] = useState<string[]>([]);
  const [resolvedShotTags, setResolvedShotTags] = useState<number[]>([]);
  const [unknownShotTags, setUnknownShotTags] = useState<number[]>([]);
  const [enhancing, setEnhancing] = useState(false);

  const handleEnhance = async () => {
    if (!message.trim()) return;
    setEnhancing(true);
    try {
      const res = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to enhance prompt');
      setMessage(json.data.enhanced);
    } catch (err: any) {
      alert('Enhancer error: ' + err.message);
    } finally {
      setEnhancing(false);
    }
  };

  useEffect(() => {
    const tags = extractAssetTags(message);
    const assetTagSet = new Set((assets || []).map(a => a.tag.toLowerCase()));
    const resolved: string[] = [];
    const unknown: string[] = [];
    for (const tag of tags) {
      if (assetTagSet.has(tag.toLowerCase())) resolved.push(tag);
      else unknown.push(tag);
    }
    setResolvedTags(resolved);
    setUnknownTags(unknown);

    const shotNums = extractShotTagNumbers(message);
    const available = new Set(
      listAvailableShotTags(shots).map(s => parseInt(s.replace('shot-', ''), 10))
    );
    const rShots: number[] = [];
    const uShots: number[] = [];
    for (const n of shotNums) {
      if (available.has(n)) rShots.push(n);
      else uShots.push(n);
    }
    setResolvedShotTags(rShots);
    setUnknownShotTags(uShots);
  }, [message, assets, shots]);

  const suggestions = useMemo<TagSuggestion[]>(() => {
    const assetSuggestions: TagSuggestion[] = (assets || []).map(a => ({
      tag: a.tag,
      kind: 'asset',
    }));
    const shotSuggestions: TagSuggestion[] = listAvailableShotTags(shots).map(tag => ({
      tag,
      kind: 'shot',
    }));
    return editingShot
      ? [...assetSuggestions, ...shotSuggestions]
      : [...assetSuggestions, ...shotSuggestions];
  }, [assets, shots, editingShot]);

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;
    const isEdit = !!editingShot;
    const parentShotId = editingShot?.id;
    const currentMsg = message;
    setMessage('');
    await onSend(currentMsg, isEdit, parentShotId);
  };

  const getEditingShotNumber = () => {
    if (!editingShot) return 0;
    const topLevel = shots.filter(s => s.parent_shot_id === null);
    const idx = topLevel.findIndex(
      s =>
        s.id === editingShot.id ||
        (editingShot.parent_shot_id && s.id === editingShot.parent_shot_id)
    );
    return idx !== -1 ? idx + 1 : editingShot.turn_index + 1;
  };

  const sortedShots = [...shots].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">Director&apos;s Chat</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Orchestrate your timeline using natural language prompts</p>
        </div>
        {editingShot && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400 font-semibold">
            <span>Editing Shot {getEditingShotNumber()} — changes preserve everything else</span>
            <button onClick={onCancelEdit} className="hover:text-amber-200 ml-1 transition-colors">
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {sortedShots.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <h3 className="text-zinc-400 font-medium text-sm">No timeline actions recorded.</h3>
            <p className="text-zinc-600 text-xs mt-1.5 max-w-sm leading-relaxed">
              Reference assets with <span className="text-indigo-400">@tag</span> or shots with{' '}
              <span className="text-amber-400">@shot-N</span> when editing.
            </p>
          </div>
        ) : (
          sortedShots.map(shot => {
            const isEdit = !!shot.parent_shot_id;
            return (
              <div key={shot.id} className="space-y-3">
                <div className={`flex ${isEdit ? 'justify-center' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm relative ${
                      isEdit
                        ? 'bg-amber-950/30 border border-amber-900/40 text-amber-100'
                        : 'bg-zinc-800 border border-zinc-700/50 text-zinc-100'
                    }`}
                  >
                    <p className="font-light leading-relaxed whitespace-pre-wrap">{shot.prompt}</p>
                    <span className="absolute bottom-1 right-2 text-[9px] text-zinc-500 font-mono">
                      {isEdit ? `Edit → ${getShotVersionLabel(shot, shots)}` : `Shot ${shot.turn_index + 1}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${isEdit ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                  <span>
                    System: {isEdit ? `Edited ${getShotVersionLabel(shot, shots)}` : `Generated Shot ${shot.turn_index + 1}`}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(shot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span>Gemini Omni is generating...</span>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-zinc-800 bg-zinc-950">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-3"
        >
          <TagInput
            value={message}
            onChange={setMessage}
            onSubmit={handleSubmit}
            disabled={loading}
            suggestions={suggestions}
            placeholder={
              editingShot
                ? "Swap @tom with @jerry, match lighting from @shot-3..."
                : "@hero walks on the bridge of @spaceship, cinematic wide shot"
            }
            footer={
              <>
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-[10px] text-zinc-600 font-medium select-none">Enter to send</span>
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={enhancing || !message.trim() || loading}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                  >
                    {enhancing ? 'Enhancing...' : 'Enhance ✨'}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!message.trim() || loading}
                  className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg text-xs font-bold"
                >
                  Send
                </button>
              </>
            }
          />

          {(resolvedTags.length > 0 ||
            unknownTags.length > 0 ||
            resolvedShotTags.length > 0 ||
            unknownShotTags.length > 0) && (
            <div className="flex flex-wrap gap-2 items-center pt-1">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Tags:</span>
              {resolvedTags.map(tag => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono"
                >
                  @{tag}
                </span>
              ))}
              {resolvedShotTags.map(n => (
                <span
                  key={`shot-${n}`}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono"
                >
                  @shot-{n}
                </span>
              ))}
              {unknownTags.map(tag => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono"
                  title="Unknown asset tag"
                >
                  @{tag} (unknown)
                </span>
              ))}
              {unknownShotTags.map(n => (
                <span
                  key={`unknown-shot-${n}`}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono"
                  title="Shot not found or not ready"
                >
                  @shot-{n} (unknown)
                </span>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
