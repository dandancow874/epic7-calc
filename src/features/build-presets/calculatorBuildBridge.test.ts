import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBuildToCalculator, calculatorArtifactIdForLibraryArtifact, defaultCalculatorBuild, libraryArtifactForCalculatorId, rememberCalculatorBuild, restoreManualBuildValues, withCalculatorArtifact, withCalculatorStat, withoutBuildPresetValues, type CalculatorBuildCatalog } from './calculatorBuildBridge';
import { emptyTargetStats, type BuildPreset } from './types';

const preset: BuildPreset = {
  id: 'manual:abigail:one', heroCode: 'abigail', name: '高速雅碧凯', source: 'manual',
  sets: ['set_rage', 'set_penetrate', 'set_torrent', 'set_torrent'], artifactCode: 'portrait-of-the-saviors',
  targetStats: { ...emptyTargetStats, atk: 3210, hp: 14200, def: 1180, spd: 247, chd: 286 }, updatedAt: '2026-07-22T10:00:00Z',
};

const catalog = {
  heroes: [], community: [],
  artifacts: [
    { code: 'portrait-of-the-saviors', name: '救世主们的画像', nameEn: 'Portrait of the Saviors', nameZht: null, description: '', skillDescription: '', rarity: 5, role: 'warrior', limited: false, stats: { atk: 273, hp: 416, def: 0 }, image: null, artwork: null, publishDate: null },
    { code: 'replacement', name: '替换神器', nameEn: 'Replacement', nameZht: null, description: '', skillDescription: '', rarity: 5, role: 'warrior', limited: false, stats: { atk: 195, hp: 702, def: 0 }, image: null, artwork: null, publishDate: null },
  ],
} as CalculatorBuildCatalog;

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe('calculator equipment preset bridge', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('restores the manual panel after turning an equipment preset off', () => {
    expect(restoreManualBuildValues('attacker',
      { attack: 9999, critDamage: 350, artifactId: 'preset' },
      { attack: 4321, critDamage: 321, artifactId: 'manual' },
    )).toMatchObject({ attack: 4321, critDamage: 321, artifactId: 'manual' });
  });

  it('maps an equipment preset to calculator stats and artifact without replacing calculator damage sets', () => {
    const result = applyBuildToCalculator('attacker', preset, catalog, { attackUp: true, rageSet: false, torrentSetStack: 3 });
    expect(result.values).toMatchObject({ attack: 3210, casterMaxHP: 14200, casterDefense: 1180, casterSpeed: 247, critDamage: 286, attackUp: true, rageSet: false, torrentSetStack: 3 });
    expect(result.artifactId).toBe('portrait_of_the_saviors');
  });

  it('remembers the last selected preset independently for each side', () => {
    rememberCalculatorBuild('attacker', 'abigail', preset.id);
    expect(defaultCalculatorBuild('attacker', 'abigail', [preset])?.id).toBe(preset.id);
    expect(defaultCalculatorBuild('defender', 'abigail', [preset])?.id).toBe(preset.id);
  });

  it('removes build-owned values while retaining battle state', () => {
    expect(withoutBuildPresetValues({ attack: 3000, artifactId: 'portrait', targetDefense: 1200, targetMaxHP: 18000, attackUp: true, casterFocus: 3, rageSet: true, torrentSetStack: 2 })).toEqual({ targetDefense: 1200, targetMaxHP: 18000, attackUp: true, casterFocus: 3, rageSet: true, torrentSetStack: 2 });
  });

  it('writes calculator sliders back to the shared build stats for both sides', () => {
    expect(withCalculatorStat(preset, 'attacker', 'attack', 4567).targetStats.atk).toBe(4567);
    expect(withCalculatorStat(preset, 'attacker', 'critDamage', 333).targetStats.chd).toBe(333);
    expect(withCalculatorStat(preset, 'defender', 'targetDefense', 2345).targetStats.def).toBe(2345);
    expect(withCalculatorStat(preset, 'defender', 'targetAttack', 3456).targetStats.atk).toBe(3456);
    expect(withCalculatorStat(preset, 'attacker', 'artifactLevel', 24, catalog.artifacts)).toMatchObject({ artifactLevel: 24, targetStats: { atk: 3159, hp: 14123 } });
    expect(withCalculatorStat(preset, 'defender', 'defenderArtifactLevel', 18, catalog.artifacts)).toMatchObject({ artifactLevel: 18, targetStats: { atk: 3109, hp: 14046 } });
  });

  it('maps defender attack, HP, defense and artifact from its equipment preset', () => {
    const result = applyBuildToCalculator('defender', preset, catalog, { targetCurrentHP: 10000, targetMaxHP: 10000 });
    expect(result.values).toMatchObject({
      targetAttack: 3210,
      targetMaxHP: 14200,
      targetDefense: 1180,
      targetSpeed: 247,
      defenderArtifactCode: 'portrait-of-the-saviors',
      defenderArtifactLevel: 30,
    });
  });

  it('writes calculator artifact changes back to the shared build preset', () => {
    const changed = withCalculatorArtifact(preset, 'replacement', 30, catalog.artifacts);
    expect(changed).toMatchObject({
      artifactCode: 'replacement',
      artifactName: 'Replacement',
      artifactLevel: 30,
      targetStats: { atk: 3132, hp: 14486, def: 1180 },
    });
    expect(withCalculatorArtifact(changed, 'noProc', 30, catalog.artifacts)).toMatchObject({
      artifactCode: null,
      artifactName: null,
      artifactLevel: 30,
      targetStats: { atk: 2937, hp: 13784, def: 1180 },
    });
  });

  it('keeps library-only artifacts selectable without giving them a damage proc', () => {
    const benimaru = {
      ...catalog.artifacts[1],
      code: 'benimarus-tachi',
      name: '红丸之刀',
      nameEn: "Benimaru's Tachi",
    };
    expect(calculatorArtifactIdForLibraryArtifact(benimaru)).toBe('benimarus-tachi');
    expect(libraryArtifactForCalculatorId('benimarus-tachi', [...catalog.artifacts, benimaru])).toBe(benimaru);
  });
});
