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

  const cappedForms = [
    ['s1_bis', false], ['s2_bis', false], ['s2_bis', true], ['s3', false],
  ] as const;

  it.each(cappedForms)('caps speed-derived crit damage at 350%% for %s (burn=%s)', (skillId, burn) => {
    const values = { attack: 2500, critDamage: 300, casterSpeed: 300, targetDefense: 1500 };
    const fast = new DamageEngine('rhianna_and_luciella', 'noProc', values);
    const atCap = new DamageEngine('rhianna_and_luciella', 'noProc', { ...values, critDamage: 350, casterSpeed: 0 });
    expect(fast.getDamage(fast.currentHero.skills[skillId], burn)).toEqual(atCap.getDamage(atCap.currentHero.skills[skillId], burn));
  });

  it('retains the full speed bonus below the cap and includes regular crit buffs in that cap', () => {
    const values = { attack: 2500, targetDefense: 1500 };
    const engine = (critDamage: number, casterSpeed: number, buffs = {}) => new DamageEngine('rhianna_and_luciella', 'noProc', { ...values, critDamage, casterSpeed, ...buffs });
    const below = engine(250, 300), expected = engine(340, 0);
    expect(below.getDamage(below.currentHero.skills.s1_bis)).toEqual(expected.getDamage(expected.currentHero.skills.s1_bis));
    const buffed = engine(300, 300, { increasedCritDamage: true, casterPerception: true }), capped = engine(350, 0);
    expect(buffed.getDamage(buffed.currentHero.skills.s1_bis)).toEqual(capped.getDamage(capped.currentHero.skills.s1_bis));
  });

  it('still adds artifact critical damage after the 350% cap', () => {
    const values = { attack: 2500, critDamage: 300, casterSpeed: 300, targetDefense: 1500, artifactLevel: 30, attackSkillStack: 6 };
    const artifact = new DamageEngine('rhianna_and_luciella', 'frantic_flight', values);
    const noArtifact = new DamageEngine('rhianna_and_luciella', 'noProc', { ...values, critDamage: 350, casterSpeed: 0 });
    const actual = artifact.getDamage(artifact.currentHero.skills.s1_bis).crit!;
    const baseline = noArtifact.getDamage(noArtifact.currentHero.skills.s1_bis).crit!;
    expect(actual).toBeGreaterThan(baseline);
    expect(actual / baseline).toBeCloseTo(3.74 / 3.5, 3);
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
