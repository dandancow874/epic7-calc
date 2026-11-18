import type { ProfileValues } from '../../data/profiles';
import { defenderBattleMaxHP, defenderOpeningBarrier } from './mergeCalculatorValues';

export function withDefenderBarrierInput(values: ProfileValues, key: string, value: number | boolean, heroId: string) {
  if (key === 'targetBarrier') return Number(value) === Number(values.targetBarrier || 0)
    ? values : { ...values, targetBarrier: Number(value), targetBarrierPercent: 0 };
  if (key === 'targetShieldSet') {
    const percent = value ? 12 : 0;
    return { ...values, targetShieldSet: Boolean(value), targetBarrierPercent: percent,
      targetBarrier: Math.round(defenderBattleMaxHP(values, heroId) * percent / 100) };
  }
  if (key === 'targetBarrierPercent') {
    const percent = Math.max(0, Math.min(1000, Number(value)));
    return { ...values, targetBarrierPercent: percent, targetBarrier: Math.round(defenderBattleMaxHP(values, heroId) * percent / 100) };
  }
  return values;
}

export function configuredDefenderBarrier(values: ProfileValues, artifactPercent: number, hasShieldSet: boolean, heroId: string) {
  if (typeof values.targetBarrierPercent === 'number') {
    return values.targetBarrierPercent > 0
      ? Math.round(defenderBattleMaxHP(values, heroId) * values.targetBarrierPercent / 100)
      : Number(values.targetBarrier || 0);
  }
  return defenderOpeningBarrier(values, artifactPercent, hasShieldSet, heroId);
}
