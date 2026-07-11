import type { Asset, Shot, ContextSummary } from './types';

// =============================================================================
// Director's Chair — Prompt Builder (Implements G1 & G2)
// =============================================================================

// G1: ALWAYS sent to the video model for physical consistency.
export const PHYSICS_INSTRUCTION =
  'Respect real-world physical dynamics: consistent gravity, correct light source direction and cast shadows, and coherent perspective across the shot. Do not composite; render a physically plausible scene.';

// G2: Sent only when a prior shot exists to preserve continuity across shots.
export function consistencyInstruction(priorShot: Shot | null): string | null {
  if (!priorShot) return null;
  return 'Maintain visual continuity with the previous shot: same characters (identity, wardrobe, proportions), same environment style, and consistent lighting mood. Only change what the new instruction explicitly requests.';
}

// Sent for edits: tells the model to keep everything the same except the requested change.
export const EDIT_PRESERVE_INSTRUCTION =
  'This is a non-destructive edit of the provided base video. Change ONLY the element or property described in the instruction. Preserve character identity, composition, motion, and all unrequested elements exactly.';

export interface VideoGenInput {
  prompt: string;
  referencedAssets: Asset[];
  priorShot: Shot | null;      // For sequence continuity (soft reference)
  baseVideoUrl: string | null; // For direct conversational edits (parent video)
  isEdit: boolean;
}

/**
 * Builds the array of instructions for the AI model and compiles
 * the ContextSummary metadata that will be saved to the database.
 */
export function buildVideoContext(input: VideoGenInput): {
  instructions: string[];
  contextSummary: ContextSummary;
} {
  const instructions: string[] = [PHYSICS_INSTRUCTION];
  const cons = consistencyInstruction(input.priorShot);

  if (cons) {
    instructions.push(cons);
  }
  if (input.isEdit) {
    instructions.push(EDIT_PRESERVE_INSTRUCTION);
  }

  const contextSummary: ContextSummary = {
    references: input.referencedAssets.map(a => ({
      assetId: a.id,
      tag: a.tag,
      url: a.url,
      type: a.type,
    })),
    consistencyInstruction: cons,
    physicsInstruction: PHYSICS_INSTRUCTION,
    baseVideoUrl: input.baseVideoUrl,
    parentShotId: input.isEdit && input.priorShot ? input.priorShot.id : null,
    // Store/propagate the interactionId from the parent shot for edits
    interactionId: input.isEdit && input.priorShot?.context_summary?.interactionId
      ? input.priorShot.context_summary.interactionId
      : null,
  };

  return { instructions, contextSummary };
}
