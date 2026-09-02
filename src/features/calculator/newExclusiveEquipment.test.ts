import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';

describe('new exclusive equipment damage effects', () => {
  it('adds 10% skill damage to Argent Waves Hwayoung S3', () => {
    const normal = new DamageEngine('argent_waves_hwayoung', 'noProc', { molagoras3: 0 });
    const equipped = new DamageEngine('argent_waves_hwayoung', 'noProc', { molagoras3: 0, exclusiveEquipment3: true });

    expect(normal.currentHero.getSkillEnhanceMult(normal.currentHero.skills.s3, normal.form)).toBe(1);
    expect(equipped.currentHero.getSkillEnhanceMult(equipped.currentHero.skills.s3, equipped.form)).toBe(1.1);
  });

  it('raises both Young Senya S2 max-Health additional-damage parts from 15% to 20%', () => {
    const values = { attack: 2500, casterMaxHP: 10000, allyMaxHP: 20000, targetDefense: 1000 };
    const normal = new DamageEngine('young_senya', 'noProc', values);
    const equipped = new DamageEngine('young_senya', 'noProc', { ...values, exclusiveEquipment2: true });

    expect(normal.getDamage(normal.currentHero.skills.s2).normal).toBe(5579);
    expect(equipped.getDamage(equipped.currentHero.skills.s2).normal).toBe(7079);
  });

  it('shows Young Senya S3 barrier as 20% of her final max Health with option 3', () => {
    const normal = new DamageEngine('young_senya', 'noProc', { casterMaxHP: 25000 });
    const equipped = new DamageEngine('young_senya', 'noProc', { casterMaxHP: 25000, exclusiveEquipment3: true });

    expect(normal.getBarriers()).toEqual([]);
    expect(equipped.getBarriers()).toEqual([{ label: 'S3', value: 5000 }]);
  });
});
