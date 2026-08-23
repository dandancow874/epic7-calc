import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';

describe('attack imprint damage calculation', () => {
  const values = {
    attack: 2500,
    critDamage: 250,
    casterMaxHP: 10000,
    targetDefense: 1000,
    molagoras3: 7,
  };

  it('adds a percentage of base attack instead of multiplying the final attack panel', () => {
    const hero = new DamageEngine('abigail', 'noProc', values).currentHero;
    const imprintDamage = new DamageEngine('abigail', 'noProc', {
      ...values,
      attackImprint: 10,
    }).getDamage(hero.skills.s3).crit;

    const generalIncreaseDamage = new DamageEngine('abigail', 'noProc', {
      ...values,
      attackIncrease: 10,
    }).getDamage(hero.skills.s3).crit;

    expect(imprintDamage).toBe(7348);
    expect(generalIncreaseDamage).toBe(7609);
  });

  it('uses Argent Waves Hwayoung actual Leo base attack for her imprint', () => {
    const engine = new DamageEngine('argent_waves_hwayoung', 'noProc', {
      attack: 2500,
      critDamage: 250,
      targetDefense: 1000,
      molagoras1: 5,
      attackImprint: 10,
    });

    expect(engine.currentHero.baseAttack).toBe(1283);
    expect(engine.getDamage(engine.currentHero.skills.s1).crit).toBe(4426);
  });
});
