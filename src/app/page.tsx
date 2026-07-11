'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/types';
import { getBrowserSupabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      const json = await res.json();
      setProjects(json.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProjectName.trim()) return;
    setCreateLoading(true);
    
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createProjectName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create project');
      
      // Navigate to the newly created project
      router.push(`/project/${json.data.id}`);
    } catch (err: any) {
      alert(err.message);
      setCreateLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    window.location.href = '/landing';
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 gap-4 h-screen">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <p className="text-sm font-medium tracking-wide uppercase font-mono animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-y-auto">
      {/* Background Gradients */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/30 font-mono">
            D
          </div>
          <span className="text-lg font-bold tracking-tight text-white bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Director's Chair Dashboard
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 rounded-xl transition-all duration-200"
        >
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        {error && (
          <div className="mb-8 p-4 bg-rose-950/30 border border-rose-900/50 rounded-2xl flex items-start gap-4">
            <div className="text-rose-400 text-xl">⚠️</div>
            <div>
              <h3 className="text-rose-400 font-semibold">Error Loading Projects</h3>
              <p className="text-zinc-400 text-sm">{error}</p>
              {error.includes('column') && (
                <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-[10px] font-mono text-indigo-300 select-all cursor-pointer">
                  {`alter table projects \nadd column if not exists user_id uuid \nreferences auth.users(id) on delete cascade;`}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
              Your Workspaces
            </h1>
            <p className="text-zinc-400 text-sm md:text-base">
              Select a project to continue directing, or create a new one.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-600/20 group"
          >
            <span>Create New Project</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Mobile Create Button (Shows up first on mobile) */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="md:hidden flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-3xl transition-all group min-h-[200px]"
          >
            <div className="w-12 h-12 bg-zinc-800 group-hover:bg-indigo-600 rounded-full flex items-center justify-center text-xl mb-4 transition-colors">
              +
            </div>
            <span className="font-semibold text-zinc-300 group-hover:text-white transition-colors">Create New Project</span>
          </button>

          {projects.map(project => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="group block p-6 bg-zinc-900/40 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-900/80 rounded-3xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 min-h-[200px] flex flex-col justify-between relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-zinc-800 group-hover:bg-indigo-600/20 rounded-2xl flex items-center justify-center text-xl mb-6 transition-colors border border-zinc-700/50 group-hover:border-indigo-500/30">
                  🎬
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{project.name}</h3>
                <p className="text-xs text-zinc-500">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="relative z-10 flex items-center justify-end">
                <span className="text-xs font-semibold text-zinc-400 group-hover:text-indigo-400 flex items-center gap-1">
                  Open Workspace <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </div>
            </Link>
          ))}

          {projects.length === 0 && !error && !loading && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-xl">
                ✨
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No projects yet</h3>
              <p className="text-zinc-400 max-w-sm">Create your first video project to get started with the Director's Chair.</p>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal overlay */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-indigo-950/40 border border-indigo-900/40 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              🚀
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">New Project</h2>
            <p className="text-sm text-zinc-400 mb-6">Give your video project a name.</p>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <input
                  type="text"
                  autoFocus
                  value={createProjectName}
                  onChange={e => setCreateProjectName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none rounded-xl text-sm transition-colors text-white"
                  placeholder="e.g. Space Odyssey, Commercial"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  {createLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
