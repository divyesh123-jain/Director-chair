-- =============================================================================
-- Director's Chair — Database Schema
-- =============================================================================
-- Run this in your Supabase project's SQL Editor (Dashboard > SQL Editor > New Query).
-- RLS is intentionally OFF — this is a hackathon build, no auth needed.
--
-- After running this, also create a PUBLIC storage bucket named "assets":
--   Dashboard > Storage > New Bucket > Name: "assets" > Public: ON
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─── Projects ────────────────────────────────────────────────────────────────

create table if not exists projects (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null default 'Untitled Project',
  created_at timestamptz not null default now()
);

-- ─── Assets (images, videos, audio — each with a unique @tag) ───────────────

create table if not exists assets (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  type       text        not null check (type in ('image', 'video', 'audio')),
  tag        text        not null,     -- @tag handle, unique per project (enforced in app)
  url        text        not null,
  prompt     text,
  source     text        not null check (source in ('nb2', 'upload')),
  created_at timestamptz not null default now()
);

-- ─── Shots (video generations + edits forming the timeline) ─────────────────

create table if not exists shots (
  id                  uuid        primary key default gen_random_uuid(),
  project_id          uuid        not null references projects(id) on delete cascade,
  turn_index          int         not null,                     -- order in the timeline
  prompt              text        not null,                     -- user's raw message
  referenced_asset_ids uuid[]     not null default '{}',
  parent_shot_id      uuid        references shots(id),        -- null = new shot, set = edit
  output_video_url    text,
  -- G2: persisted so the Context Inspector shows exactly what was sent
  context_summary     jsonb,                                    -- { references, consistencyInstruction, physicsInstruction, baseVideoUrl }
  status              text        not null default 'pending' check (status in ('pending', 'generating', 'done', 'error')),
  error               text,
  created_at          timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_assets_project on assets(project_id);
create index if not exists idx_shots_project  on shots(project_id);
