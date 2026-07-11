import type { Asset, Shot, ResolvedShotRef } from './types';

const SHOT_TAG_RE = /^shot-(\d+)$/i;

export function extractShotTagNumbers(message: string): number[] {
  if (!message) return [];
  const matches = [...message.matchAll(/@shot-(\d+)/gi)].map(m => parseInt(m[1], 10));
  return Array.from(new Set(matches.filter(n => !Number.isNaN(n))));
}

export function extractAssetTags(message: string): string[] {
  if (!message) return [];
  const matches = [...message.matchAll(/@([A-Za-z0-9_]+)/g)]
    .map(m => m[1])
    .filter(t => !SHOT_TAG_RE.test(t));
  return Array.from(new Set(matches));
}

/** @deprecated Use extractAssetTags */
export function extractTags(message: string): string[] {
  return extractAssetTags(message);
}

export function resolveTags(message: string, assets: Asset[]) {
  const tags = extractAssetTags(message);
  const byTag = new Map((assets || []).map(a => [a.tag.toLowerCase(), a]));
  const resolved: Asset[] = [];
  const unknown: string[] = [];

  for (const t of tags) {
    const a = byTag.get(t.toLowerCase());
    if (a) resolved.push(a);
    else unknown.push(t);
  }

  return { resolved, unknown };
}

export function getLatestDoneShotForTurn(shots: Shot[], turnIndex: number): Shot | null {
  const versions = shots
    .filter(s => s.turn_index === turnIndex && s.status === 'done' && s.output_video_url)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return versions.length > 0 ? versions[versions.length - 1] : null;
}

export function resolveShotTags(
  message: string,
  shots: Shot[],
  options?: { excludeTurnIndex?: number }
) {
  const numbers = extractShotTagNumbers(message);
  const resolved: ResolvedShotRef[] = [];
  const unknown: number[] = [];

  for (const n of numbers) {
    const turnIndex = n - 1;
    if (options?.excludeTurnIndex !== undefined && turnIndex === options.excludeTurnIndex) {
      continue;
    }
    const shot = getLatestDoneShotForTurn(shots, turnIndex);
    if (shot && shot.output_video_url) {
      resolved.push({
        shotId: shot.id,
        label: `shot-${n}`,
        turnIndex,
        videoUrl: shot.output_video_url,
      });
    } else {
      unknown.push(n);
    }
  }

  return { resolved, unknown };
}

export function listAvailableShotTags(shots: Shot[]): string[] {
  const turnIndices = new Set(
    shots.filter(s => s.status === 'done' && s.output_video_url).map(s => s.turn_index)
  );
  return Array.from(turnIndices)
    .sort((a, b) => a - b)
    .map(i => `shot-${i + 1}`);
}
