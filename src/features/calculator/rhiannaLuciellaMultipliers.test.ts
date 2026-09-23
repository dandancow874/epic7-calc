import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';

describe('Rhianna and Luciella calculator multipliers', () => {
  const engine = new DamageEngine('rhianna_and_luciella', 'noProc', { attack: 2500 });
  const { skills } = engine.currentHero;

  it('keeps the Rhianna and Luciella skill forms separate', () => {
    expect(skills.s1.rate(false, engine.form, false)).toBeCloseTo(0.7);
    expect(skills.s1.pow(false, engine.form)).toBeCloseTo(0.95);
    expect(skills.s1_bis.rate(false, engine.form, false)).toBeCloseTo(1);
    expect(skills.s1_bis.pow(false, engine.form)).toBeCloseTo(0.95);

    expect(skills.s2.rate(false, engine.form, false)).toBeCloseTo(1);
    expect(skills.s2.pow(false, engine.form)).toBeCloseTo(1);
    expect(skills.s2_bis.rate(false, engine.form, false)).toBeCloseTo(1.5);
    expect(skills.s2_bis.rate(true, engine.form, false)).toBeCloseTo(3);
    expect(skills.s2_bis.pow(false, engine.form)).toBeCloseTo(1);
  });

  it('uses the 1.3 AOE S3 and 160% attack barrier', () => {
    expect(skills.s3.rate(false, engine.form, false)).toBeCloseTo(1.3);
    expect(skills.s3.pow(false, engine.form)).toBeCloseTo(1);
    expect(skills.s3.isAOE(engine.form, false)).toBe(true);
    expect(skills.s3.ignoreDamageTransfer(engine.form)).toBe(true);
    expect(engine.getBarriers()).toEqual([{ label: 'S3', value: 4000 }]);
  });

  it('scales Luciella critical-damage bonus from speed', () => {
    const fast = new DamageEngine('rhianna_and_luciella', 'noProc', { attack: 2500, casterSpeed: 300 });
    expect(fast.currentHero.skills.s1_bis.critDmgBoost(false, fast.form)).toBeCloseTo(.9);
    expect(fast.currentHero.skills.s2_bis.critDmgBoost(false, fast.form)).toBeCloseTo(.9);
  });

  it('exposes all damage forms in the calculator rows', () => {
    const rows = engine.updateDamages();
    expect(rows.map((row) => row.skill)).toEqual(expect.arrayContaining([
      'rhiannaAndLuciellaS1Rhianna',
      'rhiannaAndLuciellaS1Luciella',
      'rhiannaAndLuciellaS2Rhianna',
      'rhiannaAndLuciellaS2Luciella',
      'rhiannaAndLuciellaS2Luciella_soulburn',
      's3',
    ]));
  });
});
