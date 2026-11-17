import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import { Heroes } from '../../assets/data/heroes';
import { withDerivedCalculatorFields } from './derivedFields';

const hero = Heroes.tactical_archetype_coli;
const base = { attack: 4000, targetDefense: 1500, critDamage: 250, molagoras1: 6, molagoras3: 6 };
const engine = (values: Record<string, unknown> = {}) => new DamageEngine('tactical_archetype_coli', 'noProc', { ...base, ...values });
const bleed = (attack: number, turns: number) => attack * .4 * 1.871 * 1.3 * turns / (1 + 1500 * .3 / 300);
const bomb = (attack: number, count: number) => attack * 1.5 * 1.871 * 1.2 * count / (1 + 1500 * .3 / 300);

describe('Tactical Archetype Coli detonation', () => {
  it('exposes both bleed duration and bomb count in calculator characteristics', () => {
    expect(withDerivedCalculatorFields(hero.heroSpecific, 'tactical_archetype_coli'))
      .toEqual(expect.arrayContaining(['targetBleedDetonate', 'targetBombDetonate']));
  });

  it('matches library S3 enhancements: the last upgrade is 15%, totaling 30%', () => {
    expect(hero.skills.s3.enhance).toEqual([.05, 0, 0, .1, 0, .15]);
    const damage = engine().getDamage(hero.skills.s3);
    expect(damage.normal).toBe(Math.round(4000 * .9 * 1.871 * 1.3 / 6));
  });

  it('counts two 2-turn bleeds as four total turns and only detonates bleeds on S1', () => {
    const e = engine({ targetBleedDetonate: 4, targetBombDetonate: 5 });
    const row = e.getDamage(hero.skills.s1);
    expect(row.breakdown!.detonate.normal).toBe(Math.round(bleed(4000, 4)));
    expect(row.normal).toBe(row.breakdown!.direct.normal! + row.breakdown!.detonate.normal!);
  });

  it('counts bombs rather than remaining turns, and S3 does not detonate bleeds', () => {
    const one = engine({ targetBombDetonate: 1, targetBleedDetonate: 10 }).getDamage(hero.skills.s3);
    const two = engine({ targetBombDetonate: 2 }).getDamage(hero.skills.s3);
    expect(one.breakdown!.detonate.normal).toBe(Math.round(bomb(4000, 1)));
    expect(two.breakdown!.detonate.normal).toBe(Math.round(bomb(4000, 2)));
    expect(engine({ targetBombDetonate: 10 }).getDamage(hero.skills.s1).breakdown).toBeUndefined();
  });

  it('applies Overload attack +50% and adds attack buff in the attack bucket', () => {
    const overload = engine({ targetBombDetonate: 1, targetBleedDetonate: 4, casterOverload: true });
    expect(overload.getDamage(hero.skills.s3).breakdown!.detonate.normal).toBe(Math.round(bomb(6000, 1)));
    expect(overload.getDamage(hero.skills.s1).breakdown!.detonate.normal).toBe(Math.round(bleed(6000, 4)));
    expect(engine({ targetBombDetonate: 1, casterOverload: true, attackUp: true }).getDamage(hero.skills.s3).breakdown!.detonate.normal)
      .toBe(Math.round(bomb(8000, 1)));
  });

  it('does not multiply detonation by crit, skill enhancement, element advantage or normal damage bonuses', () => {
    const e = engine({ targetBleedDetonate: 4, targetBombDetonate: 1, critDamage: 350, molagoras1: 0, molagoras3: 0,
      damageIncrease: 50, elementalAdvantage: true, penetrationSet: true, torrentSet: true, torrentSetStack: 3,
      pursuitSet: true, additionalDamageReduction: 50 });
    for (const [skill, expected] of [[hero.skills.s1, bleed(4000, 4)], [hero.skills.s3, bomb(4000, 1)]] as const) {
      expect(Object.values(e.getDamage(skill).breakdown!.detonate)).toEqual(Array(4).fill(Math.round(expected)));
    }
  });

  it('ignores normal damage reduction but currently applies damage sharing without a Frostbite state', () => {
    const e = engine({ targetBleedDetonate: 4, targetBombDetonate: 1, damageReduction: 50, damageTransfer: 20 });
    expect(e.getDamage(hero.skills.s1).breakdown!.detonate.normal).toBe(Math.round(bleed(4000, 4) * .8));
    expect(e.getDamage(hero.skills.s3).breakdown!.detonate.normal).toBe(Math.round(bomb(4000, 1) * .8));
  });
});
