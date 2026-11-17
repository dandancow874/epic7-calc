import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import type { LibraryArtifact } from '../../library/types';
import { withCalculatorArtifact } from '../build-presets/calculatorBuildBridge';
import { emptyTargetStats, type BuildPreset } from '../build-presets/types';
import { mergeCalculatorValues } from './mergeCalculatorValues';
import {
  artifactDamageIncrease, attackerWithArtifact, compareArtifact, comparisonDamage, comparisonRowKey, formatArtifactIncrease, isArtifactAutoComparisonAllowed,
  type ArtifactComparisonContext,
} from './artifactComparison';

const base: ArtifactComparisonContext = {
  heroId: 'abigail', defenderId: 'abigail', artifacts: [],
  attacker: { attack: 2500, critDamage: 250, casterMaxHP: 25000, useBuildPreset: false },
  defender: { targetMaxHP: 30000, targetDefense: 2000 },
};
const key = (context = base) => comparisonRowKey(compareArtifact(context, 'noProc').rows[0]);

describe('artifact picker damage comparison', () => {
  it('excludes the three monster-only artifacts from automatic calculation', () => {
    for (const id of ['special_strawberry_cake', 'our_beautiful_seasons', 'radiant_forever']) {
      expect(isArtifactAutoComparisonAllowed(id)).toBe(false);
      expect(compareArtifact(base, id)).toEqual({ artifactId: id, rows: [], supported: false });
    }
    expect(isArtifactAutoComparisonAllowed('a_symbol_of_unity')).toBe(true);
  });
  it('uses no artifact as the baseline, independent of the currently equipped artifact', () => {
    const context = { ...base, attacker: { ...base.attacker, artifactId: 'uberius_tooth' } };
    const baseline = compareArtifact(context, 'noProc');
    expect(artifactDamageIncrease(baseline, baseline, key(context), 'crit')).toBe(0);
    expect(comparisonDamage(baseline, key(context), 'crit')).toBe(compareArtifact(base, 'noProc').rows[0].crit);
  });

  it('uses the existing additive damage bucket and current buffs instead of displaying the artifact description', () => {
    const context = { ...base, attacker: { ...base.attacker, attackUp: true, damageIncrease: 50 } };
    const baseline = compareArtifact(context, 'noProc');
    const result = compareArtifact(context, 'a_symbol_of_unity');
    expect(artifactDamageIncrease(result, baseline, key(context), 'crit')).toBeCloseTo(16 / 150 * 100, 1);
  });

  it('includes artifact aftermath separately for each hit type', () => {
    const baseline = compareArtifact(base, 'noProc');
    const result = compareArtifact(base, 'tome_of_lifes_end');
    expect(artifactDamageIncrease(result, baseline, key(), 'miss'))
      .toBeGreaterThan(artifactDamageIncrease(result, baseline, key(), 'crit')!);
    expect(comparisonDamage(result, key(), 'miss')).toBe(new DamageEngine(base.heroId, 'tome_of_lifes_end', {
      ...base.attacker, ...base.defender, artifactLevel: 30,
    }).updateDamages()[0].miss);
  });

  it('retains single-target, soulburn and conditional artifact rules', () => {
    const protectedContext = { ...base, attacker: { ...base.attacker, targetHasBarrier: true } };
    const plain = artifactDamageIncrease(compareArtifact(base, 'a_little_queens_crown'), compareArtifact(base, 'noProc'), key(), 'crit');
    const protectedGain = artifactDamageIncrease(compareArtifact(protectedContext, 'a_little_queens_crown'), compareArtifact(protectedContext, 'noProc'), key(), 'crit');
    expect(protectedGain).toBeGreaterThan(plain!);
    const rows = compareArtifact({ ...base, heroId: 'kise' }, 'noProc').rows;
    expect(new Set(rows.map(comparisonRowKey)).size).toBe(rows.length);
    expect(rows.some((row) => row.skill.endsWith('_soulburn'))).toBe(true);
  });

  it('keeps Renoa A and B as distinct choices and compares their actual totals', () => {
    const context = { ...base, heroId: 'renoa', attacker: { ...base.attacker, casterDefense: 2033, renoaSoulBullets: 7 } };
    const baseline = compareArtifact(context, 'noProc');
    const result = compareArtifact(context, 'a_symbol_of_unity');
    const a = baseline.rows.find((row) => row.variant === 'a')!, b = baseline.rows.find((row) => row.variant === 'b')!;
    expect(a).toBeDefined(); expect(b).toBeDefined();
    expect(comparisonRowKey(a)).not.toBe(comparisonRowKey(b));
    expect(comparisonDamage(result, comparisonRowKey(a), 'crit')).toBeGreaterThan(comparisonDamage(result, comparisonRowKey(b), 'crit')!);
    expect(artifactDamageIncrease(result, baseline, comparisonRowKey(a), 'crit')).toBeCloseTo(16, 1);
  });

  it('does not mutate manual panels, presets or current artifact state while previewing', () => {
    const original = structuredClone(base);
    expect(attackerWithArtifact(base, 'uberius_tooth')).toMatchObject({ attack: 2500, artifactLevel: 30, artifactId: 'uberius_tooth' });
    compareArtifact(base, 'tome_of_lifes_end');
    expect(base).toEqual(original);
  });

  it('removes the old artifact stats for the baseline and matches actual preset replacement stats', () => {
    const artifact = (code: string, atk: number, hp: number) => ({
      code, name: code, nameEn: code, stats: { atk, hp, def: 0 }, role: 'common',
    }) as LibraryArtifact;
    const artifacts = [artifact('portrait-of-the-saviors', 273, 416), artifact('a-symbol-of-unity', 195, 702)];
    const preset: BuildPreset = {
      id: 'test', heroCode: 'abigail', source: 'manual', name: 'test', sets: [],
      artifactCode: 'portrait-of-the-saviors', artifactLevel: 30,
      targetStats: { ...emptyTargetStats, atk: 2773, hp: 25416, def: 1000 },
    };
    const context = { ...base, artifacts, preset, attacker: { ...base.attacker, useBuildPreset: true } };
    const original = structuredClone(context);
    expect(attackerWithArtifact(context, 'noProc')).toMatchObject({ attack: 2500, casterMaxHP: 25000 });
    const expectedPreset = withCalculatorArtifact(preset, 'a_symbol_of_unity', 30, artifacts);
    const expectedAttacker = attackerWithArtifact(context, 'a_symbol_of_unity');
    expect(expectedAttacker).toMatchObject({ attack: expectedPreset.targetStats.atk, casterMaxHP: expectedPreset.targetStats.hp });
    const expected = new DamageEngine('abigail', 'a_symbol_of_unity', mergeCalculatorValues(expectedAttacker, base.defender, true, base.defenderId)).updateDamages();
    expect(compareArtifact(context, 'a_symbol_of_unity').rows).toEqual(expected);
    expect(context).toEqual(original);
  });

  it('marks unimplemented artifacts and unavailable hits or rows instead of ranking them as zero', () => {
    const unsupported = compareArtifact(base, 'not_implemented');
    const baseline = compareArtifact(base, 'noProc');
    expect(unsupported.supported).toBe(false);
    expect(artifactDamageIncrease(unsupported, baseline, key(), 'crit')).toBeNull();
    expect(artifactDamageIncrease(baseline, baseline, 'missing', 'crit')).toBeNull();
    const noCrit = { ...baseline, rows: baseline.rows.map((row) => ({ ...row, crit: null })) };
    expect(artifactDamageIncrease(noCrit, baseline, key(), 'crit')).toBeNull();
    const zero = { ...baseline, rows: baseline.rows.map((row) => ({ ...row, crit: 0 })) };
    expect(artifactDamageIncrease(baseline, zero, key(), 'crit')).toBeNull();
    expect(formatArtifactIncrease(null)).toBe('—');
    expect(formatArtifactIncrease(-0.01)).toBe('+0.0%');
  });
});
