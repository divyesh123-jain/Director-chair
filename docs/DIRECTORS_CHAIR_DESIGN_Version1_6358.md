# Director's Chair — Technical Design & Build Specification

> **For the AI coding agent:** This document is a complete, self-contained specification for building the entire application. Build it exactly as specified. Where an external model API signature is unknown, implement against the **provider abstraction interface** defined in Section 8 and use the **mock implementation** as the default so the app runs end-to-end without real API keys. Do not skip the mock — it is required for the demo fallback.

---

## 1. Product Summary

**Director's Chair** is a conversational, multi-shot video creation studio. A user:

1. **Creates/uploads assets** (images via NB2 Lite text-to-image, or manual upload). Each asset gets an `@tag`.
2. **Generates video shots through conversation**, referencing assets with `@tags` (e.g. `"@hero walks through @night_bg, cinematic"`). Shots form an ordered **timeline** and maintain **character/style consistency** by passing prior-shot context to the video model.
3. **Edits shots conversationally** (non-destructive), e.g. `"make it red alert lighting"`, producing new versions that preserve everything except the requested change.

### The 3 judging gaps this build MUST close (implemented cheaply):
- **G1 — Physics/lighting visibility:** The UI must surface a "physics-aware" edit path and the app must send an explicit *physical-consistency instruction* to the model. A dedicated demo turn shows shadows/gravity behaving correctly.
- **G2 — Provable consistency:** Every shot card shows a **Context Inspector** chip revealing exactly what context was passed (prior shot ref + resolved @tags + consistency instruction). This proves the orchestration is ours.
- **G3 — Narrative timeline:** A **"Play Timeline"** button plays all shots back-to-back as one assembled sequence.

---

## 2. Tech Stack (fixed — do not substitute)

- **Framework:** Next.js 14+ (App Router), TypeScript, React Server + Client Components.
- **Styling:** Tailwind CSS. Minimal, dark, cinematic theme.
- **Backend:** Next.js Route Handlers (`app/api/**/route.ts`).
- **DB + Storage:** Supabase (Postgres + Storage bucket).
- **State (client):** React Query (`@tanstack/react-query`) for server state; local component state otherwise.
- **Validation:** `zod` for all API input parsing.
- **Package manager:** `npm`.

Do NOT add auth, RLS, tests, or CI. This is a hackathon build optimized for a live demo.

---

## 3. Repository Structure

```
directors-chair/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                      # main 3-panel studio
│  ├─ providers.tsx                 # React Query provider
│  └─ api/
│     ├─ projects/route.ts          # POST create, GET list
│     ├─ projects/[id]/route.ts     # GET project bundle (assets + shots)
│     ├─ assets/generate/route.ts   # POST NB2 Lite image gen
│     ├─ assets/upload/route.ts     # POST manual upload
│     ├─ shots/generate/route.ts    # POST new shot (Omni Flash)
│     └─ shots/edit/route.ts        # POST edit shot (non-destructive)
├─ components/
│  ├─ AssetPanel.tsx                # left: asset list + generate/upload
│  ├─ ConversationPanel.tsx         # center: chat input + message log
│  ├─ TimelinePanel.tsx             # right: shot cards + Play Timeline
│  ├─ ShotCard.tsx                  # single shot: video + context inspector
│  ├─ ContextInspector.tsx          # G2: shows passed context
│  ├─ TagInput.tsx                  # textarea with @tag highlighting
│  └─ TimelinePlayer.tsx            # G3: back-to-back playback modal
├─ lib/
│  ├─ supabase.ts                   # server + client supabase clients
│  ├─ types.ts                      # shared TS types (mirror DB)
│  ├─ tags.ts                       # @tag parser + resolver
│  ├─ prompt.ts                     # builds model payloads + instructions
│  └─ ai/
│     ├─ provider.ts                # AIProvider interface (Section 8)
│     ├─ mock.ts                    # MOCK impl (default, demo fallback)
│     ├─ nb2.ts                     # NB2 Lite impl (image)
│     └─ omni.ts                    # Omni Flash impl (video)
├─ supabase/
│  └─ schema.sql                    # run once in Supabase SQL editor
├─ public/
│  └─ demo/                         # pre-generated fallback assets/videos
├─ .env.example
├─ tailwind.config.ts
├─ package.json
└─ README.md
```

---

## 4. Data Model

### 4.1 SQL — `supabase/schema.sql`

