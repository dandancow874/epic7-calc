import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import { DoT } from '../../app/models/skill';
import { withDerivedCalculatorFields } from './derivedFields';

describe('derived calculator fields', () => {
  it('shows the Beehoo burn passive toggle for heroes that deal burn damage', () => {
    expect(withDerivedCalculatorFields(['targetBurnDetonate'], 'aramintha')).toContain('beehooPassive');
    expect(withDerivedCalculatorFields(['casterMaxHP'], 'dark_corvus')).not.toContain('beehooPassive');
  });

  it('increases burn damage by 30% when the Beehoo passive is enabled', () => {
    const values = { attack: 3000, targetDefense: 1200 };
    const normal = new DamageEngine('aramintha', 'noProc', values).getDotDamages()
      .find((item) => item.type === DoT.burn)?.value ?? 0;
    const boosted = new DamageEngine('aramintha', 'noProc', { ...values, beehooPassive: true }).getDotDamages()
      .find((item) => item.type === DoT.burn)?.value ?? 0;

    expect(boosted).toBe(Math.round(normal * 1.3));
  });

  it('adds the combat states that modify Defense, max Health, and Speed scaling', () => {
    expect(withDerivedCalculatorFields(['casterDefense'])).toEqual(expect.arrayContaining([
      'casterDefenseUp', 'casterDefenseDown', 'casterVigor', 'casterHasTrauma',
    ]));
    expect(withDerivedCalculatorFields(['casterDefense'])).not.toEqual(expect.arrayContaining(['casterFury', 'casterPilfered']));
    expect(withDerivedCalculatorFields(['casterMaxHP'])).toContain('casterHasSuperhumanization');
    expect(withDerivedCalculatorFields(['casterSpeed'])).toContain('casterHasSuperhumanization');
  });
});
