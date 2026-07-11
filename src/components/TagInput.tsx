'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface TagSuggestion {
  tag: string;
  kind: 'asset' | 'shot';
}

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  suggestions: TagSuggestion[];
  rows?: number;
  footer?: React.ReactNode;
}

function renderHighlightedText(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const isShot = /^@shot-\d+$/i.test(part);
      return (
        <span
          key={i}
          className={isShot ? 'text-amber-400 font-semibold' : 'text-indigo-400 font-semibold'}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function TagInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  suggestions,
  rows = 3,
  footer,
}: TagInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [filter, setFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getActiveToken = useCallback((text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const match = before.match(/@([A-Za-z0-9_-]*)$/);
    if (!match) return null;
    return { start: cursor - match[0].length, query: match[1] };
  }, []);

  const filtered = suggestions.filter(s =>
    s.tag.toLowerCase().startsWith(filter.toLowerCase())
  );

  const insertSuggestion = (tag: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const token = getActiveToken(value, cursor);
    if (!token) return;

    const before = value.slice(0, token.start);
    const after = value.slice(cursor);
    const next = `${before}@${tag} ${after}`;
    onChange(next);
    setShowDropdown(false);
    setFilter('');
    requestAnimationFrame(() => {
      const pos = before.length + tag.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const token = getActiveToken(next, e.target.selectionStart);
    if (token) {
      setFilter(token.query);
      setShowDropdown(true);
      setActiveIdx(0);
    } else {
      setShowDropdown(false);
      setFilter('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertSuggestion(filtered[activeIdx].tag);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  useEffect(() => {
    if (!showDropdown) setActiveIdx(0);
  }, [filter, showDropdown]);

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-900 focus-within:border-zinc-700 transition-all overflow-hidden shadow-inner">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 p-3 text-sm whitespace-pre-wrap break-words text-transparent overflow-hidden"
        style={{ fontFamily: 'inherit', lineHeight: '1.5' }}
      >
        {renderHighlightedText(value)}
        {'\n'}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="relative w-full text-sm bg-transparent border-0 outline-none p-3 resize-none text-zinc-200 placeholder-zinc-600 focus:ring-0 focus:outline-none caret-zinc-100"
        style={{ lineHeight: '1.5' }}
      />

      {showDropdown && filtered.length > 0 && (
        <div className="absolute left-3 right-3 bottom-full mb-1 z-20 bg-zinc-950 border border-zinc-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={`${s.kind}-${s.tag}`}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                insertSuggestion(s.tag);
              }}
              className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between ${
                i === activeIdx ? 'bg-indigo-600/20 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              <span>@{s.tag}</span>
              <span className="text-[9px] uppercase text-zinc-500">{s.kind}</span>
            </button>
          ))}
        </div>
      )}

      {footer && (
        <div className="flex justify-between items-center p-2 border-t border-zinc-900 bg-zinc-950/50">
          {footer}
        </div>
      )}
    </div>
  );
}
