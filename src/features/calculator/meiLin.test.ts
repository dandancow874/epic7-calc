import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Heroes } from '../../assets/data/heroes';
import { Artifacts } from '../../assets/data/artifacts';
import { DamageEngine } from '../../calc/damageEngine';
import { mergeCalculatorValues } from './mergeCalculatorValues';
import { openingAttackDefense } from './openingStats';
import { heroSearchNames, isArtifactAllowed, skillName, skillIcon } from '../../data/catalog';
import { HeroClass } from '../../app/models/hero';
import { DoT } from '../../app/models/skill';

const values = { attack: 3000, casterDefense: 1000, critDamage: 300, targetDefense: 1500, molagoras2: 6 };
const s2 = Heroes.mei_lin.skills.s2_ter;

describe('Mei Lin and Flame Dragon\'s Jewel', () => {
  it.each([['s2', 1], ['s2_bis', 1.7], ['s2_ter', 2.4]] as const)('calculates %s in the Attack Rate bucket', (skillId, rate) => {
    const damage = new DamageEngine('mei_lin', 'noProc', values).getDamage(Heroes.mei_lin.skills[skillId]);
    const expected = Math.round(3000 * rate * 1.871 * .95 * 1.35 * 3 / (1500 / 300 + 1));
    expect(damage.crit).toBe(expected);
    expect(damage.normal).toBeNull();
    expect(damage.crush).toBeNull();
    expect(damage.miss).toBeGreaterThan(0);
  });

  it('shows all three S2 rows with shared enhancement and ignores old saved Passion inputs', () => {
    const engine = new DamageEngine('mei_lin', 'noProc', values);
    const rows = engine.updateDamages().filter((row) => row.skillId?.startsWith('s2'));
    expect(rows.map((row) => skillName(row.skill))).toEqual(['S2', 'S2(热情1)', 'S2(热情2)']);
    expect(rows.map((row) => skillIcon('mei_lin', row.skill))).toEqual(Array(3).fill('/assets/skills/sk_c1191_2.png'));
    expect(new DamageEngine('mei_lin', 'noProc', { ...values, meiLinPassionStack: 999 }).updateDamages()).toEqual(engine.updateDamages());
    const unenhanced = new DamageEngine('mei_lin', 'noProc', { ...values, molagoras2: 0 }).updateDamages().filter((row) => row.skillId?.startsWith('s2'));
    rows.forEach((row, index) => expect(Math.abs(row.crit! - unenhanced[index].crit! * 1.35)).toBeLessThanOrEqual(1));
  });

  it('calculates S2 with manually selected Attack buffs alongside the artifact passive', () => {
    const base = { ...values, artifactLevel: 30 };
    const damage = new DamageEngine('mei_lin', 'flame_dragons_jewel', base).getDamage(s2).crit;
    // With Attack Up unchecked (e.g. prevented by Unbuffable), only the +20% artifact passive applies.
    expect(damage).toBe(Math.round(3000 * 1.2 * 2.4 * 1.871 * .95 * 1.35 * 3 / 6));
    expect(new DamageEngine('mei_lin', 'flame_dragons_jewel', { ...base, attackUp: true }).getDamage(s2).crit)
      .toBe(Math.round(3000 * 1.7 * 2.4 * 1.871 * .95 * 1.35 * 3 / 6));
    expect(new DamageEngine('mei_lin', 'flame_dragons_jewel', { ...base, attackUpGreat: true }).getDamage(s2).crit)
      .toBe(Math.round(3000 * 1.95 * 2.4 * 1.871 * .95 * 1.35 * 3 / 6));
    for (const buffs of [{}, { attackUp: true }, { attackUpGreat: true }]) {
      expect(new DamageEngine('mei_lin', 'flame_dragons_jewel', { ...base, ...buffs }).form.casterDefense).toBe(3000);
    }
    expect(Artifacts.flame_dragons_jewel.getScale(0)).toBe(.1);
    expect(Artifacts.flame_dragons_jewel.getScale(30)).toBe(.2);
    expect(isArtifactAllowed(Artifacts.flame_dragons_jewel, 'mei_lin', HeroClass.thief)).toBe(true);
    expect(isArtifactAllowed(Artifacts.flame_dragons_jewel, 'haru', HeroClass.warrior)).toBe(false);
  });

  it('keeps S1 and its soulburn at the same damage, with 30% maximum enhancement', () => {
    const engine = new DamageEngine('mei_lin', 'noProc', { ...values, molagoras1: 6 });
    const skill = Heroes.mei_lin.skills.s1;
    expect(engine.getDamage(skill).crit).toBe(Math.round(3000 * .9 * 1.871 * 1.3 * 3 / 6));
    expect(engine.getDamage(skill, true).crit).toBe(engine.getDamage(skill).crit);
    expect(engine.updateDamages().some((row) => row.skillId === 's3')).toBe(false);
  });

  it('uses Attack as the starting reference even when an old profile contains higher Defense', () => {
    const engine = new DamageEngine('mei_lin', 'flame_dragons_jewel', { ...values, attack: 2000, casterDefense: 4200 });
    expect(engine.form.attack).toBe(2000);
    expect(engine.form.casterDefense).toBe(2000);
    expect(engine.getDamage(Heroes.mei_lin.skills.s1).crit).toBe(Math.round(2000 * 1.2 * .9 * 1.871 * 3 / 6));
    expect(openingAttackDefense('haru', 2000, 4200)).toEqual({ attack: 2000, defense: 4200 });
  });

  it('uses defender Attack for starting Defense and recalculates it when the slider changes', () => {
    const defender = { targetAttack: 4000, targetDefense: 1200, targetMaxHP: 10000, targetDefenseUp: true };
    const merged = mergeCalculatorValues({}, defender, true, 'mei_lin');
    expect(merged.targetDefense).toBe(4000);
    const engine = new DamageEngine('abigail', 'noProc', merged);
    expect(engine.target.getDefense(engine.form, engine.getGlobalDefenseMult())).toBe(4000);
    expect(mergeCalculatorValues({}, { ...defender, targetAttack: 5000 }, true, 'mei_lin').targetDefense).toBe(5000);
    expect(mergeCalculatorValues({}, { ...defender, targetAttack: 1000 }, true, 'mei_lin').targetDefense).toBe(1000);
    expect(mergeCalculatorValues({ targetAttack: 2000 }, defender, false, 'mei_lin').targetDefense).toBe(4000);
    expect(defender.targetDefense).toBe(1200);
  });

  it.each(['targetDefenseUp', 'targetDefenseDown', 'targetDefenseDownAftermath', 'targetAttackUp', 'targetAttackUpGreat'])(
    'keeps Mei Lin Defense and direct/extra/DoT damage unchanged with %s', (modifier) => {
      const defender = { targetAttack: 4000, targetDefense: 1200, targetMaxHP: 10000 };
      const attacker = { attack: 3000, critDamage: 300 };
      const base = new DamageEngine('seaside_bellona', 'reingars_special_drink', mergeCalculatorValues(attacker, defender, true, 'mei_lin'));
      const modified = new DamageEngine('seaside_bellona', 'reingars_special_drink', mergeCalculatorValues(attacker, { ...defender, [modifier]: true }, true, 'mei_lin'));
      const skill = Heroes.seaside_bellona.skills.s3;
      expect(modified.form.targetFinalDefense()).toBe(4000);
      expect(modified.target.getDefense(modified.form, modified.getGlobalDefenseMult())).toBe(4000);
      expect(modified.getDamage(skill)).toEqual(base.getDamage(skill));
      expect(modified.getDotDamage(skill, DoT.burn)).toBe(base.getDotDamage(skill, DoT.burn));
    },
  );

  it.each([['targetDefenseUp', 1920], ['targetDefenseDown', 360]])(
    'still applies %s to other heroes after switching away from Mei Lin', (modifier, expectedDefense) => {
      const defender = { targetAttack: 4000, targetDefense: 1200, targetMaxHP: 10000, targetIgnoresDefenseUpDown: true, [modifier]: true };
      const merged = mergeCalculatorValues({}, defender, true, 'haru');
      const engine = new DamageEngine('abigail', 'noProc', merged);
      expect(engine.form.targetIgnoresDefenseUpDown).toBe(false);
      expect(engine.form.targetFinalDefense()).toBe(expectedDefense);
      expect(engine.target.getDefense(engine.form, engine.getGlobalDefenseMult())).toBeCloseTo(Number(expectedDefense));
    },
  );

  it('includes the complete library entry, unique Passion multiplier groups, translations, and alias', () => {
    const heroes = JSON.parse(readFileSync('public/library/heroes.json', 'utf8'));
    const hero = heroes.find((entry: { code: string }) => entry.code === 'mei-lin');
    expect(hero.skills).toHaveLength(3);
    expect(hero.baseStats).toMatchObject({ atk: 1208, def: 508, hp: 5178, spd: 121 });
    const groups = hero.skills[1].multipliers;
    expect(new Set(groups.map((group: { id: string }) => group.id)).size).toBe(3);
    expect(groups.map((group: { items: Array<{ value: string }> }) => group.items[0].value)).toEqual(['1', '1.7', '2.4']);
    const artifacts = JSON.parse(readFileSync('public/library/artifacts.json', 'utf8'));
    expect(artifacts.find((entry: { code: string }) => entry.code === 'flame-dragons-jewel')).toMatchObject({
      name: '火龙宝石', stats: { atk: 273, hp: 416 },
      artwork: '/library/artifact-artworks/flame-dragons-jewel.png',
    });
    expect(heroSearchNames('mei_lin')).toContain('梅玲');
  });
});
