import type { Asset, Shot, ContextSummary, ResolvedShotRef, MultimodalInputRef, TextReference } from './types';

export const PHYSICS_INSTRUCTION =
  'Respect real-world physical dynamics: consistent gravity, correct light source direction and cast shadows, and coherent perspective across the shot. Do not composite; render a physically plausible scene.';

/** Text-only continuity — Omni Flash does not accept video inputs for extension/consistency. */
export function textConsistencyInstruction(
  priorShot: Shot | null,
  referencedShots: ResolvedShotRef[] = []
): string | null {
  const parts: string[] = [];

  if (priorShot) {
    parts.push(
      `Continuity reference — prior Shot ${priorShot.turn_index + 1}: "${priorShot.prompt}". ` +
        'Keep the same character identity, wardrobe, proportions, environment style, and lighting mood. ' +
        'Only change what the new instruction explicitly requests.'
    );
  }

  for (const ref of referencedShots) {
    parts.push(
      `Continuity reference — @${ref.label} (timeline slot ${ref.turnIndex + 1}): ` +
        'match the visual style, characters, and lighting established in that shot.'
    );
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export function textEditReference(parentShot: Shot): string {
  return (
    `Non-destructive edit of Shot ${parentShot.turn_index + 1}. ` +
    `Original scene description: "${parentShot.prompt}". ` +
    'Change ONLY what the edit instruction requests. Preserve character identity, composition, motion, and all unrequested elements.'
  );
}

export const EDIT_PRESERVE_INSTRUCTION =
  'This is a non-destructive edit. Change ONLY the element or property described in the instruction. Preserve character identity, composition, motion, and all unrequested elements exactly.';

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
}

function buildTextReferences(
  priorShot: Shot | null,
  referencedShots: ResolvedShotRef[],
  referencedAssets: Asset[]
): TextReference[] {
  const refs: TextReference[] = [];

  if (priorShot) {
    refs.push({
      label: `Shot ${priorShot.turn_index + 1}`,
      description: priorShot.prompt,
    });
  }

  for (const ref of referencedShots) {
    refs.push({
      label: `@${ref.label}`,
      description: `Timeline slot ${ref.turnIndex + 1} — style/motion continuity anchor`,
    });
  }

  for (const asset of referencedAssets) {
    if (asset.type === 'video' || asset.type === 'audio') {
      refs.push({
        label: `@${asset.tag}`,
        description: asset.prompt || `${asset.type} asset reference (text-only — video/audio not sent to model)`,
      });
    }
  }

  return refs;
}

function buildMultimodalInputs(
  referencedAssets: Asset[],
  textReferences: TextReference[]
): MultimodalInputRef[] {
  const parts: MultimodalInputRef[] = [];

  for (const a of referencedAssets) {
    if (a.type === 'image') {
      parts.push({ type: 'image', url: a.url, mimeType: 'image/png' });
    }
  }

  for (const ref of textReferences) {
    parts.push({
      type: 'text_reference',
      label: ref.label,
      description: ref.description,
    });
  }

  return parts;
}

export function buildVideoContext(input: VideoGenInput): {
  instructions: string[];
  contextSummary: ContextSummary;
} {
  const instructions: string[] = [PHYSICS_INSTRUCTION];
  const referencedShots = input.referencedShots || [];
  const textRefs = buildTextReferences(input.priorShot, referencedShots, input.referencedAssets);

  const cons = input.isEdit
    ? null
    : textConsistencyInstruction(input.priorShot, referencedShots);

  const swapInstruction = buildSwapInstruction(input.prompt);
  const chainInteractionId =
    input.previousInteractionId ??
    (input.isEdit && input.priorShot?.context_summary?.interactionId
      ? input.priorShot.context_summary.interactionId
      : !input.isEdit && input.priorShot?.context_summary?.interactionId
        ? input.priorShot.context_summary.interactionId
        : null);

  if (cons) instructions.push(cons);
  if (input.isEdit && input.priorShot) {
    instructions.push(textEditReference(input.priorShot));
  } else if (input.isEdit) {
    instructions.push(EDIT_PRESERVE_INSTRUCTION);
  }
  if (swapInstruction) instructions.push(swapInstruction);

  const omniEndpoint: ContextSummary['omniEndpoint'] =
    input.isEdit && chainInteractionId ? 'interactions.edit' : 'interactions.create';

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
    referencedShots,
    textReferences: textRefs,
    previousInteractionId: chainInteractionId,
    omniEndpoint,
    multimodalInputs: buildMultimodalInputs(input.referencedAssets, textRefs),
    swapInstruction,
  };

  return { instructions, contextSummary };
}

/** Only images are sent as multimodal media — video/audio use text references. */
export function splitAssetMedia(assets: Asset[]) {
  return {
    images: assets.filter(a => a.type === 'image').map(a => a.url),
    videos: assets.filter(a => a.type === 'video').map(a => a.url),
    audios: assets.filter(a => a.type === 'audio').map(a => a.url),
  };
}
