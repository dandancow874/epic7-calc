import { describe, expect, it } from 'vitest';
import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import { DamageFormData } from '../../app/models/forms';
import { DoT, HitType, Skill } from '../../app/models/skill';

describe('May and July 2026 balance data', () => {
  it('treats Tenebria S1 as a two-target attack, not single-target or AoE', () => {
    const form = new DamageFormData({});
    const skill = Heroes.tenebria.skills.s1;

    expect(skill.isSingle(form, false)).toBe(false);
    expect(skill.isAOE(form, false)).toBe(false);
    expect(skill.rate(false, form, false)).toBe(1.2);
  });

  it('uses Tenebria updated S2 multipliers', () => {
    const form = new DamageFormData({});
    const skill = Heroes.tenebria.skills.s2;

    expect(skill.rate(false, form, false)).toBe(1);
    expect(skill.rate(true, form, false)).toBe(1.25);
  });

  it('uses Pirate Captain Flan current crit and bomb-only detonation rules', () => {
    const hero = Heroes.pirate_captain_flan;

    expect(hero.skills.s1.noCrit).toBe(false);
    expect(hero.skills.s3.noCrit).toBe(false);
    expect(hero.skills.s1.detonate).toBe(DoT.bomb);
    expect(hero.dot).toEqual([DoT.bomb]);
  });

  it('applies Sword of Autumn Eclipse attack by artifact level', () => {
    const artifact = Artifacts.sword_of_autumn_eclipse;
    const form = new DamageFormData({});
    const skill = new Skill({ id: 's1' });

    expect(artifact.getAttackBoost(0, form, skill, false, HitType.normal)).toBeCloseTo(0.05);
    expect(artifact.getAttackBoost(30, form, skill, false, HitType.normal)).toBeCloseTo(0.1);
  });

  it('uses Schniel updated barrier ratios', () => {
    const hero = Heroes.schniel;
    const form = new DamageFormData({ casterMaxHP: 20000 });
    const artifact = Artifacts.noProc;

    expect(hero.barrier).toBeDefined();
    expect(hero.barrier!(hero, hero.skills.s3, artifact, form, 1, false)).toBe(3000);
    expect(hero.barrier!(hero, hero.skills.s3, artifact, form, 1, true)).toBe(3800);
  });
});
