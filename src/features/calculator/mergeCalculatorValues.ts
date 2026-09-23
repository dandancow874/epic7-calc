import type { ProfileValues } from '../../data/profiles';

const linkedTargetFields = ['targetAttack', 'targetMaxHP', 'targetCurrentHP', 'targetDefense', 'targetSpeed'] as const;

export function mergeCalculatorValues(attacker: ProfileValues, defender: ProfileValues, useDefenderPreset: boolean) {
  const merged = { ...defender, ...attacker };
  if (useDefenderPreset) {
    for (const field of linkedTargetFields) {
      if (defender[field] !== undefined) merged[field] = defender[field];
    }
    merged.targetCurrentHP = defenderBattleMaxHP(defender);
  }
  if (Number(defender.targetBarrier || 0) > 0) merged.targetHasBarrier = true;
  return merged;
}

export function defenderBattleMaxHP(defender: ProfileValues) {
  const base = Number(defender.targetMaxHP || 0);
  const hpIncrease = Number(defender.targetMaxHPIncrease || 0);
  const lingeringStack = Math.min(5, Math.max(0, Number(
    defender.targetLingeringFragranceStack ?? (defender.targetLingeringFragrance ? 1 : 0),
  )));
  const divinityStack = Math.min(4, Math.max(0, Number(defender.targetDivinityStack || 0)));
  const superhumanization = defender.targetHasSuperhumanization ? 1.3 : 1;
  const collapse = defender.targetHasCollapse ? 0.5 : 1;
  return Math.round(base * (1 + hpIncrease / 100) * (1 + lingeringStack * 0.05) * (1 + divinityStack * 0.2) * superhumanization * collapse);
}

/** Opening barriers of the same buff type do not stack; keep the stronger source. */
export function defenderOpeningBarrier(defender: ProfileValues, artifactBarrierPercent = 0, hasShieldSet = false) {
  const barrierPercent = Math.max(0, Number(artifactBarrierPercent || 0), hasShieldSet ? 12 : 0);
  return Math.round(defenderBattleMaxHP(defender) * barrierPercent / 100);
}

export function isLinkedTargetField(field: string) {
  return linkedTargetFields.includes(field as typeof linkedTargetFields[number]);
}
