'use client';

import React, { useState, useEffect } from 'react';
import type { Asset, Shot } from '@/lib/types';
import { extractTags } from '@/lib/tags';

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

  // Parse tags dynamically as the user types
  useEffect(() => {
    const tags = extractTags(message);
    const resolved: string[] = [];
    const unknown: string[] = [];

    const assetTagSet = new Set((assets || []).map(a => a.tag.toLowerCase()));

    for (const tag of tags) {
      if (assetTagSet.has(tag.toLowerCase())) {
        resolved.push(tag);
      } else {
        unknown.push(tag);
      }
    }

    setResolvedTags(resolved);
    setUnknownTags(unknown);
  }, [message, assets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const isEdit = !!editingShot;
    const parentShotId = editingShot?.id;

    const currentMsg = message;
    setMessage('');
    await onSend(currentMsg, isEdit, parentShotId);
  };

  // Find the top-level index for the banner
  const getEditingShotNumber = () => {
    if (!editingShot) return 0;
    // Count prior top-level shots to get 1-indexed count
    const topLevel = shots.filter(s => s.parent_shot_id === null);
    const idx = topLevel.findIndex(s => s.id === editingShot.id || (editingShot.parent_shot_id && s.id === editingShot.parent_shot_id));
    return idx !== -1 ? idx + 1 : 1;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900/10 overflow-hidden">
      {/* Top Banner / Breadcrumb */}
      <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">Director's Chat</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Orchestrate your timeline using natural language prompts</p>
        </div>
        {editingShot && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400 font-semibold animate-pulse">
            <span>Editing Shot {getEditingShotNumber()}</span>
            <button onClick={onCancelEdit} className="hover:text-amber-200 ml-1 transition-colors">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Message History Log */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {shots.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-zinc-400 font-medium text-sm">No timeline actions recorded.</h3>
            <p className="text-zinc-600 text-xs mt-1.5 max-w-sm leading-relaxed">
              Start by typing a prompt in the input below. Reference assets using their tag handles (e.g. <span className="text-indigo-400">@tag</span>).
            </p>
          </div>
        ) : (
          shots
            // Render only top-level actions in the conversation (edits show in timeline panel)
            .filter(s => s.parent_shot_id === null)
            .map((shot, idx) => (
              <div key={shot.id} className="space-y-4">
                {/* User Prompt Message */}
                <div className="flex justify-end">
                  <div className="max-w-[70%] bg-zinc-800 border border-zinc-700/50 rounded-2xl px-4 py-3 text-sm text-zinc-100 shadow-sm relative group">
                    <p className="font-light leading-relaxed whitespace-pre-wrap">{shot.prompt}</p>
                    <span className="absolute bottom-1 right-2 text-[9px] text-zinc-500 font-mono">
                      Shot {idx + 1}
                    </span>
                  </div>
                </div>

                {/* System Generation Indicator */}
                <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span>System: Generated Shot {idx + 1}</span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(shot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
        )}

        {/* Async Loading Indicator */}
        {loading && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[70%] bg-zinc-800/40 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-400 select-none">
                <p className="font-light leading-relaxed italic">Generating next shot content...</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
              <span>Gemini Omni is generating...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form area */}
      <div className="p-6 border-t border-zinc-800 bg-zinc-950">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Tag Highlighter Input */}
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900 focus-within:border-zinc-700 transition-all overflow-hidden shadow-inner">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                editingShot
                  ? "Describe what you want to edit in this shot (e.g. 'Make it red alert lighting')..."
                  : "Type prompt for new shot (e.g. '@hero walks on @bridge of @spaceship, wide shot')..."
              }
              rows={3}
              disabled={loading}
              className="w-full text-sm bg-transparent border-0 outline-none p-3 resize-none text-zinc-200 placeholder-zinc-600 focus:ring-0 focus:outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            {/* Send Button */}
            <div className="flex justify-between items-center p-2 border-t border-zinc-900 bg-zinc-950/50">
              <div className="flex items-center gap-3 pl-2">
                <span className="text-[10px] text-zinc-600 font-medium select-none">
                  Press Enter to send
                </span>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={enhancing || !message.trim() || loading}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors flex items-center gap-0.5"
                >
                  {enhancing ? 'Enhancing...' : 'Enhance ✨'}
                </button>
              </div>
              <button
                type="submit"
                disabled={!message.trim() || loading}
                className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1"
              >
                <span>Send</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tags Check Chips */}
          {(resolvedTags.length > 0 || unknownTags.length > 0) && (
            <div className="flex flex-wrap gap-2 items-center select-none pt-1">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Tags:</span>

              {/* Resolved Green Chips */}
              {resolvedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium"
                >
                  <span className="w-1 h-1 rounded-full bg-emerald-400"></span>@{tag}
                </span>
              ))}

              {/* Unknown Amber Warning Chips */}
              {unknownTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-medium"
                  title="Tag handle does not match any current project assets"
                >
                  <span className="w-1 h-1 rounded-full bg-amber-400"></span>@{tag} (unknown)
                </span>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
