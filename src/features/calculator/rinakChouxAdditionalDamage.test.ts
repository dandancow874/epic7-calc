import { describe, expect, it } from 'vitest';
import { DamageEngine, type DamageRow } from '../../calc/damageEngine';
import { Heroes } from '../../assets/data/heroes';
import { HitType } from '../../app/models/skill';

const base = {
  attack: 1500, casterMaxHP: 25000, casterSpeed: 250, critDamage: 300,
  targetMaxHP: 30000, targetDefense: 1500, targetInjuries: 10000,
  molagoras1: 0, molagoras3: 0, casterHasBzzt: false,
};
const choux = (values: Record<string, unknown> = {}) => new DamageEngine('urban_shadow_choux', 'noProc', { ...base, ...values });
const part = (row: DamageRow, startsWith: string) => row.breakdown!.additional!.find(item => item.label.startsWith(startsWith))!.values;

describe('Rinak and Urban Shadow Choux additional damage', () => {
  it('keeps Rinak S3 direct damage separate from the 7000 AOE, including a miss', () => {
    const engine = new DamageEngine('rinak', 'noProc', base);
    const row = engine.getDamage(Heroes.rinak.skills.s3);
    const direct = Math.round(1500 * .32 * 1.871 * (1 + 250 * .003));
    expect(row.breakdown!.direct.normal).toBe(direct);
    expect(row.breakdown!.direct.miss).toBe(Math.round(1500 * .32 * 1.871 * (1 + 250 * .003) * .75));
    expect(part(row, '额外伤害').normal).toBe(7000);
    expect(part(row, '额外伤害').miss).toBe(7000);
    expect(row.normal).toBe(direct + 7000);
    expect(row.crit).toBeNull();
    expect(row.crush).toBeNull();
  });

  it('preserves additional-damage increase, reduction and sharing on the separate Rinak part', () => {
    const engine = new DamageEngine('rinak', 'noProc', {
      ...base, pursuitSet: true, additionalDamageReduction: 20, damageTransfer: 20, damageReduction: 70,
    });
    expect(part(engine.getDamage(Heroes.rinak.skills.s3), '额外伤害').normal).toBe(5376);
  });

  it('validates Choux S1, soulburn and S3 HP scaling and S3 penetration', () => {
    const engine = choux();
    const s1 = engine.getDamage(Heroes.urban_shadow_choux.skills.s1);
    const sb = engine.getDamage(Heroes.urban_shadow_choux.skills.s1, true);
    const s3 = engine.getDamage(Heroes.urban_shadow_choux.skills.s3);
    expect(s1.breakdown!.direct.crit).toBe(Math.round((1500 * .5 + 25000 * .1) * 1.871 * 3 / 6));
    expect(sb.breakdown!.direct.crit).toBe(Math.round((1500 * .65 + 25000 * .13) * 1.871 * 3 / 6));
    expect(s3.breakdown!.direct.crit).toBe(Math.round((1500 * .5 + 25000 * .2) * 1.871 * 3 / 3.5));
  });

  it('only S1 soulburn adds 40% of injury and does not require full Focus', () => {
    for (const casterFullFocus of [false, true]) {
      const engine = choux({ casterFullFocus });
      expect(engine.getDamage(Heroes.urban_shadow_choux.skills.s1).breakdown!.additional!.map(item => item.label)).toEqual(['酥酥麻麻额外伤害']);
      expect(part(engine.getDamage(Heroes.urban_shadow_choux.skills.s1, true), '伤口').normal).toBe(4000);
    }
  });

  it('S1 injury damage is fixed, not scaled by defense, crit, skill enhancement or ordinary increase', () => {
    const engine = choux({ targetDefense: 3000, critDamage: 350, molagoras1: 5, damageIncrease: 50 });
    const row = engine.getDamage(Heroes.urban_shadow_choux.skills.s1, true);
    expect(part(row, '伤口')).toEqual({ normal: 4000, crit: 4000, crush: 4000, miss: 4000 });
  });

  it('S3 requires full Focus and a successful hit for 60% injury damage', () => {
    const normal = choux().getDamage(Heroes.urban_shadow_choux.skills.s3);
    const full = choux({ casterFullFocus: true }).getDamage(Heroes.urban_shadow_choux.skills.s3);
    expect(part(normal, '伤口')).toEqual({ normal: 0, crit: 0, crush: 0, miss: 0 });
    expect(part(full, '伤口')).toEqual({ normal: 6000, crit: 6000, crush: 6000, miss: 0 });
    expect(normal.breakdown!.direct).toEqual(full.breakdown!.direct);
  });

  it.each(['s1', 's3'])('Bzzt is its own 2500 damage part after %s, independent of Focus or hit type', skillId => {
    const engine = choux({ casterHasBzzt: true });
    const row = engine.getDamage(Heroes.urban_shadow_choux.skills[skillId]);
    expect(part(row, '酥酥麻麻')).toEqual({ normal: 2500, crit: 2500, crush: 2500, miss: 2500 });
  });

  it('applies Pursuit and additional-damage mitigation to both Choux extra parts', () => {
    const engine = choux({ casterHasBzzt: true, casterFullFocus: true, pursuitSet: true, additionalDamageReduction: 20, damageTransfer: 20 });
    const row = engine.getDamage(Heroes.urban_shadow_choux.skills.s3);
    expect(part(row, '酥酥麻麻').normal).toBe(1920);
    expect(part(row, '伤口').normal).toBe(4608);
  });

  it('every displayed subtotal adds up to the original skill row without counting extras twice', () => {
    const engine = choux({ casterHasBzzt: true, casterFullFocus: true });
    for (const row of engine.updateDamages()) {
      const detail = row.breakdown!;
      for (const hit of Object.values(HitType)) {
        const expected = Number(detail.direct[hit]) + Number(detail.detonate[hit]) + Number(detail.other[hit])
          + detail.additional!.reduce((sum, item) => sum + Number(item.values[hit]), 0);
        expect(row[hit]).toBe(expected);
      }
    }
  });

  it('places the full-Focus control directly after Bzzt in hero-specific fields', () => {
    const fields = Heroes.urban_shadow_choux.heroSpecific;
    expect(fields[fields.indexOf('casterHasBzzt') + 1]).toBe('casterFullFocus');
  });
});
