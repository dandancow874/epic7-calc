import { describe, expect, it } from 'vitest';
import { calculatorSpecialFieldLabel } from './specialFieldLabel';

describe('calculator special field labels', () => {
  it('describes Chaos Sect Axe specialty-tree battle stats on defense', () => {
    expect(calculatorSpecialFieldLabel('chaos_sect_axe', 'targetSkillTreeCompleted', true))
      .toBe('转职技能树（生命+25%，防御+15%）');
  });

  it('shows Chaos Sect Axe target injury percentage and the pending Thorn Rune increase', () => {
    expect(calculatorSpecialFieldLabel('chaos_sect_axe', 'targetInjuryPercent', 25))
      .toBe('目标伤口比例 25%（芒刺符文加伤+20%·点满上限40%·待验证）');
  });

  it('caps Chaos Sect Axe target injury percentage at 50%', () => {
    expect(calculatorSpecialFieldLabel('chaos_sect_axe', 'targetInjuryPercent', 99))
      .toBe('目标伤口比例 50%（芒刺符文加伤+40%·点满上限40%·待验证）');
  });

  it('describes Vigilante Leader Glenn specialty-tree battle stats on defense', () => {
    expect(calculatorSpecialFieldLabel('vigilante_leader_glenn', 'targetSkillTreeCompleted', true))
      .toBe('转职技能树（攻击+20%，生命+10%）');
  });

  it('shows Monarch Iseria attack gained from fracture stacks', () => {
    expect(calculatorSpecialFieldLabel('monarch_of_the_sword_iseria', 'casterFractureStack', 0)).toBe('龟裂层数（攻击+0%）');
    expect(calculatorSpecialFieldLabel('monarch_of_the_sword_iseria', 'casterFractureStack', 3)).toBe('龟裂层数（攻击+60%）');
    expect(calculatorSpecialFieldLabel('monarch_of_the_sword_iseria', 'casterFractureStack', 99)).toBe('龟裂层数（攻击+200%）');
  });

  it('keeps Haru stack guidance', () => {
    expect(calculatorSpecialFieldLabel('haru', 'skill3Stack', 2)).toBe('锚之打击叠层（每层+45%）');
  });
});
