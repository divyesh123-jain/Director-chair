// =============================================================================
// Director's Chair — Shared TypeScript Types
// =============================================================================

export type AssetType = 'image' | 'video' | 'audio';
export type AssetSource = 'nb2' | 'upload';
export type ShotStatus = 'pending' | 'generating' | 'done' | 'error';

export interface Asset {
  id: string;
  project_id: string;
  type: AssetType;
  tag: string;
  url: string;
  prompt: string | null;
  source: AssetSource;
  created_at: string;
}

export interface ResolvedShotRef {
  shotId: string;
  label: string;
  turnIndex: number;
  videoUrl: string;
}

export interface MultimodalInputRef {
  type: 'image' | 'video' | 'audio' | 'base_video';
  url: string;
  mimeType: string;
}

export interface ContextSummary {
  references: {
    assetId: string;
    tag: string;
    url: string;
    type: AssetType;
  }[];
  consistencyInstruction: string | null;
  physicsInstruction: string;
  baseVideoUrl: string | null;
  parentShotId: string | null;
  interactionId?: string | null;
  editMode?: boolean;
  /** True when this shot was created via the Extend Clip feature */
  isExtend?: boolean;
  /** ID of the shot this was extended from (for extend-type shots) */
  extendedFromShotId?: string | null;
  /** Reconstructed plain-English scene narrative of the parent shot */
  sceneNarrative?: string | null;
  userPrompt?: string;
  instructions?: string[];
  referencedShots?: ResolvedShotRef[];
  previousInteractionId?: string | null;
  omniEndpoint?: 'interactions.create' | 'interactions.edit';
  multimodalInputs?: MultimodalInputRef[];
  swapInstruction?: string | null;
  originalSize?: number | null;
  compressedSize?: number | null;
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
