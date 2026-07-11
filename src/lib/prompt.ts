import type { Asset, Shot, ContextSummary, ResolvedShotRef, MultimodalInputRef } from './types';

export const PHYSICS_INSTRUCTION =
  'Respect real-world physical dynamics: consistent gravity, correct light source direction and cast shadows, and coherent perspective across the shot. Do not composite; render a physically plausible scene.';

export function consistencyInstruction(priorShot: Shot | null): string | null {
  if (!priorShot) return null;
  return 'Maintain visual continuity with the previous shot: same characters (identity, wardrobe, proportions), same environment style, and consistent lighting mood. Only change what the new instruction explicitly requests.';
}

export const EDIT_PRESERVE_INSTRUCTION =
  'This is a non-destructive edit of the provided base video. Change ONLY the element or property described in the instruction. Preserve character identity, composition, motion, and all unrequested elements exactly.';

export const EXTEND_INSTRUCTION =
  'This is a seamless continuation of the provided base video. Pick up exactly where the video ends — match motion trajectory, character poses, lighting, camera angle, and environment. Generate what happens next in a natural, physically consistent way.';

export const ELEMENT_SWAP_INSTRUCTION_TEMPLATE =
  'Replace the visual element associated with @{from} using the reference identity/appearance of @{to}. Preserve all other motion, lighting, camera, and scene composition.';

export function detectElementSwap(message: string): { from: string; to: string } | null {
  const match = message.match(/swap\s+@([A-Za-z0-9_]+)\s+with\s+@([A-Za-z0-9_]+)/i);
  if (!match) return null;
  return { from: match[1], to: match[2] };
}

export function buildSwapInstruction(message: string): string | null {
  const swap = detectElementSwap(message);
  if (!swap) return null;
  return ELEMENT_SWAP_INSTRUCTION_TEMPLATE.replace('{from}', swap.from).replace('{to}', swap.to);
}

/**
 * Reconstructs a plain-English description of what a shot contains, based on
 * its stored context_summary and prompt. Used to give the AI full context when
 * editing or extending a shot.
 */
export function buildSceneNarrative(shot: Shot): string {
  const parts: string[] = [];

  const userPrompt = shot.context_summary?.userPrompt || shot.prompt;
  if (userPrompt) {
    parts.push(`Original scene description: "${userPrompt}"`);
  }

  const refs = shot.context_summary?.references || [];
  if (refs.length > 0) {
    const tagList = refs.map(r => `@${r.tag} (${r.type})`).join(', ');
    parts.push(`Referenced assets in the scene: ${tagList}`);
  }

  const referencedShots = shot.context_summary?.referencedShots || [];
  if (referencedShots.length > 0) {
    const shotList = referencedShots.map(s => s.label).join(', ');
    parts.push(`Referenced prior shots for context: ${shotList}`);
  }

  if (shot.context_summary?.swapInstruction) {
    parts.push(`A previous swap was applied: ${shot.context_summary.swapInstruction}`);
  }

  if (shot.context_summary?.isExtend) {
    parts.push('This shot was itself an extension of a previous shot.');
  }

  return parts.join(' | ');
}

export interface VideoGenInput {
  prompt: string;
  referencedAssets: Asset[];
  referencedShots?: ResolvedShotRef[];
  priorShot: Shot | null;
  baseVideoUrl: string | null;
  isEdit: boolean;
  isExtend?: boolean;
  previousInteractionId?: string | null;
  extraReferenceVideos?: string[];
  /** Pre-built scene narrative of the parent shot (for edits/extends) */
  sceneNarrative?: string | null;
}

function mimeForAsset(type: Asset['type']): string {
  if (type === 'video') return 'video/mp4';
  if (type === 'audio') return 'audio/mpeg';
  return 'image/png';
}

function buildMultimodalInputs(input: VideoGenInput): MultimodalInputRef[] {
  const parts: MultimodalInputRef[] = [];

  if (input.baseVideoUrl) {
    parts.push({ type: 'base_video', url: input.baseVideoUrl, mimeType: 'video/mp4' });
  }

  for (const a of input.referencedAssets) {
    parts.push({
      type: a.type === 'audio' ? 'audio' : a.type === 'video' ? 'video' : 'image',
      url: a.url,
      mimeType: mimeForAsset(a.type),
    });
  }

  for (const ref of input.referencedShots || []) {
    parts.push({ type: 'video', url: ref.videoUrl, mimeType: 'video/mp4' });
  }

  for (const url of input.extraReferenceVideos || []) {
    if (!parts.some(p => p.url === url)) {
      parts.push({ type: 'video', url, mimeType: 'video/mp4' });
    }
  }

  return parts;
}

export function buildVideoContext(input: VideoGenInput): {
  instructions: string[];
  contextSummary: ContextSummary;
} {
  const instructions: string[] = [PHYSICS_INSTRUCTION];
  const cons = consistencyInstruction(input.priorShot);
  const swapInstruction = buildSwapInstruction(input.prompt);
  const previousInteractionId =
    input.previousInteractionId ??
    (input.isEdit && input.priorShot?.context_summary?.interactionId
      ? input.priorShot.context_summary.interactionId
      : null);

  // --- Scene narrative injection (edit / extend) ---
  if ((input.isEdit || input.isExtend) && input.sceneNarrative) {
    instructions.push(
      `Context of the shot being ${input.isExtend ? 'extended' : 'edited'}: ${input.sceneNarrative}`
    );
  }

  if (cons) instructions.push(cons);

  if (input.isExtend) {
    instructions.push(EXTEND_INSTRUCTION);
  } else if (input.isEdit) {
    instructions.push(EDIT_PRESERVE_INSTRUCTION);
  }

  if (swapInstruction) instructions.push(swapInstruction);

  // Extend clips always use interactions.create — the Gemini API does NOT support
  // baseVideo extension via interactions.edit (throws 400).
  const omniEndpoint: ContextSummary['omniEndpoint'] =
    input.isExtend
      ? 'interactions.create'
      : input.isEdit && previousInteractionId
      ? 'interactions.edit'
      : 'interactions.create';

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
    parentShotId: (input.isEdit || input.isExtend) && input.priorShot ? input.priorShot.id : null,
    interactionId: null,
    editMode: input.isEdit,
    isExtend: input.isExtend ?? false,
    extendedFromShotId: input.isExtend && input.priorShot ? input.priorShot.id : null,
    sceneNarrative: input.sceneNarrative ?? null,
    userPrompt: input.prompt,
    instructions: [...instructions],
    referencedShots: input.referencedShots || [],
    previousInteractionId,
    omniEndpoint,
    multimodalInputs: buildMultimodalInputs(input),
    swapInstruction,
  };

  return { instructions, contextSummary };
}

export function splitAssetMedia(assets: Asset[]) {
  return {
    images: assets.filter(a => a.type === 'image').map(a => a.url),
    videos: assets.filter(a => a.type === 'video').map(a => a.url),
    audios: assets.filter(a => a.type === 'audio').map(a => a.url),
  };
}
