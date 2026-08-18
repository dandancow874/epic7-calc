import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { LibraryArtifact, LibraryHero } from './types';

async function readGenerated<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../../public/library/${name}`, import.meta.url), 'utf8')) as T;
}

describe('generated library data', () => {
  it('matches the complete source indexes', async () => {
    const [heroes, artifacts, manifest] = await Promise.all([
      readGenerated<LibraryHero[]>('heroes.json'), readGenerated<LibraryArtifact[]>('artifacts.json'),
      readGenerated<{ heroCount: number; artifactCount: number }>('manifest.json'),
    ]);
    expect(heroes).toHaveLength(manifest.heroCount);
    expect(artifacts).toHaveLength(manifest.artifactCount);
  });

  it('marks only heroes with skills and stats as complete', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    expect(heroes.every((hero) => hero.dataStatus === 'summary-only' || (hero.skills.length > 0 && Boolean(hero.baseStats)))).toBe(true);
    expect(heroes.filter((hero) => hero.dataStatus === 'summary-only').map((hero) => hero.code).sort()).toEqual([]);
    for (const code of ['aube', 'tidal-rift-elvira']) {
      const hero = heroes.find((record) => record.code === code);
      expect(hero?.skills).toHaveLength(3);
      expect(hero?.baseStats).toBeTruthy();
      expect(hero?.artwork).toBeTruthy();
    }
  });

  it('includes maintained gear-score passive adjustments', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const adjustment = (code: string) => heroes.find((hero) => hero.code === code)?.gearScoreAdjustments;
    expect(adjustment('aki')?.finalMultipliers.atk).toBe(1.5);
    expect(adjustment('beehoo')?.finalMultipliers.atk).toBe(1.3);
    expect(adjustment('arunka')?.finalMultipliers.atk).toBe(1.3);
    expect(adjustment('summertime-iseria')?.finalMultipliers.atk).toBe(1.5);
    expect(adjustment('senya')?.finalMultipliers.atk).toBe(1.5);
    expect(adjustment('ram')?.finalMultipliers.atk).toBe(1.3);
    expect(adjustment('gunther')?.finalMultipliers.atk).toBe(1.75);
    expect(adjustment('dragon-bride-senya')?.finalMultipliers.hp).toBe(1.1);
    expect(adjustment('lethe')?.finalMultipliers.hp).toBe(1.1);
    expect(adjustment('eaton')?.finalMultipliers.hp).toBe(1.2);
    expect(adjustment('beehoo')?.additivePercentPoints.eff).toBe(30);
    expect(adjustment('beehoo')?.libraryBaseStatsIncludes).toContain('eff');
    expect(adjustment('westwind-executioner-schuri')?.additivePercentPoints.eff).toBe(30);
    expect(adjustment('westwind-executioner-schuri')?.libraryBaseStatsIncludes).toContain('eff');
    expect(adjustment('claudia')?.additivePercentPoints.eff).toBe(30);
    expect(adjustment('claudia')?.libraryBaseStatsIncludes).toContain('eff');
  });

  it('represents missing artifact images explicitly', async () => {
    const artifacts = await readGenerated<LibraryArtifact[]>('artifacts.json');
    expect(artifacts.every((artifact) => artifact.image === null || artifact.image.startsWith('/'))).toBe(true);
    expect(artifacts.every((artifact) => artifact.code && artifact.name && artifact.role)).toBe(true);
  });
});
