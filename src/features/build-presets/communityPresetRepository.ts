import type { BuildPreset } from './types';

let cache: Promise<BuildPreset[]> | null = null;

export function loadCommunityBuildPresets() {
  cache ??= fetch('/library/presets.json').then((response) => {
    if (!response.ok) throw new Error(`Unable to load presets: ${response.status}`);
    return response.json() as Promise<BuildPreset[]>;
  });
  return cache;
}