```sql
-- Run in Supabase SQL editor. RLS intentionally OFF for hackathon.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled Project',
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null check (type in ('image','video','audio')),
  tag text not null,                       -- @tag handle, unique per project (enforced in app)
  url text not null,
  prompt text,
  source text not null check (source in ('nb2','upload')),
  created_at timestamptz not null default now()
);

create table if not exists shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  turn_index int not null,                 -- order in the timeline
  prompt text not null,                    -- user's raw message
  referenced_asset_ids uuid[] not null default '{}',
  parent_shot_id uuid references shots(id),-- null=new shot, set=edit
  output_video_url text,
  -- G2: persisted so the Context Inspector shows exactly what was sent
  context_summary jsonb,                    -- { references:[], consistencyInstruction, physicsInstruction, baseVideoUrl }
  status text not null default 'pending' check (status in ('pending','generating','done','error')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assets_project on assets(project_id);
create index if not exists idx_shots_project on shots(project_id);

-- Storage bucket 'assets' must be created (public) — see README.
```

### 4.2 TypeScript — `lib/types.ts`

```ts
export type AssetType = 'image' | 'video' | 'audio';
export type AssetSource = 'nb2' | 'upload';
export type ShotStatus = 'pending' | 'generating' | 'done' | 'error';

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

export interface ContextSummary {
  references: { assetId: string; tag: string; url: string; type: AssetType }[];
  consistencyInstruction: string | null; // present when prior shots exist
  physicsInstruction: string;            // ALWAYS present (G1)
  baseVideoUrl: string | null;           // present for edits
  parentShotId: string | null;
}

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

export interface ProjectBundle {
  project: { id: string; name: string; created_at: string };
  assets: Asset[];
  shots: Shot[];
}
```

---

## 5. Core Logic Specs

### 5.1 `lib/tags.ts` — @tag parsing & resolution

```ts
import type { Asset } from './types';

// Extract unique tag handles (without '@') from a message. Tags: @word, @word_word, @word123
export function extractTags(message: string): string[] {
  const matches = [...message.matchAll(/@([A-Za-z0-9_]+)/g)].map(m => m[1]);
  return Array.from(new Set(matches));
}

// Resolve tags to assets in the current project. Unknown tags are ignored (but returned for UI warning).
export function resolveTags(message: string, assets: Asset[]) {
  const tags = extractTags(message);
  const byTag = new Map(assets.map(a => [a.tag.toLowerCase(), a]));
  const resolved: Asset[] = [];
  const unknown: string[] = [];
  for (const t of tags) {
    const a = byTag.get(t.toLowerCase());
    if (a) resolved.push(a);
    else unknown.push(t);
  }
  return { resolved, unknown };
}
```

### 5.2 `lib/prompt.ts` — payload + instruction builder (implements G1 & G2)

```ts
import type { Asset, Shot, ContextSummary } from './types';

// ALWAYS sent to the video model. This is the cheap G1 fix.
export const PHYSICS_INSTRUCTION =
  'Respect real-world physical dynamics: consistent gravity, correct light source direction and cast shadows, and coherent perspective across the shot. Do not composite; render a physically plausible scene.';

// Sent only when a prior shot exists (multi-shot consistency).
export function consistencyInstruction(priorShot: Shot | null): string | null {
  if (!priorShot) return null;
  return 'Maintain visual continuity with the previous shot: same characters (identity, wardrobe, proportions), same environment style, and consistent lighting mood. Only change what the new instruction explicitly requests.';
}

// Sent for edits: change ONE thing, preserve the rest (anti-reroll).
export const EDIT_PRESERVE_INSTRUCTION =
  'This is a non-destructive edit of the provided base video. Change ONLY the element or property described in the instruction. Preserve character identity, composition, motion, and all unrequested elements exactly.';

export interface VideoGenInput {
  prompt: string;
  referencedAssets: Asset[];
  priorShot: Shot | null;      // for consistency
  baseVideoUrl: string | null; // for edits
  isEdit: boolean;
}

// Build the structured payload for the AIProvider AND the ContextSummary for the UI (G2).
export function buildVideoContext(input: VideoGenInput): {
  instructions: string[];
  contextSummary: ContextSummary;
} {
  const instructions: string[] = [PHYSICS_INSTRUCTION];
  const cons = consistencyInstruction(input.priorShot);
  if (cons) instructions.push(cons);
  if (input.isEdit) instructions.push(EDIT_PRESERVE_INSTRUCTION);

  const contextSummary: ContextSummary = {
    references: input.referencedAssets.map(a => ({
      assetId: a.id, tag: a.tag, url: a.url, type: a.type,
    })),
    consistencyInstruction: cons,
    physicsInstruction: PHYSICS_INSTRUCTION,
    baseVideoUrl: input.baseVideoUrl,
    parentShotId: input.isEdit && input.priorShot ? input.priorShot.id : null,
  };

  return { instructions, contextSummary };
}
```

