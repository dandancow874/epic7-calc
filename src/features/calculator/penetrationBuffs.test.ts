import { describe, expect, it } from 'vitest';
import { DamageFormData } from '../../app/models/forms';
import { Target } from '../../app/models/target';
import { DoTSkill, HitType, Skill } from '../../app/models/skill';
import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import { DamageEngine } from '../../calc/damageEngine';

const normal = { casterHasIncreasePenetration: true };
const greater = { casterHasIncreasePenetrationGreater: true };
const single = new Skill({ id: 's1', isSingle: () => true });
const aoe = new Skill({ id: 's3', isAOE: () => true });
const remainingDefense = (skill: Skill, values = {}) => new Target().getPenetration(
  skill, new DamageFormData(values), Artifacts.noProc, false, 2500, 200, HitType.normal,
);

describe('normal and greater penetration buffs', () => {
  it('automatically doubles the buff for single attacks, using 25/35% for AOE', () => {
    expect(remainingDefense(single, normal)).toBeCloseTo(.5);
    expect(remainingDefense(single, greater)).toBeCloseTo(.3);
    expect(remainingDefense(aoe, normal)).toBeCloseTo(.75);
    expect(remainingDefense(aoe, greater)).toBeCloseTo(.65);
  });

  it('uses the current soulburn variant to decide whether the attack is single', () => {
    const skill = new Skill({ id: 's1', isSingle: (_form: DamageFormData, soulburn: boolean) => !soulburn, isAOE: (_form: DamageFormData, soulburn: boolean) => soulburn });
    const form = new DamageFormData(normal), target = new Target();
    expect(target.getPenetration(skill, form, Artifacts.noProc, false, 2500, 200, HitType.normal)).toBeCloseTo(.5);
    expect(target.getPenetration(skill, form, Artifacts.noProc, true, 2500, 200, HitType.normal)).toBeCloseTo(.75);
  });

  it('keeps the greater state exclusive even when imported data has both flags', () => {
    const form = new DamageFormData({ ...normal, ...greater });
    expect(form.casterHasIncreasePenetration).toBe(false);
    expect(form.casterHasIncreasePenetrationGreater).toBe(true);
    expect(remainingDefense(single, { ...normal, ...greater })).toBeCloseTo(.3);
  });

  it('combines independent skill, set and buff penetration multiplicatively', () => {
    const skill = new Skill({ id: 's1', isSingle: () => true, penetrate: () => .5 });
    expect(remainingDefense(skill, { ...normal, penetrationSet: true })).toBeCloseTo(.5 * .85 * .5);
    expect(remainingDefense(skill, { ...greater, penetrationSet: true })).toBeCloseTo(.5 * .85 * .3);
  });

  it('reduces each attack penetration source by target penetration resistance', () => {
    expect(remainingDefense(single, { ...normal, penetrationResistance: 50 })).toBeCloseTo(.75);
    expect(remainingDefense(single, { ...greater, penetrationResistance: 50 })).toBeCloseTo(.65);
    expect(remainingDefense(single, { ...greater, penetrationResistance: 100 })).toBe(1);
  });

  it('does not add attack penetration buffs to fixed-penetration damage', () => {
    for (const values of [normal, greater, { ...greater, penetrationResistance: 100 }]) {
      expect(remainingDefense(DoTSkill, values)).toBeCloseTo(.3);
    }
    const plain = new DamageEngine('tactical_archetype_coli', 'noProc', { attack: 4000, targetDefense: 2000, targetBombDetonate: 1 });
    const buffed = new DamageEngine('tactical_archetype_coli', 'noProc', { attack: 4000, targetDefense: 2000, targetBombDetonate: 1, ...greater });
    expect(buffed.getDetonateDamage(false, Heroes.tactical_archetype_coli.skills.s3))
      .toBe(plain.getDetonateDamage(false, Heroes.tactical_archetype_coli.skills.s3));
  });

  it('gives both Moro attacks the doubled benefit in the complete damage calculation', () => {
    const hero = Heroes.bunny_girl_great_detective_moro;
    for (const [values, remaining] of [[normal, .5], [greater, .3]] as const) {
      const engine = new DamageEngine('bunny_girl_great_detective_moro', 'noProc', {
        attack: 2500, targetDefense: 2000, critDamage: 250, molagoras1: 5, molagoras3: 5, ...values,
      });
      for (const [skill, rate] of [[hero.skills.s1, 1], [hero.skills.s3, 1.5]] as const) {
        const expected = 2500 * rate * 1.871 * 1.3 / (1 + 2000 * remaining / 300);
        expect(engine.getDamage(skill).normal).toBe(Math.round(expected));
        expect(engine.getDamage(skill).crit).toBe(Math.round(expected * 2.5));
      }
    }
  });
});
