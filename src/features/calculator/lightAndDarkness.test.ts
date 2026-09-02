import { describe, expect, it } from 'vitest';
import { Heroes } from '../../assets/data/heroes';
import { DamageEngine } from '../../calc/damageEngine';
import { HitType } from '../../app/models/skill';

describe('Light and Darkness', () => {
  const aoeSkill = Heroes.uncharted_pioneer_politis.skills.s1;
  const singleSkill = Heroes.lisette.skills.s1;

  it('deals 1000-2000 additional damage after an AOE attack', () => {
    expect(new DamageEngine('uncharted_pioneer_politis', 'light-and-darkness', { artifactLevel: 0 }).getArtifactDamage()).toBe(1000);
    expect(new DamageEngine('uncharted_pioneer_politis', 'light_and_darkness', { artifactLevel: 30 }).getArtifactDamage()).toBe(2000);
  });

  it('does not trigger after a single-target attack', () => {
    const engine = new DamageEngine('lisette', 'light_and_darkness', { artifactLevel: 30 });
    expect(engine.currentArtifact.getAfterMathMultipliers(singleSkill, engine.form, false, false, HitType.normal)).toBeNull();
  });

  it('uses the additive Pursuit Set and Stellar Knowledge bucket', () => {
    const base = new DamageEngine('uncharted_pioneer_politis', 'light_and_darkness', { artifactLevel: 30 }).getAfterMathDamage(aoeSkill, HitType.normal, false);
    const boosted = new DamageEngine('uncharted_pioneer_politis', 'light_and_darkness', {
      artifactLevel: 30,
      pursuitSet: true,
      casterHasStellarKnowledge: true,
    }).getAfterMathDamage(aoeSkill, HitType.normal, false);
    expect(boosted - base).toBe(2400);
  });
});
