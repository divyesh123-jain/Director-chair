'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AssetPanel from '@/components/AssetPanel';
import ConversationPanel from '@/components/ConversationPanel';
import TimelinePanel from '@/components/TimelinePanel';
import type { Asset, Shot, Project } from '@/lib/types';
import { getBrowserSupabase } from '@/lib/supabase';

export default function Page() {
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectLoading, setCreateProjectLoading] = useState(false);

  const handleCreateFirstProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProjectName.trim()) return;
    setCreateProjectLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createProjectName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create project');
      
      setProject(json.data);
      await refreshProjectData(json.data.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateProjectLoading(false);
    }
  };

  // 1. Fetch project bundle
  const refreshProjectData = useCallback(async (projId: string) => {
    try {
      const res = await fetch(`/api/projects/${projId}`);
      if (!res.ok) throw new Error('Failed to load project details');
      const json = await res.json();
      setAssets(json.data.assets || []);
      setShots(json.data.shots || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 2. Initialize project on load
  useEffect(() => {
    async function init() {
      try {
        // Fetch all projects
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to load projects');
        const json = await res.json();
        const existing = json.data || [];

        let activeProject = existing[0];
        if (activeProject) {
          setProject(activeProject);
          await refreshProjectData(activeProject.id);
        }
      } catch (err: any) {
        console.error('Initialization error:', err);
        setInitError(err.message || 'Failed to initialize workspace');
      } finally {
        setInitializing(false);
      }
    }
    init();
  }, [refreshProjectData]);

  // Handle new asset generation/upload locally
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

  // Handle conversational action from the chat input
  const handleSendPrompt = async (message: string, isEdit: boolean, parentShotId?: string) => {
    if (!project) return;
    setLoading(true);

    const apiPath = isEdit ? '/api/shots/edit' : '/api/shots/generate';
    const body = isEdit
      ? { projectId: project.id, parentShotId, message }
      : { projectId: project.id, message };

    // Optimistically insert a generating shot so the UI shows active generation
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
    setEditingShot(null); // clear editing state once submitted

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

      // Replace optimistic placeholder with real completed shot
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
        // Full sync with DB state
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
            <h2 className="text-lg font-bold text-white">Database Migration Required</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The workspace failed to load because the database is missing the <code>user_id</code> column on the <code>projects</code> table.
            </p>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-[10px] text-left font-mono text-indigo-300 w-full overflow-x-auto select-all cursor-pointer" title="Click to select all">
{`alter table projects 
add column if not exists user_id uuid 
references auth.users(id) on delete cascade;`}
          </div>
          <p className="text-[10px] text-zinc-500">
            Run the SQL query above in your <b>Supabase Dashboard &gt; SQL Editor</b>, then click refresh.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-600/20"
          >
            Refresh Workspace 🔄
          </button>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <p className="text-sm font-medium tracking-wide uppercase font-mono animate-pulse">Initializing Studio Workspace...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 p-6">
        {/* Dynamic Background Gradients */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-md w-full bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl text-center space-y-6 backdrop-blur-md shadow-2xl">
          <div className="w-16 h-16 bg-indigo-950/40 border border-indigo-900/40 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-indigo-650/20">
            🎬
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Create Your First Project</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Name your project workspace to get started. You'll be able to upload assets, generate images, and compose multi-shot stories.
            </p>
          </div>

          <form onSubmit={handleCreateFirstProject} className="space-y-4">
            <div className="text-left">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Project Name</label>
              <input
                type="text"
                value={createProjectName}
                onChange={e => setCreateProjectName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700/60 focus:border-indigo-500/80 focus:outline-none rounded-xl text-sm transition-colors text-white"
                placeholder="e.g. Space Odyssey, Sci-Fi Film"
              />
            </div>

            <button
              type="submit"
              disabled={createProjectLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all duration-200 mt-2 shadow-lg shadow-indigo-600/20"
            >
              {createProjectLoading ? 'Creating Workspace...' : 'Create Project 🚀'}
            </button>
          </form>

          <div className="flex justify-center pt-2">
            <button
              onClick={async () => {
                const supabase = getBrowserSupabase();
                await supabase.auth.signOut();
                window.location.href = '/landing';
              }}
              className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors font-semibold"
            >
              Sign Out / Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-950 font-sans">
      {/* Global Top Banner */}
      <header className="h-[56px] border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
            D
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Director's Chair
            </h1>
          </div>
        </div>

        {/* Project Name Indicator & Status */}
        <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Project: {project?.name}</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            Provider: <span className="text-indigo-400 font-semibold uppercase">{process.env.NEXT_PUBLIC_AI_PROVIDER || 'mock'}</span>
          </div>
          <button
            onClick={async () => {
              const supabase = getBrowserSupabase();
              await supabase.auth.signOut();
              window.location.href = '/landing';
            }}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-700/50 rounded-lg text-xs font-semibold transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Three Panel Studio Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Asset Panel */}
        <AssetPanel
          projectId={project?.id || ''}
          assets={assets}
          onAssetCreated={handleAssetCreated}
          onAssetDeleted={handleAssetDeleted}
          onReusePrompt={(p) => setMessage(p)}
        />

        {/* Center: Conversation Log */}
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

        {/* Right: Timeline Panel */}
        <TimelinePanel
          shots={shots}
          onSelectForEdit={setEditingShot}
          onDeleteShot={handleDeleteShot}
          onReusePrompt={(p) => setMessage(p)}
          isEditingActive={!!editingShot}
        />
      </main>
    </div>
  );
}
