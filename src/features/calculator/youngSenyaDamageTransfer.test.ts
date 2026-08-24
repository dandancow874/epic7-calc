import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';

describe('Young Senya S2 damage transfer', () => {
  const values = {
    attack: 2500,
    casterMaxHP: 10000,
    allyMaxHP: 20000,
    targetDefense: 1000,
  };

  it('applies damage transfer to both direct damage and the fixed additional damage', () => {
    const normal = new DamageEngine('young_senya', 'noProc', values);
    const transferred = new DamageEngine('young_senya', 'noProc', {
      ...values,
      damageTransfer: 30,
    });

    expect(normal.getDamage(normal.currentHero.skills.s2).normal).toBe(5579);
    expect(transferred.getDamage(transferred.currentHero.skills.s2).normal).toBe(3906);
  });
});
