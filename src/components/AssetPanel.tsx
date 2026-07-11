'use client';

import React, { useState } from 'react';
import type { Asset } from '@/lib/types';

interface AssetPanelProps {
  projectId: string;
  assets: Asset[];
  onAssetCreated: (newAsset: Asset) => void;
  onAssetDeleted: (id: string) => void;
  onReusePrompt: (prompt: string) => void;
}

export default function AssetPanel({
  projectId,
  assets,
  onAssetCreated,
  onAssetDeleted,
  onReusePrompt,
}: AssetPanelProps) {
  const [activeForm, setActiveForm] = useState<'none' | 'generate' | 'upload'>('none');
  const [genPrompt, setGenPrompt] = useState('');
  const [genTag, setGenTag] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTag, setUploadTag] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Validate tag input
  const validateTag = (tag: string): string | null => {
    if (!tag) return 'Tag handle is required';
    if (!/^[A-Za-z0-9_]+$/.test(tag)) return 'Tag must contain alphanumeric and underscores only';
    const tagExists = assets.some(a => a.tag.toLowerCase() === tag.toLowerCase());
    if (tagExists) return `Tag @${tag} is already in use`;
    return null;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);

    const tagErr = validateTag(genTag);
    if (tagErr) {
      setGenError(tagErr);
      return;
    }

    if (!genPrompt.trim()) {
      setGenError('Prompt cannot be empty');
      return;
    }

    setGenLoading(true);
    try {
      const res = await fetch('/api/assets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt: genPrompt, tag: genTag }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to generate image');
      }

      onAssetCreated(json.data);
      setGenPrompt('');
      setGenTag('');
      setActiveForm('none');
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    const tagErr = validateTag(uploadTag);
    if (tagErr) {
      setUploadError(tagErr);
      return;
    }

    if (!uploadFile) {
      setUploadError('Please select a file');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('projectId', projectId);
      formData.append('tag', uploadTag);

      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Upload failed');
      }

      onAssetCreated(json.data);
      setUploadFile(null);
      setUploadTag('');
      setActiveForm('none');
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to delete asset');
      }
      onAssetDeleted(assetId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!genPrompt.trim()) return;
    setEnhancing(true);
    setGenError(null);
    try {
      const res = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to enhance prompt');
      }
      setGenPrompt(json.data.enhanced);
    } catch (err: any) {
      setGenError('Enhancer error: ' + err.message);
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="w-[290px] border-r border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
        <h3 className="font-semibold text-zinc-200 text-sm tracking-wide uppercase">Asset Studio</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
          {assets.length} items
        </span>
      </div>

      {/* Buttons to open forms */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-zinc-900 bg-zinc-900/10">
        <button
          onClick={() => setActiveForm(prev => (prev === 'generate' ? 'none' : 'generate'))}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
            activeForm === 'generate'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Generate
        </button>
        <button
          onClick={() => setActiveForm(prev => (prev === 'upload' ? 'none' : 'upload'))}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
            activeForm === 'upload'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>
      </div>

      {/* Forms Area */}
      {activeForm !== 'none' && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/20">
          {activeForm === 'generate' && (
            <form onSubmit={handleGenerate} className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Generate Image (NB2 Lite)</h4>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-500 font-semibold uppercase">Prompt</label>
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={enhancing || !genPrompt.trim()}
                    className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 disabled:opacity-40"
                  >
                    {enhancing ? 'Enhancing...' : 'Enhance ✨'}
                  </button>
                </div>
                <textarea
                  value={genPrompt}
                  onChange={e => setGenPrompt(e.target.value)}
                  placeholder="e.g. A futuristic cyberpunk character..."
                  rows={2}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-semibold mb-1 uppercase">Tag Handle</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-zinc-500 text-xs">@</span>
                  <input
                    value={genTag}
                    onChange={e => setGenTag(e.target.value.trim().replace(/[^A-Za-z0-9_]/g, ''))}
                    placeholder="hero_avatar"
                    type="text"
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded p-1.5 pl-6 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>
              {genError && <p className="text-[11px] text-rose-500 leading-tight">{genError}</p>}
              <button
                type="submit"
                disabled={genLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {genLoading ? 'Generating...' : 'Start Generation'}
              </button>
            </form>
          )}

          {activeForm === 'upload' && (
            <form onSubmit={handleUpload} className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Upload Local File</h4>
              <div>
                <label className="block text-[10px] text-zinc-500 font-semibold mb-1 uppercase">File</label>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-semibold mb-1 uppercase">Tag Handle</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-zinc-500 text-xs">@</span>
                  <input
                    value={uploadTag}
                    onChange={e => setUploadTag(e.target.value.trim().replace(/[^A-Za-z0-9_]/g, ''))}
                    placeholder="bg_spaceship"
                    type="text"
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded p-1.5 pl-6 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>
              {uploadError && <p className="text-[11px] text-rose-500 leading-tight">{uploadError}</p>}
              <button
                type="submit"
                disabled={uploadLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {uploadLoading ? 'Uploading...' : 'Upload Asset'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Asset Cards Stack */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {assets.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl p-4 text-center">
            <svg className="w-8 h-8 text-zinc-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-zinc-500 text-xs">No assets created yet.</p>
            <p className="text-[10px] text-zinc-600 mt-1">Upload files or generate images to begin referencing them with @tags.</p>
          </div>
        ) : (
          assets.map(asset => (
            <div
              key={asset.id}
              className="group relative border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/70 rounded-xl overflow-hidden transition-all duration-200"
            >
              {/* Delete Button */}
              <button
                onClick={() => handleDeleteAsset(asset.id)}
                className="absolute top-2 left-2 z-10 p-1 bg-black/60 hover:bg-rose-600/80 text-zinc-400 hover:text-white rounded border border-zinc-700/50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete asset"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {/* Media Thumbnail */}
              <div className="aspect-video w-full relative bg-zinc-950 flex items-center justify-center overflow-hidden">
                {asset.type === 'video' ? (
                  <video src={asset.url} controls={false} className="w-full h-full object-cover" />
                ) : asset.type === 'audio' ? (
                  <div className="p-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                ) : (
                  <img src={asset.url} alt={asset.tag} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                )}

                {/* Source Badge */}
                <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm border border-zinc-700/50 text-zinc-400">
                  {asset.source}
                </span>
              </div>

              {/* Asset Info */}
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 select-all cursor-pointer">
                    @{asset.tag}
                  </span>
                  <div className="flex items-center gap-2">
                    {asset.prompt && (
                      <button
                        onClick={() => onReusePrompt(asset.prompt || '')}
                        className="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 transition-colors"
                        title="Reuse prompt in chat"
                      >
                        Reuse 🔄
                      </button>
                    )}
                    <span className="text-[10px] text-zinc-500 font-medium capitalize">{asset.type}</span>
                  </div>
                </div>
                {asset.prompt && (
                  <p className="text-[10px] text-zinc-500 mt-1.5 truncate italic" title={asset.prompt}>
                    "{asset.prompt}"
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
