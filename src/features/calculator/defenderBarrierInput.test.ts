import { describe, expect, it } from 'vitest';
import { configuredDefenderBarrier, withDefenderBarrierInput } from './defenderBarrierInput';

describe('defender shield percentage and fixed inputs', () => {
  const panel = { targetMaxHP: 25000, targetDivinityStack: 4 };
  it('converts a percentage using battle max HP and follows HP buff changes', () => {
    const percent = withDefenderBarrierInput(panel, 'targetBarrierPercent', 12.5, 'lisette');
    expect(percent.targetBarrier).toBe(5625);
    expect(configuredDefenderBarrier({ ...percent, targetHasSuperhumanization: true }, 0, false, 'lisette')).toBe(11250);
  });
  it('keeps a manually entered fixed shield unchanged when HP changes', () => {
    const fixed = withDefenderBarrierInput({ ...panel, targetBarrierPercent: 12 }, 'targetBarrier', 1234, 'lisette');
    expect(fixed.targetBarrierPercent).toBe(0);
    expect(configuredDefenderBarrier({ ...fixed, targetMaxHP: 30000 }, 0, true, 'lisette')).toBe(1234);
  });
  it('does not exit percentage mode merely by focusing and leaving the numeric box', () => {
    const values = { ...panel, targetBarrierPercent: 12, targetBarrier: 5400 };
    expect(withDefenderBarrierInput(values, 'targetBarrier', 5400, 'lisette')).toBe(values);
  });
  it('sets 12 percent for Shield Set and clears both inputs on deselection', () => {
    const enabled = withDefenderBarrierInput(panel, 'targetShieldSet', true, 'lisette');
    expect(enabled).toMatchObject({ targetBarrierPercent: 12, targetBarrier: 5400 });
    const disabled = withDefenderBarrierInput(enabled, 'targetShieldSet', false, 'lisette');
    expect(disabled).toMatchObject({ targetBarrierPercent: 0, targetBarrier: 0 });
    expect(configuredDefenderBarrier(disabled, 30, false, 'lisette')).toBe(0);
  });
  it('retains the existing automatic artifact or preset barrier until manually overridden', () => {
    expect(configuredDefenderBarrier(panel, 30, true, 'lisette')).toBe(13500);
  });
});