---

## 6. API Route Specifications

All routes: parse body with `zod`, use the **server** supabase client, return JSON `{ data }` or `{ error }` with proper status codes.

### 6.1 `POST /api/projects` — create project
- **Body:** `{ name?: string }`
- **Action:** insert project. If none exists on first load, client auto-creates one named "Director's Chair Demo".
- **Returns:** `{ data: Project }`

### 6.2 `GET /api/projects/[id]` — project bundle
- **Returns:** `{ data: ProjectBundle }` — project + assets (by created_at asc) + shots (by turn_index asc).

### 6.3 `POST /api/assets/generate` — NB2 Lite image
- **Body:** `{ projectId: string, prompt: string, tag: string }`
- **Validation:** tag must match `^[A-Za-z0-9_]+$` and be unique within project (case-insensitive) → 409 if taken.
- **Action:**
  1. `provider.generateImage({ prompt })` → returns bytes/url.
  2. Upload to Supabase Storage `assets/{projectId}/{uuid}.png` → public URL.
  3. Insert asset row (`type:'image'`, `source:'nb2'`).
- **Returns:** `{ data: Asset }`

### 6.4 `POST /api/assets/upload` — manual upload
- **Body:** `multipart/form-data` with `file`, `projectId`, `tag`.
- **Action:** infer type from mime (image/video/audio), upload to storage, insert row `source:'upload'`.
- **Returns:** `{ data: Asset }`

### 6.5 `POST /api/shots/generate` — new shot (Omni Flash) ⭐ core
- **Body:** `{ projectId: string, message: string }`
- **Action:**
  1. Load project assets + all shots.
  2. `resolveTags(message, assets)` → `referencedAssets`.
  3. `priorShot` = last shot with `parent_shot_id === null` and `status==='done'` (the most recent top-level shot in the timeline). May be null.
  4. `buildVideoContext({ prompt: message, referencedAssets, priorShot, baseVideoUrl: priorShot?.output_video_url ?? null, isEdit: false })`.
     - NOTE: for a *new* shot we pass the prior shot's video as a **soft reference for consistency**, not as an edit base. Pass it in `referenceVideos`, not `baseVideo`.
  5. Insert shot row `status:'generating'`, `turn_index = shots.length`, persist `context_summary`.
  6. Call `provider.generateVideo(...)` → `output_video_url`.
  7. Update row `status:'done'`, `output_video_url`. On failure → `status:'error'`, `error`.
- **Returns:** `{ data: Shot }`

### 6.6 `POST /api/shots/edit` — edit shot (non-destructive)
- **Body:** `{ projectId: string, parentShotId: string, message: string }`
- **Action:**
  1. Load parent shot (must be `status:'done'` with `output_video_url`).
  2. Resolve tags from message (allow adding new asset refs in an edit).
  3. `buildVideoContext({ prompt: message, referencedAssets, priorShot: parentShot, baseVideoUrl: parentShot.output_video_url, isEdit: true })`.
  4. Insert new shot: `parent_shot_id = parentShotId`, `turn_index = parentShot.turn_index` (edits share the timeline slot; version ordering by created_at), persist `context_summary`, `status:'generating'`.
  5. `provider.generateVideo(...)` with `baseVideo = parentShot.output_video_url`.
  6. Update `status:'done'` + url. On failure → error.
- **Returns:** `{ data: Shot }`

---

## 7. Frontend Specification

### 7.1 Layout — `app/page.tsx`
Three-panel flex layout, full viewport height, dark theme:
```
┌──────────────┬───────────────────────────┬──────────────────────┐
│ AssetPanel   │ ConversationPanel         │ TimelinePanel        │
│ (left, 280px)│ (center, flex-1)          │ (right, 420px)       │
│              │                           │                      │
│ [+ Generate] │  message log (scroll)     │ [▶ Play Timeline]    │
│ [⬆ Upload]   │                           │                      │
│ asset cards  │  ─────────────────────    │ ShotCard (v-stack)   │
│ w/ @tags     │  TagInput + Send          │ ShotCard             │
└──────────────┴───────────────────────────┴──────────────────────┘
```

### 7.2 `AssetPanel.tsx`
- "Generate" form: prompt textarea + tag input → `POST /api/assets/generate`.
- "Upload" form: file input + tag input → `POST /api/assets/upload`.
- Asset cards: thumbnail (image/video) + prominent `@tag` label + source badge (NB2 / Upload).
- Tag validation inline (alphanumeric/underscore, uniqueness).

