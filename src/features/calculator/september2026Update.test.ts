import { describe, expect, it } from 'vitest';
import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import { SkillIDs } from '../../assets/data/skill_ids';
import { DamageFormData, FormDefaults } from '../../app/models/forms';
import { HitType } from '../../app/models/skill';
import { DamageEngine } from '../../calc/damageEngine';

const artifact = {} as never;

describe('September 2026 heroes and balance update', () => {
  it('adds Haru with HP scaling, barrier penetration, and five S3 stacks', () => {
    expect(Heroes.haru.baseHP).toBe(7323);
    expect(Heroes.haru.skills.s1.flatTip()).toEqual({ casterMaxHP: 12 });
    expect(Heroes.haru.skills.s1_bis.penetrate(false, new DamageFormData({}), artifact, 0, 0)).toBe(1);
    expect(Heroes.haru.skills.s3.mult(false, new DamageFormData({ skill3Stack: 5 }), artifact, 0)).toBe(3.25);
    expect(Heroes.haru.skills.s3.penetrate(false, new DamageFormData({ targetHasBarrier: true }), artifact, 0, 0)).toBe(0.7);
    expect(Heroes.haru.heroSpecificMaximums.skill3Stack).toBe(5);
    expect(SkillIDs.haru.s1_bis).toBe('sk_c1192_1');
  });

  it('adds Renoa with ten soul bullets and splits more than five across two targets', () => {
    expect(Heroes.renoa.baseDefense).toBe(603);
    expect(Heroes.renoa.skills.s1.flatTip()).toEqual({ caster_defense: 150 });
    expect(Heroes.renoa.skills.s1_bis.flatTip()).toEqual({ caster_defense: 300 });
    expect(Heroes.renoa.skills.s2.skillDamageMultiplier(false, new DamageFormData({ renoaSoulBullets: 0 }), artifact, 0)).toBe(1);
    expect(Heroes.renoa.skills.s2.skillDamageMultiplier(false, new DamageFormData({ renoaSoulBullets: 1 }), artifact, 0)).toBe(2);
    expect(Heroes.renoa.skills.s2.skillDamageMultiplier(false, new DamageFormData({ renoaSoulBullets: 5 }), artifact, 0)).toBe(6);
    expect(Heroes.renoa.skills.s2.skillDamageMultiplier(false, new DamageFormData({ renoaSoulBullets: 10 }), artifact, 0)).toBe(6);
    expect(FormDefaults.renoaSoulBullets).toMatchObject({ min: 0, max: 10, defaultValue: 0 });
    expect(Heroes.renoa.heroSpecificMaximums.renoaSoulBullets).toBe(10);
    expect(Heroes.renoa.skills.s1.enhance).toHaveLength(8);
    expect(Heroes.renoa.skills.s1.enhance.reduce((sum, value) => sum + value, 0)).toBeCloseTo(.45);
    const unenhancedS1 = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000, targetDefense: 1000, molagoras1: 0,
    }).getDamage(Heroes.renoa.skills.s1).normal!;
    const enhancedS1 = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000, targetDefense: 1000, molagoras1: 8,
    }).getDamage(Heroes.renoa.skills.s1).normal!;
    expect(enhancedS1 / unenhancedS1).toBeCloseTo(1.45, 2);
    const oneBulletS2 = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000, renoaSoulBullets: 1, targetDefense: 1000,
    }).getDamage(Heroes.renoa.skills.s2).normal!;
    const fiveBulletS2 = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000, renoaSoulBullets: 5, targetDefense: 1000,
    }).getDamage(Heroes.renoa.skills.s2).normal!;
    const unityFiveBulletS2 = new DamageEngine('renoa', 'a_symbol_of_unity', {
      artifactLevel: 30, casterDefense: 1000, renoaSoulBullets: 5, targetDefense: 1000,
    }).getDamage(Heroes.renoa.skills.s2).normal!;
    expect(fiveBulletS2 / oneBulletS2).toBeCloseTo(3, 2);
    expect(unityFiveBulletS2 / fiveBulletS2).toBeCloseTo(1.16, 2);
    const reportedFiveBulletCrit = new DamageEngine('renoa', 'a_symbol_of_unity', {
      artifactLevel: 30,
      attack: 1678,
      casterDefense: 2033,
      critDamage: 150,
      elementalAdvantage: true,
      penetrationSet: true,
      renoaSoulBullets: 10,
      renoaSoulBulletsOnTarget: 5,
      targetDefense: 1487,
    }).getDamage(Heroes.renoa.skills.s2).crit;
    expect(reportedFiveBulletCrit).toBe(42237);
    expect(Heroes.renoa.getSpeed(new DamageFormData({ casterSpeed: 100, renoaSoulBullets: 10 }))).toBe(300);

    const sixBulletRows = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000,
      casterSpeed: 100,
      critDamage: 150,
      renoaSoulBullets: 6,
      targetDefense: 1000,
    }).updateDamages().filter((row) => row.skill === 'renoaSoulBullet');
    expect(sixBulletRows.map((row) => row.variant)).toEqual(['a', 'b']);
    expect(Math.abs((sixBulletRows[0].normal ?? 0) - (sixBulletRows[1].normal ?? 0) * 3)).toBeLessThanOrEqual(1);

    const tenBulletRows = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000,
      casterSpeed: 100,
      critDamage: 250,
      renoaSoulBullets: 10,
      targetDefense: 1000,
    }).updateDamages().filter((row) => row.skill === 'renoaSoulBullet');
    expect(tenBulletRows.map((row) => row.variant)).toEqual(['a', 'b']);
    expect(tenBulletRows[0].normal).toBe(tenBulletRows[1].normal);

    const fiveBulletCrit = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000,
      critDamage: 250,
      renoaSoulBullets: 5,
      targetDefense: 1000,
    }).getDamage(Heroes.renoa.skills.s1).crit;
    const tenBulletCrit = new DamageEngine('renoa', 'noProc', {
      casterDefense: 1000,
      critDamage: 250,
      renoaSoulBullets: 10,
      targetDefense: 1000,
    }).getDamage(Heroes.renoa.skills.s1).crit;
    expect(tenBulletCrit).toBe(fiveBulletCrit);
    const artifactCrit = new DamageEngine('renoa', 'air_to_surface_missile_misha', {
      artifactLevel: 30,
      casterDefense: 1000,
      critDamage: 250,
      renoaSoulBullets: 10,
      targetDefense: 1000,
    }).getDamage(Heroes.renoa.skills.s1).crit;
    expect(artifactCrit).toBeGreaterThan(tenBulletCrit ?? 0);
    expect(SkillIDs.renoa.s2).toBe('pa_c1193_2');
  });

  it('updates Abyssal Yufine, Kawerik, and Shadow Rose while preserving old formulas', () => {
    const input = new DamageFormData({ numberOfTargets: 2, casterSpeed: 300, targetSpeed: 300 });
    expect(Heroes.abyssal_yufine.skills.s1_bis.rate(false, input, false)).toBe(0.43);
    expect(Heroes.abyssal_yufine.skills.s1_bis.penetrate(false, input, artifact, 0, 0)).toBe(1);
    expect(Heroes.abyssal_yufine_old.skills.s1_bis.rate(false, input, false)).toBe(0.8);
    expect(Heroes.kawerik.skills.s1.rate(false, input, false)).toBe(1.2);
    expect(Heroes.kawerik.skills.s3.rate(false, input, false)).toBe(1.1);
    expect(Heroes.kawerik.skills.s3.penetrate(false, input, artifact, 0, 0)).toBe(0.5);
    expect(Heroes.kawerik_old.skills.s3.rate(false, input, false)).toBe(0.8);
    expect(Heroes.shadow_rose.skills.s3.rate(false, input, false)).toBe(1);
    expect(Heroes.shadow_rose.skills.s3.mult(false, input, artifact, 0)).toBe(2);
    expect(Heroes.shadow_rose_old.skills.s3.rate(false, input, false)).toBe(1.05);
  });

  it('updates the Mercedes, Choux, Axe, and Glenn formulas', () => {
    expect(Heroes.celestial_mercedes.skills.s1.flatTip()).toEqual({ targetMaxHP: 2 });
    expect(Heroes.celestial_mercedes.skills.s2.rate(true, new DamageFormData({}), false)).toBe(1.05);
    expect(Heroes.celestial_mercedes.skills.s2.flatTip(true)).toEqual({ targetMaxHP: 5 });

    const choux = Heroes.urban_shadow_choux;
    expect(choux.skills.s1.rate(true, new DamageFormData({}), false)).toBe(0.65);
    expect(choux.skills.s1.flatTip(true)).toEqual({ casterMaxHP: 13 });
    expect(choux.skills.s1.afterMath(HitType.crit, new DamageFormData({}), true).injuryPercent).toBe(0.4);
    expect(choux.skills.s3.flatTip()).toEqual({ casterMaxHP: 20 });
    expect(choux.skills.s3.penetrate(false, new DamageFormData({}), artifact, 0, 0)).toBe(0.5);

    expect(Heroes.chaos_sect_axe.baseHP).toBe(6013);
    expect(Heroes.chaos_sect_axe.skills.s3.rate(true, new DamageFormData({}), false)).toBe(1.5);
    expect(Heroes.chaos_sect_axe.skills.s3.flatTip(true)).toEqual({ casterMaxHP: 30 });
    expect(Heroes.church_of_ilryos_axe.skills.s1.rate(false, new DamageFormData({}), false)).toBe(0.7);
    expect(Heroes.church_of_ilryos_axe.skills.s3.flatTip(true)).toEqual({ casterMaxHP: 30 });

    const glennInput = new DamageFormData({ skillTreeCompleted: true, casterAboveHalfHP: true });
    expect(Heroes.vigilante_leader_glenn.baseAttack).toBe(1026);
    expect(Heroes.vigilante_leader_glenn.skills.s1.mult(false, glennInput, artifact, 0)).toBeCloseTo(1.3);
    expect(Heroes.vigilante_leader_glenn.skills.s2.mult(false, glennInput, artifact, 0)).toBeCloseTo(1.3);
  });

  it('updates Sphere of Sadism and Spear of a New Dawn', () => {
    expect(Artifacts.sphere_of_sadism.scale[0]).toBe(0.08);
    expect(Artifacts.sphere_of_sadism.scale[10]).toBe(0.16);
    expect(Artifacts.sphere_of_sadism.applies(Heroes.haru.skills.s1, new DamageFormData({ casterHasBarrier: false }), false, HitType.normal)).toBe(true);
    expect(Artifacts.spear_of_a_new_dawn.attackPercent).toBe(0.5);
  });
});
