import { describe, expect, it } from 'vitest';
import { DamageFormData } from '../../app/models/forms';
import { Heroes } from '../../assets/data/heroes';

describe('Saria exclusive equipment', () => {
  it('adds 20% to S2 damage with exclusive equipment option 2', () => {
    const skill = Heroes.saria.skills.s2;
    expect(Heroes.saria.getSkillEnhanceMult(skill, new DamageFormData({ molagoras2: 0 }))).toBe(1);
    expect(Heroes.saria.getSkillEnhanceMult(skill, new DamageFormData({ molagoras2: 0, exclusiveEquipment2: true }))).toBe(1.2);
  });
});
