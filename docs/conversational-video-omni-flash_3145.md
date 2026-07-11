# Judge's Evaluation Framework: Conversational Video & Motion with Omni Flash

**Focus Technology:** Gemini Omni Flash (gemini-omni-flash-preview)

---

## Key Points I'll Look For (Judging Criteria)

### 1. Genuine Multi-Turn Conversational Orchestration
- Not just "prompt -> video -> done", but true back-and-forth dialogue
- The system remembers context across turns (e.g., "Now make the car red" -> "Actually, keep it red but add rain")
- Stateful memory of edits, versions, and user intent
- Resolves ambiguous instructions correctly using prior context

### 2. Multi-Modal Input Handling
- Accepts **any combination**: text + images + audio + video as input
- Proper fusion of modalities (e.g., voice describing motion over a reference image)
- Can reference/ingest its own previously generated outputs for iteration

### 3. Edit & Iterate Capabilities
- **Element swapping**: Replace objects while preserving scene (e.g., swap a person, keep background)
- **Motion transfer**: Apply one motion pattern to a different subject
- **Style transfer**: Repaint footage in a new aesthetic without losing structure
- **Temporal editing**: Modify specific frames/segments without regenerating the whole clip

### 4. Physical World Dynamics Respecta
- Gravity, lighting, perspective, shadows, reflections behave plausibly
- Object permanence across edits
- No "floating objects", inconsistent shadows, or broken perspective

### 5. Multi-Shot Narrative Timelines
- Ability to build **consistent sequences** (character/scene continuity across shots)
- Scene-to-scene transitions that make narrative sense
- Storyboard-style orchestration through natural language

### 6. NB2 Lite -> Omni Flash Pipeline
- Using NB2 Lite for ultra-fast image generation (keyframes/assets)
- Chaining into Omni Flash for animation/editing of those images into video
- Efficient, cost-aware pipeline design

### 7. UX & Conversation Flow
- Natural, low-friction chat-style interface
- Progressive refinement without restarts
- Clear visual feedback (before/after, edit markers, timeline view)

### 8. Technical Robustness & Creativity
- Error handling for failed generations
- Novel use cases beyond standard "text-to-video"
- Performance considerations (latency, cost, caching)

---

## How I'd Approach This Problem (Build Strategy)

### Phase 1: Architecture & Pipeline Design

```
+-------------+     +--------------+     +------------------+
|  Chat UI    |---->| Conversation |---->| Orchestrator     |
| (text/voice)|<----| Memory Store |<----| (intent parser)  |
+-------------+     +--------------+     +--------+---------+
                                                   |
                          +------------------------+----------------+
                          v                        v                v
                   +-------------+         +--------------+  +-------------+
                   | NB2 Lite    |         | Omni Flash   |  | Asset Store |
                   | (keyframes) |         | (video gen)  |  | (versions)  |
                   +-------------+         +--------------+  +-------------+
```

### Phase 2: Core Features to Build

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Conversation Manager** | Tracks dialogue history, edit stack, and resolves pronouns ("make *that* bigger") using context |
| 2 | **Intent Parser** | Classifies user request: generate / edit-swap / edit-motion / edit-style / sequence |
| 3 | **Element Swapper** | "Replace the dog with a cat" - masks subject, regenerates, maintains scene/lighting |
| 4 | **Motion Transfer Engine** | Extract motion from clip A, apply to image/clip B |
| 5 | **Style Transfer Layer** | Apply anime/realism/painterly looks while preserving geometry |
| 6 | **Timeline Builder** | Multi-shot storyboard: generate shot 1 -> "create shot 2 continuing this" -> stitch |
| 7 | **Physics Validator** | Post-generation check for shadow/light/perspective consistency; flag issues for re-gen |
| 8 | **Version Gallery** | Save each iteration; let user branch ("try 2 versions of shot 3") |
| 9 | **Voice Input** | Omni = audio-capable; let users *talk* to direct the video |
| 10 | **NB2 -> Omni Chain** | Generate ref images with NB2 Lite -> animate with Omni Flash |

### Phase 3: Example Conversational Flow (Demo Scenario)

```
User: [uploads photo of a street] "Animate this with people walking"
Sys:  [generates video clip v1] Done
User: "Swap the person in red with someone in blue jacket"
Sys:  [element swap, v2] Done (lighting preserved)
User: "Now make it rain, night time"
Sys:  [style + env edit, v3] Done
User: "Create a second shot from a rooftop POV, continuing this scene"
Sys:  [timeline shot 2, character consistent] Done
User: [audio note] "Actually the rain should be heavier in shot 2"
Sys:  [temporal edit, v3.1] Done
```

### Phase 4: Differentiation (What Wins)
- **Multi-modal input** (especially voice + image) - leverage the "Omni" nature
- **Verifiable continuity** across shots (show a side-by-side character/scene consistency check)
- **Physics-aware feedback loop** - system auto-detects & corrects physics violations
- **Branching/versioning** - like git for video generation

---

## Scoring Rubric

| Criterion | Weight |
|-----------|--------|
| True multi-turn conversation | 25% |
| Edit quality (swap/motion/style) | 25% |
| Physics & continuity respect | 15% |
| Multi-shot timeline building | 15% |
| NB2 Lite -> Omni Flash pipeline | 10% |
| UX & creativity | 10% |

---

## Bottom Line

Reward projects that treat video as a **living, editable conversation** rather than a one-shot generation, and that demonstrably preserve real-world dynamics across edits and multi-shot narratives. The Omni Flash + NB2 Lite chain is a strong multiplier if used meaningfully, not just as a checkbox.
