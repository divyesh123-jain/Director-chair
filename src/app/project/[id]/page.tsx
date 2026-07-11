'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import AssetPanel from '@/components/AssetPanel';
import ConversationPanel from '@/components/ConversationPanel';
import TimelinePanel from '@/components/TimelinePanel';
import type { Asset, Shot, Project } from '@/lib/types';
import { getBrowserSupabase } from '@/lib/supabase';

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const refreshProjectData = useCallback(async (projId: string) => {
    try {
      const res = await fetch(`/api/projects/${projId}`);
      if (!res.ok) {
        if (res.status === 404 || res.status === 403) {
          window.location.href = '/';
          return;
        }
        throw new Error('Failed to load project details');
      }
      const json = await res.json();
      setProject(json.data.project);
      setAssets(json.data.assets || []);
      setShots(json.data.shots || []);
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || 'Failed to load project');
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    refreshProjectData(id);
  }, [id, refreshProjectData]);

  useEffect(() => {
    const hasGenerating = shots.some(s => s.status === 'generating' || s.status === 'pending');
    if (!hasGenerating || !project) return;

    const interval = setInterval(() => {
      refreshProjectData(project.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [shots, project, refreshProjectData]);

  const handleRegenerate = async (shotId: string) => {
    if (!project) return;
    setLoading(true);
    try {
      const res = await fetch('/api/shots/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, shotId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Regeneration failed');
      setShots(prev => [...prev, json.data]);
      await refreshProjectData(project.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetCreated = (newAsset: Asset) => {
    setAssets(prev => [...prev, newAsset]);
  };

  const handleAssetDeleted = (deletedId: string) => {
    setAssets(prev => prev.filter(a => a.id !== deletedId));
  };

  const handleDeleteShot = async (shotId: string) => {
    if (!confirm('Are you sure you want to delete this shot version? Any child edits built on this version will also be deleted.')) return;
    try {
      const res = await fetch(`/api/shots/${shotId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to delete shot');
      }
      if (project) {
        await refreshProjectData(project.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendPrompt = async (message: string, isEdit: boolean, parentShotId?: string) => {
    if (!project) return;
    setLoading(true);

    const apiPath = isEdit ? '/api/shots/edit' : '/api/shots/generate';
    const body = isEdit
      ? { projectId: project.id, parentShotId, message }
      : { projectId: project.id, message };

    const tempId = crypto.randomUUID();
    const tempShot: Shot = {
      id: tempId,
      project_id: project.id,
      turn_index: isEdit
        ? (shots.find(s => s.id === parentShotId)?.turn_index ?? shots.length)
        : shots.filter(s => s.parent_shot_id === null).length,
      prompt: message,
      referenced_asset_ids: [],
      parent_shot_id: parentShotId || null,
      output_video_url: null,
      context_summary: null,
      status: 'generating',
      error: null,
      created_at: new Date().toISOString(),
    };

    setShots(prev => [...prev, tempShot]);
    setEditingShot(null);

    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to process video command');
      }

      setShots(prev => prev.map(s => (s.id === tempId ? json.data : s)));
    } catch (err: any) {
      console.error(err);
      setShots(prev =>
        prev.map(s =>
          s.id === tempId
            ? { ...s, status: 'error', error: err.message || 'Generation aborted' }
            : s
        )
      );
    } finally {
      setLoading(false);
      if (project) {
        await refreshProjectData(project.id);
      }
    }
  };

  if (initError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 p-6">
        <div className="max-w-md w-full bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl text-center space-y-6 backdrop-blur-md">
          <div className="w-16 h-16 bg-rose-950/30 text-rose-400 border border-rose-900/40 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-rose-950/20">
            ⚠️
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Error Loading Project</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {initError}
            </p>
          </div>
          <div className="flex gap-4 w-full">
            <Link
              href="/"
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all duration-200 text-center"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-600/20"
            >
              Retry 🔄
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (initializing || !project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 gap-4 h-screen">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <p className="text-sm font-medium tracking-wide uppercase font-mono animate-pulse">Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-950 font-sans">
      <header className="h-[56px] border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-4">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              D
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Director's Chair
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Project: {project.name}</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono hidden md:block">
            Provider: <span className="text-indigo-400 font-semibold uppercase">{process.env.NEXT_PUBLIC_AI_PROVIDER || 'mock'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <AssetPanel
          projectId={project.id}
          assets={assets}
          onAssetCreated={handleAssetCreated}
          onAssetDeleted={handleAssetDeleted}
          onReusePrompt={(p) => setMessage(p)}
        />
        <ConversationPanel
          assets={assets}
          shots={shots}
          editingShot={editingShot}
          onCancelEdit={() => setEditingShot(null)}
          onSend={handleSendPrompt}
          loading={loading}
          message={message}
          setMessage={setMessage}
        />
        <TimelinePanel
          shots={shots}
          projectId={project.id}
          onSelectForEdit={setEditingShot}
          onDeleteShot={handleDeleteShot}
          onReusePrompt={(p) => setMessage(p)}
          onRegenerate={handleRegenerate}
          isEditingActive={!!editingShot}
        />
      </main>
    </div>
  );
}