### 7.3 `ConversationPanel.tsx` + `TagInput.tsx`
- `TagInput`: textarea that visually highlights `@tags`. Below it, a live **chip row** showing resolved tags (green) and unknown tags (amber warning). Simple dropdown suggestion of available tags when the last token starts with `@` (nice-to-have, cuttable).
- Message log renders each user message and a system line indicating which shot it produced.
- **Two send modes:**
  - If no shot is "selected for editing" → calls `/api/shots/generate` (new shot).
  - If a shot is selected (from TimelinePanel) → calls `/api/shots/edit` with `parentShotId`. Show a banner: *"Editing Shot N — changes preserve everything else."*

### 7.4 `TimelinePanel.tsx` + `ShotCard.tsx`
- Lists top-level shots by `turn_index`. Each `ShotCard`:
  - `<video controls>` of `output_video_url` (or spinner if `generating`, error state if failed).
  - "Edit this shot" button → sets edit-selection in ConversationPanel.
  - **Version stack:** if the shot has edit-children, show `v1 · v2 · v3` selectable tabs (order by created_at). Selecting a version updates the displayed video.
  - **`ContextInspector` (G2):** a collapsible "🔍 What we sent" section rendering `context_summary`:
    - Referenced assets (tag + thumb).
    - "Consistency: ON (references Shot N)" when present.
    - "Physics: ON" chip (always).
    - "Base video: Shot N v_" for edits.
- **`▶ Play Timeline` (G3):** opens `TimelinePlayer` modal that plays each top-level shot's latest version back-to-back (autoplay, muted, sequential via `onEnded`). This is the narrative closer.

### 7.5 `ContextInspector.tsx`
Pure presentational component taking `ContextSummary`. Renders compact chips. This is the cheap, high-leverage G2 feature — make it visually clean and obviously "engineered."

### 7.6 `TimelinePlayer.tsx`
Modal. Given ordered video URLs, plays them sequentially. On `onEnded` advance index; close on finish or ESC.

---

## 8. AI Provider Abstraction (CRITICAL)

> The real NB2 Lite / Omni Flash signatures may not be available at build time. Build against this interface. **Default to the mock** so the app runs fully offline for the demo. Selecting a provider is via env `AI_PROVIDER=mock|real`.

### 8.1 `lib/ai/provider.ts`
```ts
export interface GenerateImageArgs {
  prompt: string;
}
export interface GenerateImageResult {
  // Return EITHER a public URL or raw bytes; route handles upload.
  url?: string;
  bytes?: Buffer;
  contentType?: string; // e.g. 'image/png'
}

export interface GenerateVideoArgs {
  prompt: string;
  instructions: string[];      // physics/consistency/edit — joined by provider
  referenceImages: string[];   // asset image URLs (@tags)
  referenceVideos: string[];   // prior-shot video URLs (soft consistency)
  baseVideo: string | null;    // set for edits (non-destructive base)
}
export interface GenerateVideoResult {
  url?: string;
  bytes?: Buffer;
  contentType?: string; // e.g. 'video/mp4'
}

export interface AIProvider {
  generateImage(args: GenerateImageArgs): Promise<GenerateImageResult>;
  generateVideo(args: GenerateVideoArgs): Promise<GenerateVideoResult>;
}

export function getProvider(): AIProvider {
  // Lazy-select based on env to keep the app runnable without keys.
  if (process.env.AI_PROVIDER === 'real') {
    // Compose real image (nb2) + real video (omni) — see nb2.ts / omni.ts
    const { RealProvider } = require('./real');
    return new RealProvider();
  }
  const { MockProvider } = require('./mock');
  return new MockProvider();
}
```

### 8.2 `lib/ai/mock.ts` (default — required)
```ts
import type { AIProvider } from './provider';

// Returns pre-generated demo assets from /public/demo so the whole flow works offline.
// Cycles through a small set; adds a short delay to simulate generation.
export class MockProvider implements AIProvider {
  private delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  async generateImage() {
    await this.delay(800);
    return { url: `/demo/images/${pick(['hero.png','spaceship.png','bridge.png'])}`, contentType: 'image/png' };
  }
  async generateVideo() {
    await this.delay(1500);
    return { url: `/demo/videos/${pick(['shot1.mp4','shot2.mp4','shot3.mp4','edit.mp4'])}`, contentType: 'video/mp4' };
  }
}
function pick<T>(a: T[]): T { return a[Math.floor(Math.random()*a.length)]; }
```
> The agent must add placeholder files under `/public/demo/` (small looping mp4s / pngs). If real media is unavailable, generate simple colored-gradient mp4/png placeholders programmatically or include tiny stub files, and document in README that the team should replace them with real pre-generated demo clips.

