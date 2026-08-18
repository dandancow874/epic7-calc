import { describe, expect, it } from 'vitest';
import { damageRemainingPercent } from './damageDisplay';

describe('damage remaining HP percentage', () => {
  it('subtracts barrier before calculating the max-HP percentage', () => {
    expect(damageRemainingPercent(12000, 3000, 18000)).toBe(50);
    expect(damageRemainingPercent(2000, 3000, 18000)).toBe(0);
  });

  it('guards zero target HP', () => {
    expect(damageRemainingPercent(12000, 0, 0)).toBe(0);
  });
});
