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

  it('applies Proof of Friendship to both max-Health components of Young Senya S2', () => {
    const level0 = new DamageEngine('young_senya', 'proof_of_friendship', {
      ...values,
      artifactLevel: 0,
      exclusiveEquipment2: true,
    });
    const level30 = new DamageEngine('young_senya', 'proof_of_friendship', {
      ...values,
      artifactLevel: 30,
      exclusiveEquipment2: true,
    });

    expect(level0.form.casterFinalMaxHP(level0.currentArtifact)).toBe(10500);
    expect(level0.form.allyFinalMaxHP(level0.currentArtifact)).toBe(21000);
    expect(level0.getDamage(level0.currentHero.skills.s2).normal).toBe(7379);
    expect(level30.form.casterFinalMaxHP(level30.currentArtifact)).toBe(11000);
    expect(level30.form.allyFinalMaxHP(level30.currentArtifact)).toBe(22000);
    expect(level30.getDamage(level30.currentHero.skills.s2).normal).toBe(7679);
  });

  it('does not double-apply Proof of Friendship to in-battle final HP inputs', () => {
    const engine = new DamageEngine('young_senya', 'proof_of_friendship', {
      ...values,
      artifactLevel: 30,
      exclusiveEquipment2: true,
      inBattleHP: true,
    });

    expect(engine.form.casterFinalMaxHP(engine.currentArtifact)).toBe(10000);
    expect(engine.form.allyFinalMaxHP(engine.currentArtifact)).toBe(20000);
    expect(engine.getDamage(engine.currentHero.skills.s2).normal).toBe(7079);
  });

  it('adds other front-ally max-Health increases to Proof of Friendship', () => {
    const engine = new DamageEngine('young_senya', 'proof_of_friendship', {
      ...values,
      artifactLevel: 30,
      exclusiveEquipment2: true,
      allyMaxHPIncrease: 10,
    });

    expect(engine.form.allyFinalMaxHP(engine.currentArtifact)).toBeCloseTo(24000);
    expect(engine.getDamage(engine.currentHero.skills.s2).normal).toBe(8079);
  });
});