### 8.3 `lib/ai/nb2.ts` and `lib/ai/omni.ts` (real impls — stubs)
- Implement the `AIProvider` methods calling the actual Gemini NB2 Lite (image) and Omni Flash (video) endpoints.
- Read keys from `GEMINI_API_KEY` (and any model IDs from env).
- **Combine `instructions.join('\n')` into the model's system/prompt field.** Pass `referenceImages`, `referenceVideos`, `baseVideo` per the real API's multimodal input format.
- Leave a clearly-marked `// TODO: map to real Omni Flash request shape` block. The rest of the app must NOT depend on these details.

---

## 9. Environment — `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, for storage upload + inserts
AI_PROVIDER=mock                  # mock | real
GEMINI_API_KEY=                   # only needed when AI_PROVIDER=real
NB2_MODEL_ID=nb2-lite-preview
OMNI_MODEL_ID=gemini-omni-flash-preview
```

---

## 10. Build Order (agent should follow this sequence)

1. Scaffold Next.js + Tailwind + deps (`@supabase/supabase-js`, `@tanstack/react-query`, `zod`).
2. Add `lib/types.ts`, `lib/supabase.ts`, `supabase/schema.sql`, `.env.example`.
3. Implement `lib/ai/*` with **mock as default**, add `/public/demo` placeholders.
4. Implement `lib/tags.ts`, `lib/prompt.ts`.
5. Implement all API routes (Section 6) with zod validation.
6. Build UI panels (Section 7), wiring via React Query.
7. Implement `ContextInspector` (G2), `TimelinePlayer` (G3).
8. Ensure the app runs end-to-end with `AI_PROVIDER=mock` and **no real keys**.
9. Write `README.md` (Section 11).

---

## 11. README requirements
- Setup: `pnpm i`, create Supabase project, run `supabase/schema.sql`, create public `assets` storage bucket, copy `.env.example` → `.env.local`.
- Run with mock: `AI_PROVIDER=mock pnpm dev` (works with no AI keys).
- Switch to real models: set `AI_PROVIDER=real` + `GEMINI_API_KEY`, implement TODOs in `nb2.ts`/`omni.ts`.
- Replace `/public/demo/*` with real pre-generated clips before the live demo (fallback path).
- **Demo script** (include verbatim — see Section 12).

---

## 12. Demo Script (put in README — this is the graded performance)

> Frame the pain first, then close all three gaps.

1. **Pain:** *"Normally if shot 3 is wrong, you re-roll and lose shots 1 and 2. Watch us keep the whole timeline intact."*
2. **Assets:** Generate `@hero` (NB2 Lite), upload `@spaceship`. → *"Some AI-generated, some ours."*
3. **Shot 1:** `@hero stands on the bridge of the @spaceship, cinematic wide shot.` → open **Context Inspector**: *"Physics ON — watch the shadows."* (G1)
4. **Shot 2 (consistency):** `Now a close-up of @hero, running, from behind, at night.` → Context Inspector shows *"Consistency: references Shot 1."* → *"Different angle and lighting, same character — that's our orchestration, not luck."* (G2)
5. **Edit (anti-reroll):** Edit Shot 1 → `Make it red alert lighting.` → version `v2` appears; everything else preserved. (anti-reroll + G1 lighting)
6. **Close (narrative):** Click **▶ Play Timeline** → all shots play as one sequence. *"One conversation. A consistent, physically coherent, multi-shot scene — never started from scratch."* (G3)

---

## 13. Non-Goals (do NOT build)
- Authentication, user accounts, RLS.
- Real-time collaboration.
- Tests, Storybook, CI/CD.
- Multiple projects UI (single hardcoded/default project is fine).
- Audio mixing/timeline scrubbing beyond sequential playback.

---

## 14. Acceptance Criteria (the build is "done" when)
- [ ] App runs with `AI_PROVIDER=mock` and zero real API keys.
- [ ] User can generate (NB2) and upload assets, each with a unique `@tag`.
- [ ] Typing `@tag`s in the conversation resolves to assets (green chips; unknown = amber).
- [ ] New shots append to the timeline and persist `context_summary`.
- [ ] Prior-shot context is passed on shot 2+ and shown in the Context Inspector (G2).
- [ ] A physics instruction is ALWAYS sent and visible as a "Physics ON" chip (G1).
- [ ] Editing a shot creates a non-destructive version (`parent_shot_id` set), preserving the original.
- [ ] "Play Timeline" plays all top-level shots back-to-back (G3).
- [ ] README includes setup + the exact demo script.