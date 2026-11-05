import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { equipmentSet } from './setCatalog';
import type { BuildPreset } from './types';
// Build-time ingestion uses Node only, and is not imported into the application.
// @ts-expect-error The plain build-time ES module deliberately has no TS declaration.
import { aggregateFribbelsBuilds, fillMissingFribbelsPresets, normalizedSets } from '../../../scripts/fill-missing-fribbels-presets.mjs';

const artifacts = new Map([['known', 'Known Artifact']]);
const build = (values = {}) => ({ atk: 3000, hp: 14000, def: 1000, spd: 240, chc: 100, chd: 280, eff: 0, efr: 0, gs: 400,
  artifactCode: 'known', createDate: '2026-11-01T00:00:00Z', sets: { set_speed: 4, set_penetrate: 2 }, ...values });

describe('Fribbels missing built-in presets', () => {
  it('ships the six newly available presets with mapped artifacts and six-piece sets', async () => {
    const presets = JSON.parse(await readFile(new URL('../../../public/library/presets.json', import.meta.url), 'utf8')) as BuildPreset[];
    const artifacts = JSON.parse(await readFile(new URL('../../../public/library/artifacts.json', import.meta.url), 'utf8')) as Array<{ code: string; image: string | null }>;
    for (const heroCode of ['mei-lin', 'renoa', 'haru', 'uncharted-pioneer-politis', 'lisette', 'aube']) {
      const preset = presets.find(preset => preset.heroCode === heroCode)!;
      expect(preset?.selection?.source).toBe('Fribbels Hero Library community builds');
      expect(preset?.targetStats.atk).toBeGreaterThan(0);
      expect(artifacts.find(artifact => artifact.code === preset.artifactCode)?.image).toBeTruthy();
    }
    for (const preset of presets) expect(preset.sets.reduce((sum, code) => sum + equipmentSet(code).pieces, 0), preset.heroCode).toBe(6);
  });

  it('requires six active pieces and recognizes current four- and two-piece sets', () => {
    expect(normalizedSets({ set_weak: 4, set_chase: 2 })).toEqual({ set_weak: 4, set_chase: 2 });
    expect(normalizedSets({ set_opener: 4, set_penetrate: 2 })).toEqual({ set_opener: 4, set_penetrate: 2 });
    expect(normalizedSets({ set_speed: 3, set_immune: 2 })).toBeNull();
    expect(normalizedSets({ unknown_set: 6 })).toBeNull();
  });

  it('rejects absent data, unknown artifacts and incomplete or invalid panels', () => {
    expect(aggregateFribbelsBuilds([], artifacts)).toBeNull();
    expect(aggregateFribbelsBuilds([build({ artifactCode: 'unknown' })], artifacts)).toBeNull();
    expect(aggregateFribbelsBuilds([build({ hp: 0 })], artifacts)).toBeNull();
    expect(aggregateFribbelsBuilds([build({ sets: { set_speed: 4 } })], artifacts)).toBeNull();
  });

  it('uses recent complete samples, corrected top-quarter gear score and the dominant archetype', () => {
    const samples = Array.from({ length: 8 }, (_, index) => build({ gs: 400 + index, atk: 3000 + index * 100 }));
    samples.push(build({ gs: 999, createDate: '2025-01-01T00:00:00Z' }));
    const result = aggregateFribbelsBuilds(samples, artifacts, '2026-11-05T00:00:00Z');
    expect(result.selection.total_samples_seen).toBe(9);
    expect(result.selection.valid_complete_samples).toBe(8);
    expect(result.selection.elite_samples).toBe(2);
    expect(result.preset.target_stats.atk).toBe(3600);
    expect(result.preset.artifact.name).toBe('Known Artifact');
    expect(result.selection.fetched_at).toBe('2026-11-05T00:00:00Z');
  });

  it('does not treat crit overcap as valuable gear score', () => {
    const samples = [build({ gs: 410, atk: 3500 }), build({ gs: 420, chc: 150, atk: 9999 }), build(), build()];
    const result = aggregateFribbelsBuilds(samples, artifacts);
    expect(result.preset.target_stats.atk).toBe(3500);
    expect(result.preset.target_stats.gs).toBe(410);
  });

  it('never queries the network when all source heroes already have successful presets', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'e7-fribbels-complete-'));
    await mkdir(path.join(root, 'indexes'), { recursive: true });
    await mkdir(path.join(root, 'presets/fribbels/recommended'), { recursive: true });
    await writeFile(path.join(root, 'indexes/heroes-index.json'), JSON.stringify([{ code: 'kept', name: '保留' }]));
    const saved = JSON.stringify({ hero: { id: 'kept' }, status: 'ok', preset: { name: '已存在' } });
    const file = path.join(root, 'presets/fribbels/recommended/kept.json');
    await writeFile(file, saved);
    const report = await fillMissingFribbelsPresets({ sourceRoot: root, log() {}, delayMs: 0,
      fetcher() { throw new Error('Network must not run'); } });
    expect(report.missing_before).toBe(0);
    expect(await readFile(file, 'utf8')).toBe(saved);
  });

  it('records unavailable heroes without inventing a preset, then can retry on the next update', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'e7-fribbels-pending-'));
    await mkdir(path.join(root, 'indexes'), { recursive: true });await mkdir(path.join(root, 'heroes'), { recursive: true });
    await writeFile(path.join(root, 'indexes/heroes-index.json'), JSON.stringify([{ code: 'new-hero', name: '新角色', face_id: 'c9999' }]));
    await writeFile(path.join(root, 'heroes/new-hero.json'), JSON.stringify({ id: 'c9999', nameEn: 'New Hero' }));
    let builds: unknown[] = [];
    const fetcher = async (url: string) => ({ ok: true, json: async () => url.includes('herodata') ? {}
      : url.includes('artifactdata') ? { artifact: { code: 'known', name: 'Known Artifact' } } : { data: builds } });
    const options = { sourceRoot: root, log() {}, delayMs: 0, fetcher };
    const pending = await fillMissingFribbelsPresets(options);
    expect(pending.pending).toHaveLength(1);expect(pending.added).toHaveLength(0);
    builds = [build()];
    const filled = await fillMissingFribbelsPresets(options);
    expect(filled.added).toHaveLength(1);
    const record = JSON.parse(await readFile(path.join(root, 'presets/fribbels/recommended/new-hero.json'), 'utf8'));
    expect(record.hero.id).toBe('new-hero');expect(record.hero.code).toBe('c9999');
    expect(record.preset.target_stats.atk).toBe(3000);
  });
});
