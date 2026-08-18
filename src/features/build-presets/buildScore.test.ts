import { describe, expect, it } from 'vitest';
import type { LibraryArtifact, LibraryHero } from '../../library/types';
import { artifactStatsAtLevel, calculateGearScore, targetStatsAfterArtifactChange } from './buildScore';
import { emptyTargetStats, type BuildPreset } from './types';

const hero = {
  code: 'rhianna-and-luciella', baseStats: { atk: 1003, hp: 5057, def: 511, spd: 132, chc: .35, chd: 1.5, eff: 0, efr: 0 },
  devotion: [{ self_type: 'cri', self_effect_max: '.18' }], exclusives: [],
} as unknown as LibraryHero;
const artifact = { code: 'violet-talisman', stats: { atk: 273, hp: 416, def: 0 } } as LibraryArtifact;
const preset = {
  id: 'sample', heroCode: hero.code, name: '截图', source: 'manual', artifactCode: artifact.code, artifactLevel: 24, imprintMode: 'self',
  sets: ['set_speed', 'set_cri'], rightMainStats: { necklace: 'chd', ring: 'atk_rate', boots: 'spd' },
  targetStats: { ...emptyTargetStats, atk: 2803, hp: 9497, def: 892, spd: 316, chc: 100, chd: 241, eff: 16, efr: 22 },
} as BuildPreset;

