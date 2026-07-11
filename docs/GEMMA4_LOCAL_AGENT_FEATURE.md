# Feature: Gemma 4 Local-First Agent

> **Special Prize Target:** Best Use of Gemma 4 — Local-First Agents on Gemma
> **Focus Technology:** Gemma On-Device (Gemma 4 E2B & E4B)
> **Status:** Design complete. Implementation spec ready.

---

## 1. The Special Prize Bar

The prize does not reward "a chatbot running on a phone." It rewards a true **sense-decide-act-check agent loop** that runs entirely on-device, holds state across a task, recovers from failure locally, and knows when to defer to a human.

> *"If you can draw your agent as a single, straight arrow from input to output, it isn't an agent yet."*

Director's Chair already has the perfect workflow for this: a film director giving ongoing direction to a crew. The **Local Agent** is that crew — working offline, remembering the plan, fixing its own mistakes, and asking when unsure.

---

## 2. Core Metaphor: The Second Unit Director

| Cloud crew | Local Agent |
|---|---|
| Gemini Omni Flash | Lead director on the main set |
| NB2 Lite | Fast, cheap pre-visualization artist |
| **Gemma 4 Local Agent** | **Second unit director in the field** — keeps filming even when the main set loses connectivity |

The Local Agent is not a fallback. It is a **co-director** that runs locally by default and optionally calls the cloud for final high-fidelity renders.

---

## 3. The On-Device Agent Loop

Every user direction triggers a closed loop that stays on-device unless the agent decides otherwise.

```
         ┌──────────────┐
         │   SENSE      │  ← voice/text input, asset tags, camera feed,
         │              │    continuity state, network status
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │   DECIDE     │  ← parse intent, plan shots, choose edit type,
         │              │    decide cloud vs local, detect ambiguity
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │    ACT       │  ← generate proxy, rewrite prompt, queue render,
         │              │    save state, update timeline
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │   CHECK      │  ← validate continuity, check generation quality,
         │              │    compare against plan, decide retry or defer
         └──────┬───────┘
                │
                └──── retry ──┘ (loop back to DECIDE)
```

### 3.1 Sense

Inputs the agent observes locally:

- **User utterance** — transcribed speech or typed text.
- **Asset references** — `@tag` mentions matched against local asset metadata.
- **Current plan** — ordered shot list, active shot, edit history.
- **Network status** — online / offline / metered.
- **Device capabilities** — storage, compute tier, camera availability.
- **Last action result** — success, failure, partial, needs clarification.

### 3.2 Decide

Local decisions Gemma 4 can make:

| Decision | Example |
|---|---|
| Intent classification | `add_shot`, `edit_style`, `swap_asset`, `play_timeline`, `undo`, `explain` |
| Edit type selection | `style`, `motion`, `environment`, `swap`, `temporal` |
| Asset resolution | `@hero` maps to `asset_id: hero_001`, confidence 94% |
| Cloud vs local | Offline → queue; low confidence → defer; final render → cloud |
| Plan adjustment | Insert new shot after shot 2, or branch shot 1 into v2 |
| Ambiguity detection | "faster" could mean speed or duration → defer |

### 3.3 Act

On-device actions:

- Update local shot plan and shot objects.
- Generate a **proxy preview** using Gemma 4 / local diffusion stub.
- Rewrite a failed prompt and retry.
- Queue heavy renders for cloud sync when connectivity returns.
- Save all state to IndexedDB / SQLite locally.

### 3.4 Check

Validation loop:

- **Continuity check** — do referenced tags match previous shots?
- **Quality check** — did the proxy render succeed? Is the output non-empty?
- **Confidence check** — is the agent's interpretation above the defer threshold?
- **Plan consistency** — does the new shot fit the narrative sequence?

If any check fails, loop back to **Decide** with the error context.

---

## 4. Local State Schema

The agent must hold state across turns. Keep this in a local store (IndexedDB + Zustand).

```ts
interface LocalAgentState {
  mode: 'cloud' | 'local' | 'auto';
  network: 'online' | 'offline' | 'metered';
  plan: {
    shots: Shot[];
    activeShotId: string | null;
    versionCounter: number;
  };
  queue: {
    id: string;
    type: 'generate' | 'render' | 'sync';
    payload: unknown;
    retries: number;
    status: 'pending' | 'running' | 'failed';
  }[];
  decisions: {
    timestamp: number;
    sense: string;
    decision: string;
    action: string;
    result: string;
  }[];
  deferrals: {
    id: string;
    question: string;
    options: string[];
    context: unknown;
  }[];
}
```

---

## 5. Human-Defer Boundaries

The agent never guesses dangerously. When confidence is low, it pauses and asks.

### 5.1 Triggers for deferral

- Intent confidence < 60%.
- Ambiguous edit type (e.g., "faster" = speed vs duration).
- Missing critical asset and no local substitute.
- User command conflicts with established continuity.
- Two failed local retries in a row.

### 5.2 Deferral UI

```
┌─ LOCAL AGENT NEEDS INPUT ─┐
│ You said: "make it faster" │
│                            │
│ Did you mean:              │
│ [ Increase motion speed ]  │
│ [ Shorten clip duration ]  │
│ [ Explain both ]           │
└────────────────────────────┘
```

This proves the agent has boundaries and respects human judgment.

