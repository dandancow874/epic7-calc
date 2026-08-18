import { describe, expect, it } from 'vitest';
import { Heroes } from '../../assets/data/heroes';
import { DamageFormData } from '../../app/models/forms';
import { HitType } from '../../app/models/skill';

describe('new heroes and balance variants', () => {
  it('does not expose pre-balance Old entries in the calculator hero list', () => {
    expect(Object.keys(Heroes).filter((id) => id.endsWith('_old'))).toEqual([]);
  });

  it('loads Aube and Tidal Rift Elvira from the current library multipliers', () => {
    expect(Heroes.aube.baseAttack).toBe(993);
    expect(Heroes.aube.skills.s1.rate(false, new DamageFormData({}), false)).toBe(1);
    expect(Heroes.aube.skills.s1.enhance.reduce((total, value) => total + value, 0)).toBeCloseTo(0.3);

    const elvira = Heroes.tidal_rift_elvira;
    expect(elvira.baseAttack).toBe(1102);
    expect(elvira.skills.s1.rate(false, new DamageFormData({}), false)).toBe(0.75);
    expect(elvira.skills.s1.soulburn).toBe(false);
    expect(elvira.skills.s1.enhance.reduce((total, value) => total + value, 0)).toBeCloseTo(0.35);
    expect(elvira.skills.s1_extra.rate(false, new DamageFormData({}), true)).toBe(0.3);
    expect(elvira.skills.s3.rate(false, new DamageFormData({}), false)).toBe(1.8);
    expect(elvira.skills.s3.enhance.reduce((total, value) => total + value, 0)).toBeCloseTo(0.35);
    for (const skill of [elvira.skills.s1, elvira.skills.s1_extra, elvira.skills.s3]) {
      expect(skill.noCrit).toBe(true);
      expect(skill.penetrate(false, new DamageFormData({}), {} as never, 0, 0)).toBe(1);
    }
  });

  it('applies the published balance values to the current hero entries', () => {
    expect(Heroes.aki.baseAttack).toBe(966);
    expect(Heroes.aki.skills.s1.rate(false, new DamageFormData({}), false)).toBe(0.2);
    expect(Heroes.aki.skills.s1.detonation(false, new DamageFormData({}))).toBe(1.4);
    expect(Heroes.aki.skills.s3.detonation(false, new DamageFormData({}))).toBe(1.4);

    expect(Heroes.blooming_lidica.skills.s3.flatTip()).toEqual({ casterMaxHP: 42 });
    expect(Heroes.dark_corvus.skills.s3.flatTip(false)).toEqual({ casterMaxHP: 31 });
    expect(Heroes.dark_corvus.skills.s3.ignoreDamageTransfer(new DamageFormData({}))).toBe(true);

    expect(Heroes.jenua.skills.s1.attackModifier(false, new DamageFormData({}))).toBe(0.5);
    expect(Heroes.jenua.skills.s1.attackModifier(true, new DamageFormData({}))).toBe(0.75);
    expect(Heroes.jenua.skills.s1.attackModifier(false, new DamageFormData({ attackUpGreat: true }))).toBe(0);

    expect(Heroes.little_queen_charlotte.skills.s3.rate(false, new DamageFormData({}), false)).toBe(1.65);
    expect(Heroes.little_queen_charlotte.skills.s3.mult(false, new DamageFormData({ elementalAdvantage: true }), {} as never, 0)).toBe(1.35);

    expect(Heroes.schniel.skills.s3.pow(false, new DamageFormData({}))).toBe(1.1);
    expect(Heroes.schniel.skills.s3.fixed(HitType.miss, new DamageFormData({ skill3Stack: 0 }), {} as never, false)).toBe(5000);
  });
});
