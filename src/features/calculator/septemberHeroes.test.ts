import { describe, expect, it } from 'vitest';
import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import { DamageFormData } from '../../app/models/forms';
import { HitType } from '../../app/models/skill';
import { DamageEngine } from '../../calc/damageEngine';
import { defenderBattleMaxHP } from './mergeCalculatorValues';

describe('Lisette and Uncharted Pioneer Politis', () => {
  it('applies one 20% HP and defense increase per Divinity stack', () => {
    const form = new DamageFormData({
      casterMaxHP: 10000,
      casterDefense: 1000,
      casterDivinityStack: 4,
      targetMaxHP: 10000,
      targetDefense: 1000,
      targetDivinityStack: 4,
      inBattleHP: true,
    });
    expect(form.casterFinalMaxHP(Artifacts.noProc)).toBe(18000);
    expect(form.casterFinalDefense(Artifacts.noProc)).toBe(1800);
    expect(form.targetFinalMaxHP()).toBe(18000);
    expect(new DamageEngine('lisette', 'noProc', form).getGlobalDefenseMult()).toBeCloseTo(1.8);
    expect(defenderBattleMaxHP({ targetMaxHP: 10000, targetDivinityStack: 4 })).toBe(18000);
  });

  it('adds 10% max HP for Defense Mission and 10% attack for Attack Mission', () => {
    const hpForm = new DamageFormData({ casterMaxHP: 10000, casterDefenseMission: true, inBattleHP: true });
    expect(hpForm.casterFinalMaxHP(Artifacts.noProc)).toBe(11000);
    expect(new DamageEngine('uncharted_pioneer_politis', 'noProc', { casterAttackMission: true }).getGlobalAttackMult()).toBeCloseTo(0.1);
  });

  it('keeps Politis base fixed damage in the skill definition', () => {
    const hero = Heroes.uncharted_pioneer_politis;
    expect(hero.skills.s1.fixed(HitType.normal, new DamageFormData({}), Artifacts.noProc, false)).toBe(1000);
    expect(hero.skills.s3.fixed(HitType.normal, new DamageFormData({}), Artifacts.noProc, false)).toBe(3000);
  });

  it('adds Stellar Knowledge and Pursuit Set in one additional-damage bucket', () => {
    const skill = Heroes.uncharted_pioneer_politis.skills.s1;
    const normal = new DamageEngine('uncharted_pioneer_politis', 'noProc', {}).getDamage(skill).normal!;
    const pursuit = new DamageEngine('uncharted_pioneer_politis', 'noProc', { pursuitSet: true }).getDamage(skill).normal!;
    const stellar = new DamageEngine('uncharted_pioneer_politis', 'noProc', { casterHasStellarKnowledge: true }).getDamage(skill).normal!;
    const both = new DamageEngine('uncharted_pioneer_politis', 'noProc', { pursuitSet: true, casterHasStellarKnowledge: true }).getDamage(skill).normal!;
    expect(pursuit - normal).toBe(200);
    expect(stellar - normal).toBe(1000);
    expect(both - normal).toBe(1200);
  });

  it('adds 30% defense for Indomitable on either side', () => {
    const caster = new DamageFormData({ casterDefense: 1000, casterIndomitable: true });
    expect(caster.casterFinalDefense(Artifacts.noProc)).toBe(1300);
    expect(new DamageEngine('schniel', 'noProc', { targetIndomitable: true }).getGlobalDefenseMult()).toBeCloseTo(1.3);
  });
});