---

## 6. Local Error Recovery

When a generation or plan step fails, the agent must recover without cloud help.

### 6.1 Recovery strategies

| Failure | Local recovery |
|---|---|
| Proxy render failed | Rewrite prompt with stronger tags, retry up to 2x |
| Tag unresolved | Suggest closest local asset, ask user to confirm |
| Continuity broken | Highlight the conflict, propose a fix shot |
| Plan inconsistent | Reorder or insert bridging shot locally |
| Out of storage | Mark oldest proxy for eviction, keep plan metadata |

### 6.2 Recovery log

Show the recovery in the UI:

```
Local Agent: Proxy render failed → rewriting prompt → retrying...
Local Agent: Retry succeeded. Continuity score: 91%.
```

---

## 7. Demo Flow for the Special Prize

This 90-second demo proves all four agent capabilities.

### Setup

1. Open Director's Chair.
2. Toggle **🏠 Local Agent** on.
3. Disconnect from network (or simulate offline).
4. Show the status card: `Offline ready ✓`.

### Step 1 — Sense + Decide

```
User [voice]: Plan a 3-shot report: opening wide, interview close-up, closing B-roll.

Local Agent: Plan stored. 3 shots. No connectivity needed.
            Sense: command=plan, shot_count=3
            Decide: create Shot 1 (wide), Shot 2 (close-up), Shot 3 (B-roll)
```

### Step 2 — Act + Check

```
User: Generate shot 1 from @market_photo.

Local Agent: Tag resolved: @market_photo → asset_003.
            Act: queued proxy generation locally.
            Check: continuity N/A (first shot). OK.
```

### Step 3 — Human Defer

```
User: Make it faster.

Local Agent: I need input.
            "faster" could mean speed or duration.
            [Speed up motion] [Shorten duration]

User: [clicks Speed up motion]

Local Agent: Decision logged. Will apply to Shot 1.
```

### Step 4 — Error Recovery

```
User: Add a crowd to shot 2.

Local Agent: Proxy render failed — asset mismatch.
            Recovering: rewriting prompt with @market_photo + crowd overlay.
            Retrying...
            Retry succeeded. Continuity score: 88%.
```

### Step 5 — State Persistence

```
User: I'm going offline. Save everything.

Local Agent: Plan saved. 3 shots, 1 pending deferral resolved.
            Will sync final renders when connection returns.
```

---

## 8. UI Components

Build these components in addition to the main frontend spec.

### 8.1 `LocalAgentToggle`

- Switch between Cloud and Local Agent modes.
- Shows `Offline ready ✓` when network is down.
- Pulses amber when a deferral is pending.

### 8.2 `AgentStatusCard`

```
┌─ 🏠 LOCAL AGENT ─┐
│ Mode: active     │
│ State: synced    │
│ Plan: 3 shots    │
│ Queue: 1 pending │
│ Offline ready ✓  │
└──────────────────┘
```

### 8.3 `AgentLoopVisualizer`

A small animated diagram showing the current step: Sense → Decide → Act → Check. Highlights the active phase with a cyan pulse.

### 8.4 `AgentDecisionLog`

Scrollable list of recent sense/decide/act/check entries. Terminal-style monospace font.

### 8.5 `HumanDeferDialog`

Modal that appears when the agent needs input. Shows context, question, and 2–4 option buttons.

### 8.6 `OfflineQueuePanel`

Lists pending actions that will sync when connectivity returns: renders, uploads, exports.

---

## 9. Mock Provider for Demo Safety

If real Gemma 4 on-device inference is not available during the hackathon, provide a **mock local agent** that follows the same loop and state shape.

```ts
const mockLocalAgent = {
  sense: (input) => parseInput(input),
  decide: (context) => chooseAction(context),
  act: (action) => simulateLocalRender(action),
  check: (result) => validateResult(result),
};
```

The mock must:
- Update state correctly.
- Trigger deferrals at planned moments.
- Simulate retries and recovery.
- Be togglable off for real Gemma 4 integration later.

---

## 10. Acceptance Criteria

This feature is complete when:

- [ ] User can toggle Local Agent mode on/off.
- [ ] Agent parses user input and updates local shot plan without cloud.
- [ ] Agent resolves `@tags` against local assets.
- [ ] Agent shows live sense-decide-act-check loop in the UI.
- [ ] Agent defers to human when confidence is low.
- [ ] Agent recovers from a failed generation by rewriting and retrying.
- [ ] Agent state persists across reloads via local storage / IndexedDB.
- [ ] Offline queue is visible and syncs when connectivity returns.
- [ ] Demo can be run entirely offline using mock provider.
- [ ] A judge can see the loop, the deferral, and the recovery in under 90 seconds.

---

## 11. Why This Wins

Director's Chair is not a chatbot. The Local Agent is not a fallback. Together they prove:

- **Sense** — multi-modal input (voice, text, camera, assets).
- **Decide** — local planning, intent parsing, ambiguity detection.
- **Act** — on-device proxy generation, plan updates, cloud queuing.
- **Check** — continuity validation, quality checks, retry logic.
- **Human deferral** — clear boundaries and respect for user judgment.
- **Error recovery** — local rewrite, retry, and state preservation.

The agent is a loop, not an arrow. And it runs where the user needs it most: **on their device**.
