import type { LibraryArtifact, LibraryHero } from './types';

let heroCache: Promise<LibraryHero[]> | null = null;
let artifactCache: Promise<LibraryArtifact[]> | null = null;

export function loadLibraryHeroes() {
  heroCache ??= loadJson<LibraryHero[]>('/library/heroes.json');
  return heroCache;
}

export function reloadLibraryHeroes() {
  heroCache = loadJson<LibraryHero[]>(`/library/heroes.json?updated=${Date.now()}`);
  return heroCache;
}

export function loadLibraryArtifacts() {
  artifactCache ??= loadJson<LibraryArtifact[]>('/library/artifacts.json');
  return artifactCache;
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}
