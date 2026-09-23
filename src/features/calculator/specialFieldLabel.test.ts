import { describe, expect, it } from 'vitest';
import { calculatorSpecialFieldLabel } from './specialFieldLabel';

describe('calculator special field labels', () => {
  it('shows Monarch Iseria attack gained from fracture stacks', () => {
    expect(calculatorSpecialFieldLabel('monarch_of_the_sword_iseria', 'casterFractureStack', 0)).toBe('龟裂层数（攻击+0%）');
    expect(calculatorSpecialFieldLabel('monarch_of_the_sword_iseria', 'casterFractureStack', 3)).toBe('龟裂层数（攻击+60%）');
    expect(calculatorSpecialFieldLabel('monarch_of_the_sword_iseria', 'casterFractureStack', 99)).toBe('龟裂层数（攻击+200%）');
  });

  it('keeps Haru stack guidance', () => {
    expect(calculatorSpecialFieldLabel('haru', 'skill3Stack', 2)).toBe('锚之打击叠层（每层+45%）');
  });
});
