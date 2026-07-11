import type { Asset, Shot, ContextSummary, ResolvedShotRef, MultimodalInputRef } from './types';

export const PHYSICS_INSTRUCTION =
  'Respect real-world physical dynamics: consistent gravity, correct light source direction and cast shadows, and coherent perspective across the shot. Do not composite; render a physically plausible scene.';

export function consistencyInstruction(priorShot: Shot | null): string | null {
  if (!priorShot) return null;
  return 'Maintain visual continuity with the previous shot: same characters (identity, wardrobe, proportions), same environment style, and consistent lighting mood. Only change what the new instruction explicitly requests.';
}

export const EDIT_PRESERVE_INSTRUCTION =
  'This is a non-destructive edit of the provided base video. Change ONLY the element or property described in the instruction. Preserve character identity, composition, motion, and all unrequested elements exactly.';

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

export interface VideoGenInput {
  prompt: string;
  referencedAssets: Asset[];
  referencedShots?: ResolvedShotRef[];
  priorShot: Shot | null;
  baseVideoUrl: string | null;
  isEdit: boolean;
  previousInteractionId?: string | null;
  extraReferenceVideos?: string[];
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

  if (cons) instructions.push(cons);
  if (input.isEdit) instructions.push(EDIT_PRESERVE_INSTRUCTION);
  if (swapInstruction) instructions.push(swapInstruction);

  const omniEndpoint: ContextSummary['omniEndpoint'] =
    input.isEdit && previousInteractionId ? 'interactions.edit' : 'interactions.create';

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
    interactionId: null,
    editMode: input.isEdit,
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
