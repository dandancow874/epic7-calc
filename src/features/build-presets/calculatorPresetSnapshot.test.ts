import { describe, expect, it } from 'vitest';
import { calculatorPresetSnapshot, presetEquipmentPieces } from './calculatorPresetSnapshot';
import { applyBuildToCalculator, withCalculatorStat, type CalculatorBuildCatalog } from './calculatorBuildBridge';
import { emptyTargetStats, type BuildPreset } from './types';
import { attackerWithArtifact } from '../calculator/artifactComparison';

const base: BuildPreset = {
  id: 'original', heroCode: 'genesis-ras', name: '原预设', source: 'manual',
  sets: ['set_cri_dmg', 'set_penetrate'], artifactCode: 'portrait-of-the-saviors',
  targetStats: { ...emptyTargetStats, atk: 3000, hp: 26000, def: 1400, spd: 210, chd: 280, chc: 100, eff: 40, efr: 80 },
};
const catalog = { heroes: [], community: [], artifacts: [
  { code: 'daydream-joker', name: '白日梦小丑', nameEn: 'Daydream Joker', nameZht: null, description: '', skillDescription: '', rarity: 3, role: 'common', limited: false, stats: { atk: 182, hp: 273, def: 0 }, image: null, artwork: null, publishDate: null },
] } as CalculatorBuildCatalog;
const input = {
  side: 'attacker' as const, heroId: 'genesis_ras', heroCode: 'genesis-ras', catalog, base, artifactId: 'daydream_joker',
  values: { useBuildPreset: false, attack: 2961, critDamage: 346, casterMaxHP: 27656, casterSpeed: 150, casterDefense: 750,
    artifactLevel: 24, attackIncrease: 8, casterHasSuperhumanization: true, penetrationSet: false, torrentSetStack: 1 },
};

describe('manual calculator panel to equipment preset', () => {
  it('takes visible manual stats and current artifact, retaining other template stats without applying buffs or artifact stats again', () => {
    const original = structuredClone(base);
    const { preset, currentStats } = calculatorPresetSnapshot(input);
    expect(preset.targetStats).toEqual({ ...base.targetStats, atk: 2961, chd: 346, hp: 27656 });
    expect(preset).toMatchObject({ artifactCode: 'daydream-joker', artifactLevel: 24, sets: ['set_cri_dmg', 'set_torrent'] });
    expect(currentStats).toEqual(expect.arrayContaining(['atk', 'chd', 'hp']));
    expect(preset).not.toHaveProperty('attackIncrease');
    expect(base).toEqual(original);
  });

  it('captures torrent stack count, penetration and pursuit and detects an impossible inherited set combination', () => {
    const { preset } = calculatorPresetSnapshot({ ...input, values: { ...input.values, torrentSetStack: 2, penetrationSet: true, pursuitSet: true } });
    expect(preset.sets).toEqual(['set_cri_dmg', 'set_penetrate', 'set_torrent', 'set_torrent', 'set_chase']);
    expect(presetEquipmentPieces(preset)).toBe(12);
  });

  it('creates the first preset without inventing hidden default stats; applying it preserves unknown calculator values', () => {
    const { preset } = calculatorPresetSnapshot({ ...input, heroId: 'kise', heroCode: 'kise', base: null });
    expect(preset.missingStats).toEqual(expect.arrayContaining(['hp', 'def', 'spd', 'chc', 'eff', 'efr']));
    expect(preset.missingStats).not.toContain('atk');
    const result = applyBuildToCalculator('attacker', preset, catalog, { casterMaxHP: 16000, casterDefense: 800, casterSpeed: 230, attackUp: true });
    expect(result.values).toMatchObject({ attack: 2961, critDamage: 346, casterMaxHP: 16000, casterDefense: 800, casterSpeed: 230, attackUp: true, torrentSetStack: 1 });
    const changed = attackerWithArtifact({ attacker: { ...result.values, useBuildPreset: true }, preset, artifacts: catalog.artifacts }, 'noProc');
    expect(changed).toMatchObject({ casterMaxHP: 16000, casterDefense: 800 });
    expect(withCalculatorStat(preset, 'attacker', 'casterMaxHP', 21000).missingStats).not.toContain('hp');
  });

  it('restores a saved snapshot set selection while leaving battle buffs intact', () => {
    const { preset } = calculatorPresetSnapshot({ ...input, base: null, values: { ...input.values, torrentSetStack: 2, penetrationSet: true, pursuitSet: false } });
    const result = applyBuildToCalculator('attacker', preset, catalog, { torrentSetStack: 0, penetrationSet: false, pursuitSet: true, casterVigor: true });
    expect(result.values).toMatchObject({ torrentSetStack: 2, penetrationSet: true, pursuitSet: false, casterVigor: true });
  });

  it('captures defender raw HP, defense, artifact and shield set without baking in superhumanization', () => {
    const { preset } = calculatorPresetSnapshot({ ...input, side: 'defender', values: {
      useBuildPreset: false, targetMaxHP: 25000, targetDefense: 1800, targetAttack: 1000,
      defenderArtifactCode: 'daydream-joker', defenderArtifactLevel: 18, targetShieldSet: true, targetHasSuperhumanization: true,
    } });
    expect(preset).toMatchObject({ targetStats: { hp: 25000, def: 1800, atk: 3000 }, artifactLevel: 18 });
    expect(preset.sets).toContain('set_shield');
    expect(applyBuildToCalculator('defender', preset, catalog, {}).values.targetShieldSet).toBe(true);
  });
});