describe('equipment score inference', () => {
  it('derives artifact stats for a selected enhancement level', () => {
    expect(artifactStatsAtLevel(artifact, 24)).toEqual({ atk: 222, hp: 339, def: 0 });
    expect(artifactStatsAtLevel(artifact, 30)).toEqual({ atk: 273, hp: 416, def: 0 });
  });

  it('updates the visible final panel by the artifact stat difference', () => {
    const replacement = { code: 'replacement', stats: { atk: 195, hp: 702, def: 0 } } as LibraryArtifact;
    const current = { ...preset.targetStats, atk: 2803, hp: 9497, def: 892 };
    expect(targetStatsAfterArtifactChange(current, artifact, 24, replacement, 30)).toMatchObject({
      atk: 2776,
      hp: 9860,
      def: 892,
    });
  });

  it('updates the visible final panel when only the artifact level changes', () => {
    const current = { ...preset.targetStats, atk: 2803, hp: 9497, def: 892 };
    expect(targetStatsAfterArtifactChange(current, artifact, 24, artifact, 30)).toMatchObject({
      atk: 2854,
      hp: 9574,
      def: 892,
    });
  });

  it('reproduces the bot-style average score and average speed', () => {
    const result = calculateGearScore(hero, preset, artifact)!;
    expect(result.average).toBeCloseTo(67.51, 1);
    expect(result.averageSpeed).toBe(21.2);
    expect(result.mains).toEqual({ necklace: 'chd', ring: 'atk_rate', boots: 'spd' });
  });

  it('scales a self imprint by the selected B-to-SSS rank', () => {
    const maxRank = calculateGearScore(hero, { ...preset, imprintRank: 'SSS' }, artifact)!;
    const sRank = calculateGearScore(hero, { ...preset, imprintRank: 'S' }, artifact)!;
    expect(sRank.residuals.chc - maxRank.residuals.chc).toBeCloseTo(6, 2);
  });

  it('infers the constrained right-side main stats', () => {
    const result = calculateGearScore(hero, { ...preset, rightMainStats: { necklace: 'auto', ring: 'auto', boots: 'auto' } }, artifact)!;
    expect(result.mains).toEqual({ necklace: 'chd', ring: 'atk_rate', boots: 'spd' });
  });

  it('removes Lethe passive HP before reproducing the bot score', () => {
    const lethe = {
      code: 'lethe',
      baseStats: { atk: 885, hp: 6149, def: 613, spd: 121, chc: .15, chd: 1.5, eff: .18, efr: 0 },
      devotion: [],
      exclusives: [{ id: 'ee', mainStat: { type: 'max_hp_rate', min: .07, max: .14 } }],
      gearScoreAdjustments: { finalMultipliers: { hp: 1.1 }, additivePercentPoints: {}, libraryBaseStatsIncludes: [] },
    } as unknown as LibraryHero;
    const prayer = { code: 'prayer-of-solitude', stats: { atk: 195, hp: 702, def: 0 } } as LibraryArtifact;
    const lethePreset = {
      ...preset,
      heroCode: 'lethe',
      artifactCode: prayer.code,
      artifactLevel: 15,
      imprintMode: 'team',
      exclusiveEquipmentId: 'ee',
      sets: ['set_speed', 'set_max_hp'],
      rightMainStats: { necklace: 'hp_rate', ring: 'hp_rate', boots: 'spd' },
      targetStats: { ...emptyTargetStats, atk: 1515, hp: 27509, def: 1080, spd: 290, chc: 15, chd: 157, eff: 83, efr: 17 },
    } as BuildPreset;

    const result = calculateGearScore(lethe, lethePreset, prayer)!;
    expect(result.residuals.hp).toBeCloseTo(90.45, 2);
    expect(result.residuals.spd).toBe(94);
    expect(result.total).toBe(393.94);
    expect(result.average).toBe(65.66);
    expect(result.averageSpeed).toBe(18.8);
  });

  it('removes Dragon Bride Senya passive HP before reproducing the bot score', () => {
    const senya = {
      code: 'dragon-bride-senya',
      baseStats: { atk: 894, hp: 6840, def: 694, spd: 104, chc: .15, chd: 1.5, eff: 0, efr: 0 },
      devotion: [{ self_type: 'max_hp_rate', self_effect_max: '.18' }],
      exclusives: [],
      gearScoreAdjustments: { finalMultipliers: { hp: 1.1 }, additivePercentPoints: {}, libraryBaseStatsIncludes: [] },
    } as unknown as LibraryHero;
    const bastion = { code: 'bastion-of-perlutia', stats: { atk: 117, hp: 988, def: 0 } } as LibraryArtifact;
    const senyaPreset = {
      ...preset,
      heroCode: senya.code,
      artifactCode: bastion.code,
      artifactLevel: 15,
      sets: ['set_max_hp', 'set_speed'],
      rightMainStats: { necklace: 'hp_rate', ring: 'hp_rate', boots: 'spd' },
      targetStats: { ...emptyTargetStats, atk: 1472, hp: 33249, def: 1916, spd: 222, chc: 15, chd: 150, eff: 22, efr: 35 },
    } as BuildPreset;

    const result = calculateGearScore(senya, senyaPreset, bastion)!;
    expect(result.residuals.hp).toBeCloseTo(124.68, 2);
    expect(result.total).toBe(407.09);
    expect(result.average).toBe(67.85);
    expect(result.averageSpeed).toBe(9.4);
  });

  it('removes Beehoo passive Attack without double-counting embedded Effectiveness', () => {
    const beehoo = {
      code: 'beehoo',
      baseStats: { atk: 993, hp: 6002, def: 611, spd: 120, chc: .15, chd: 1.5, eff: .3, efr: 0 },
      devotion: [],
      exclusives: [{ id: 'ee', mainStat: { type: 'acc', min: .08, max: .16 } }],
      gearScoreAdjustments: {
        finalMultipliers: { atk: 1.3 },
        additivePercentPoints: { eff: 30 },
        libraryBaseStatsIncludes: ['eff'],
      },
    } as unknown as LibraryHero;
    const seal = { code: 'seal-of-capture', stats: { atk: 273, hp: 416, def: 0 } } as LibraryArtifact;
    const beehooPreset = {
      ...preset,
      heroCode: beehoo.code,
      artifactCode: seal.code,
      artifactLevel: 15,
      imprintMode: 'team',
      exclusiveEquipmentId: 'ee',
      sets: ['set_speed', 'set_acc'],
      rightMainStats: { necklace: 'atk_rate', ring: 'atk_rate', boots: 'spd' },
      targetStats: { ...emptyTargetStats, atk: 4218, hp: 14360, def: 1012, spd: 282, chc: 15, chd: 156, eff: 158, efr: 6 },
    } as BuildPreset;

    const result = calculateGearScore(beehoo, beehooPreset, seal)!;
    expect(result.residuals.atk).toBeCloseTo(29.08, 2);
    expect(result.residuals.eff).toBe(92);
    expect(result.total).toBe(411.01);
    expect(result.average).toBe(68.5);
    expect(result.averageSpeed).toBe(17.4);
  });
});
