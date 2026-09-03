import { describe, expect, it } from 'vitest';
import { DamageFormData } from '../../app/models/forms';
import { HitType } from '../../app/models/skill';
import { Artifacts } from '../../assets/data/artifacts';
import { BattleConstants } from '../../assets/data/constants';
import { Heroes } from '../../assets/data/heroes';
import { DamageEngine } from '../../calc/damageEngine';

describe('critical damage cap and Black Hand of the Goddess', () => {
  const artifact = Artifacts.black_hand_of_the_goddess;
  const skill = Heroes.kawerik.skills.s1;

  it('uses the current 18%-36% scaling and fixed 3% decay', () => {
    expect(artifact.getCritDmgBoost(0, new DamageFormData({ attackSkillStack: 0 }), skill, false, HitType.crit)).toBeCloseTo(0.18);
    expect(artifact.getCritDmgBoost(30, new DamageFormData({ attackSkillStack: 0 }), skill, false, HitType.crit)).toBeCloseTo(0.36);
    expect(artifact.getCritDmgBoost(30, new DamageFormData({ attackSkillStack: 3 }), skill, false, HitType.crit)).toBeCloseTo(0.27);
    expect(artifact.getCritDmgBoost(30, new DamageFormData({ attackSkillStack: 4 }), skill, false, HitType.crit)).toBeCloseTo(0.24);
    expect(artifact.getCritDmgBoost(30, new DamageFormData({ attackSkillStack: 5 }), skill, false, HitType.crit)).toBeCloseTo(0.24);
  });

  it('keeps the critical damage buff at 70%', () => {
    expect(BattleConstants.increasedCritDamage).toBe(0.7);
  });

  it('caps stats and buffs at 350%, then applies artifact critical damage above the cap', () => {
    const values = { attack: 2500, critDamage: 340, increasedCritDamage: true, targetDefense: 1000, artifactLevel: 30 };
    const withoutArtifact = new DamageEngine('kawerik', 'noProc', values).getDamage(skill);
    const withArtifact = new DamageEngine('kawerik', 'black_hand_of_the_goddess', values).getDamage(skill);

    expect(Number(withoutArtifact.crit) / Number(withoutArtifact.normal)).toBeCloseTo(3.5, 2);
    expect(Number(withArtifact.crit) / Number(withArtifact.normal)).toBeCloseTo(3.86, 2);
  });
});
