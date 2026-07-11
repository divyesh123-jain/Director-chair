// =============================================================================
// Director's Chair — Shared TypeScript Types
// =============================================================================
// These types mirror the Supabase DB schema (supabase/schema.sql).
// Used across API routes, client components, and React Query hooks.
// =============================================================================

// ─── Enums ───────────────────────────────────────────────────────────────────

export type AssetType = 'image' | 'video' | 'audio';
export type AssetSource = 'nb2' | 'upload';
export type ShotStatus = 'pending' | 'generating' | 'done' | 'error';

// ─── Asset ───────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  project_id: string;
  type: AssetType;
  tag: string;              // without the leading '@'
  url: string;
  prompt: string | null;
  source: AssetSource;
  created_at: string;
}

// ─── Context Summary (G2 — What We Sent) ────────────────────────────────────
// Persisted as JSONB on each shot so the Context Inspector can show
// exactly what context was passed to the AI model.

export interface ContextSummary {
  references: {
    assetId: string;
    tag: string;
    url: string;
    type: AssetType;
  }[];
  consistencyInstruction: string | null; // present when prior shots exist
  physicsInstruction: string;            // ALWAYS present (G1)
  baseVideoUrl: string | null;           // present for edits
  parentShotId: string | null;
  interactionId?: string | null;         // present for stateful edits (Gemini interactions API)
}

// ─── Shot ────────────────────────────────────────────────────────────────────

export interface Shot {
  id: string;
  project_id: string;
  turn_index: number;
  prompt: string;
  referenced_asset_ids: string[];
  parent_shot_id: string | null;
  output_video_url: string | null;
  context_summary: ContextSummary | null;
  status: ShotStatus;
  error: string | null;
  created_at: string;
}

// ─── Project Bundle (returned by GET /api/projects/[id]) ────────────────────

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

export interface ProjectBundle {
  project: Project;
  assets: Asset[];
  shots: Shot[];
}
