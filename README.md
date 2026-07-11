# Director's Chair — AI Multi-Shot Video Creation Studio

A conversational, multi-shot video creation studio built for the Google Hackathon. This application lets users create and upload visual assets, generate visual shots through conversational prompts referencing those assets, edit individual shots in a non-destructive stateful sequence, and play back the entire narrative sequence back-to-back.

## Tech Stack
- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS (Minimal, dark, cinematic theme)
- **Database & Storage:** Supabase (Postgres + Storage bucket)
- **AI Models:** Gemini API
  - **Nano Banana 2 Lite** (`nb2-lite-preview` or `gemini-3.1-flash-image`) for image generation.
  - **Gemini Omni Flash** (`gemini-omni-flash-preview`) for stateful video generation and editing via the Interactions API.
- **State Management:** TanStack React Query (`@tanstack/react-query`)

---

## Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to create `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Get these from your Supabase Dashboard under **Settings > API**.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key (required for server-side Storage uploads and database bypass).
- `AI_PROVIDER`: Set to `mock` (to run offline using local placeholders) or `real` (to invoke the real Gemini API).
- `GEMINI_API_KEY`: Only required when `AI_PROVIDER=real`.

### 3. Initialize the Supabase Database
1. Go to your Supabase Project **SQL Editor** (Dashboard > SQL Editor > New Query).
2. Paste the contents of `supabase/schema.sql` and click **Run**.

### 4. Create the Storage Bucket
1. Go to **Storage** in the Supabase Dashboard.
2. Click **New Bucket**.
3. Name it exactly `assets`.
4. Make the bucket **Public** (Public: ON) so that generated files are publicly readable.

### 5. Launch the Application
Run the local Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Demo Script (Graded Performance)

Frame the pain first, then close all three gaps:

1. **Pain:** *"Normally if shot 3 is wrong, you re-roll and lose shots 1 and 2. Watch us keep the whole timeline intact."*
2. **Assets:** Generate `@hero` (NB2 Lite), upload `@spaceship`. → *"Some AI-generated, some ours."*
3. **Shot 1:** `@hero stands on the bridge of the @spaceship, cinematic wide shot.` → open **Context Inspector**: *"Physics ON — watch the shadows."* (G1)
4. **Shot 2 (consistency):** `Now a close-up of @hero, running, from behind, at night.` → Context Inspector shows *"Consistency: references Shot 1."* → *"Different angle and lighting, same character — that's our orchestration, not luck."* (G2)
5. **Edit (anti-reroll):** Edit Shot 1 → `Make it red alert lighting.` → version `v2` appears; everything else preserved. (anti-reroll + G1 lighting)
6. **Close (narrative):** Click **▶ Play Timeline** → all shots play as one sequence. *"One conversation. A consistent, physically coherent, multi-shot scene — never started from scratch."* (G3)
