import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';

describe('calculator attack buffs and Eye of the Abyss Fumyr', () => {
  it('treats normal and great attack up as mutually exclusive', () => {
    expect(new DamageEngine('abigail', 'noProc', { attackUp: true }).getGlobalAttackMult()).toBeCloseTo(0.5);
    expect(new DamageEngine('abigail', 'noProc', { attackUpGreat: true }).getGlobalAttackMult()).toBeCloseTo(0.75);
    expect(new DamageEngine('abigail', 'noProc', { attackUp: true, attackUpGreat: true }).getGlobalAttackMult()).toBeCloseTo(0.75);
  });

  it('applies the 20% Exploiting Weak Points damage buff', () => {
    const skill = new DamageEngine('abigail', 'noProc', {}).currentHero.skills.s1;
    const normal = new DamageEngine('abigail', 'noProc', {}).getDamage(skill).normal!;
    const boosted = new DamageEngine('abigail', 'noProc', { casterHasExploitWeakness: true }).getDamage(skill).normal!;
    expect(boosted / normal).toBeCloseTo(1.2, 3);
  });

  it('includes Eye of the Abyss Fumyr with the crawled S1 multiplier', () => {
    const engine = new DamageEngine('eye_of_the_abyss_fumyr', 'noProc', {});
    expect(engine.currentHero.baseAttack).toBe(1039);
    expect(engine.currentHero.skills.s1.rate(false, engine.form, false)).toBe(1);
    expect(engine.getDamage(engine.currentHero.skills.s1).normal).toBeGreaterThan(0);
  });
});
