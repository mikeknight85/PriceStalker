export const PRESET_ENGINES = [
  'brave',
  'startpage',
  'duckduckgo_web',
  'google',
  'bing',
  'qwant',
  'mojeek'
];

export const DEFAULT_RECOMMENDED_ENGINES = 'brave,startpage,duckduckgo_web,google,bing';

/**
 * Parses a comma-separated string of search engines into a unique, lowercase, trimmed array.
 */
export function parseSearXNGEngines(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      list.push(trimmed);
    }
  }
  return list;
}

/**
 * Adds an engine (or comma-separated engines) to an existing comma-separated string if not already present.
 */
export function addSearXNGEngine(current: string | undefined | null, engineToAdd: string): string {
  if (!engineToAdd) return current?.trim() ?? '';
  const newItems = parseSearXNGEngines(engineToAdd);
  if (newItems.length === 0) return current?.trim() ?? '';
  const list = parseSearXNGEngines(current);
  for (const item of newItems) {
    if (!list.includes(item)) {
      list.push(item);
    }
  }
  return list.join(',');
}

/**
 * Removes an engine from a comma-separated string.
 */
export function removeSearXNGEngine(current: string | undefined | null, engineToRemove: string): string {
  const norm = engineToRemove.trim().toLowerCase();
  const list = parseSearXNGEngines(current);
  return list.filter(e => e !== norm).join(',');
}

/**
 * Toggles an engine in a comma-separated string.
 */
export function toggleSearXNGEngine(current: string | undefined | null, engine: string): string {
  const norm = engine.trim().toLowerCase();
  const list = parseSearXNGEngines(current);
  if (list.includes(norm)) {
    return list.filter(e => e !== norm).join(',');
  }
  return [...list, norm].join(',');
}
