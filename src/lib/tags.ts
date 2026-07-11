import type { Asset } from './types';

// =============================================================================
// Director's Chair — Tag Parsing & Resolution
// =============================================================================

/**
 * Extracts unique tag handles (without '@') from a user message.
 * Matches words matching: @word, @word_word, @word123
 */
export function extractTags(message: string): string[] {
  if (!message) return [];
  const matches = [...message.matchAll(/@([A-Za-z0-9_]+)/g)].map(m => m[1]);
  return Array.from(new Set(matches));
}

/**
 * Resolves tags in a message against the existing assets in the current project.
 * Unknown tags are returned separately so the UI can display warning chips.
 */
export function resolveTags(message: string, assets: Asset[]) {
  const tags = extractTags(message);
  const byTag = new Map((assets || []).map(a => [a.tag.toLowerCase(), a]));
  const resolved: Asset[] = [];
  const unknown: string[] = [];

  for (const t of tags) {
    const a = byTag.get(t.toLowerCase());
    if (a) {
      resolved.push(a);
    } else {
      unknown.push(t);
    }
  }

  return { resolved, unknown };
}
