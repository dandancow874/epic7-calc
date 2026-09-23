import { describe, expect, it } from 'vitest';
import { defenderBattleMaxHP, defenderOpeningBarrier, mergeCalculatorValues } from './mergeCalculatorValues';

describe('calculator target preset linking', () => {
  const attacker = { attack: 3000, targetAttack: 1111, targetMaxHP: 9000, targetCurrentHP: 3500, targetDefense: 800, targetSpeed: 120 };
  const defender = { targetAttack: 2400, targetMaxHP: 22000, targetCurrentHP: 22000, targetDefense: 1800, targetSpeed: 250 };

  it('uses defender preset values when linking is enabled', () => {
    expect(mergeCalculatorValues(attacker, defender, true)).toMatchObject(defender);
  });

  it('retains attacker manual target values when linking is disabled', () => {
    expect(mergeCalculatorValues(attacker, defender, false)).toMatchObject(attacker);
  });

  it('treats a numeric defender barrier as the target barrier state', () => {
    expect(mergeCalculatorValues(attacker, { ...defender, targetBarrier: 3000 }, true).targetHasBarrier).toBe(true);
  });

  it('links target current HP to the defender battle HP after artifact and Lingering Fragrance increases', () => {
    const boosted = { ...defender, targetMaxHPIncrease: 10, targetLingeringFragranceStack: 5 };
    expect(defenderBattleMaxHP(boosted)).toBe(30250);
    expect(mergeCalculatorValues(attacker, boosted, true).targetCurrentHP).toBe(30250);
    expect(mergeCalculatorValues(attacker, boosted, false).targetCurrentHP).toBe(3500);
  });

  it('calculates Protection Set barrier from final battle HP including Lingering Fragrance and Divinity', () => {
    expect(defenderOpeningBarrier({ targetMaxHP: 25000, targetDivinityStack: 4 }, 0, true)).toBe(5400);
    expect(defenderOpeningBarrier({ targetMaxHP: 25000, targetLingeringFragranceStack: 5 }, 0, true)).toBe(3750);
    expect(defenderOpeningBarrier({ targetMaxHP: 25000, targetLingeringFragranceStack: 5, targetDivinityStack: 4 }, 0, true)).toBe(6750);
  });

  it('uses the stronger opening barrier when an artifact and Protection Set are both equipped', () => {
    expect(defenderOpeningBarrier({ targetMaxHP: 25000 }, 30, true)).toBe(7500);
  });
});
