import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Heroes } from '../../assets/data/heroes';
import { DamageEngine } from '../../calc/damageEngine';
import { HitType } from '../../app/models/skill';
import { heroName, skillIcon } from '../../data/catalog';
import { mergeCalculatorValues } from './mergeCalculatorValues';
import type { LibraryHero } from '../../library/types';

const values = { attack: 3000, critDamage: 250, casterDefense: 2000, targetDefense: 1500,
  targetMaxHP: 30000, molagoras1: 5, molagoras2: 5, molagoras3: 5 };
const calc = (id: string, extra: Record<string, unknown> = {}) => new DamageEngine(id, 'noProc', { ...values, ...extra });
const library = async () => JSON.parse(await readFile(new URL('../../../public/library/heroes.json', import.meta.url), 'utf8')) as LibraryHero[];

describe('11/19 screenshot-confirmed coefficients', () => {
  it('updates Krau S1 defense aftermath without changing direct damage or adding it to misses', () => {
    const engine = calc('guard_captain_krau'), skill = engine.currentHero.skills.s1;
    const old = calc('guard_captain_krau_old');
    const direct = (3000 * .7 + 2000 * .85) * 1.871 * 1.3 / 6;
    const extra = 2000 * .9 * 1.871 / 2.5;
    expect(engine.getDamage(skill).normal).toBe(Math.round(direct) + Math.round(extra));
    expect(engine.getAfterMathDamage(skill, HitType.normal, false)).toBeCloseTo(extra);
    expect(engine.getAfterMathDamage(skill, HitType.miss, false)).toBe(0);
    expect(old.getDamage(old.currentHero.skills.s1).normal)
      .toBe(Math.round(direct) + Math.round(2000 * .6 * 1.871 / 2.5));
  });

  it('uses Krau S3 70% / soulburn 160% defense, preserving 100% penetration and EE', () => {
    for (const burn of [false, true]) {
      const engine = calc('guard_captain_krau'), skill = engine.currentHero.skills.s3;
      const expected = (3000 * (burn ? .6 : .3) + 2000 * (burn ? 1.6 : .7)) * 1.871 * 1.3;
      expect(engine.getDamage(skill, burn).normal).toBe(Math.round(expected));
      expect(engine.getDamage(skill, burn).crit).toBeNull();
      expect(engine.getDamage(skill, burn).crush).toBeNull();
      expect(calc('guard_captain_krau', { targetDefense: 4000 }).getDamage(skill, burn)).toEqual(engine.getDamage(skill, burn));
      expect(calc('guard_captain_krau', { exclusiveEquipment3: true }).getDamage(skill, burn).normal)
        .toBe(Math.round(expected / 1.3 * 1.5));
      expect(skill.isSingle(engine.form, burn)).toBe(burn);
      expect(skill.isAOE(engine.form, burn)).toBe(!burn);
    }
  });

  it('uses Roana S1 0.7 attack and separate 70% attack aftermath with post-hit defense break', () => {
    const engine = calc('requiem_roana'), skill = engine.currentHero.skills.s1;
    const direct = 3000 * .7 * 1.871 * 1.3 / 6;
    const extra = 3000 * .7 * 1.871 / 2.5;
    expect(engine.getDamage(skill).normal).toBe(Math.round(direct + extra));
    expect(engine.getDamage(skill).crit).toBeNull();
    expect(engine.getDamage(skill).crush).toBeNull();
    expect(engine.getDamage(skill).miss).toBe(Math.round(direct * .75));
    const broken = calc('requiem_roana', { targetDefenseDownAftermath: true });
    expect(broken.getDamage(skill).normal).toBe(Math.round(direct + 3000 * .7 * 1.871 / 1.45));
    expect(broken.getDamage(skill).miss).toBe(engine.getDamage(skill).miss);
  });

  it('applies Roana S3 9% of current hero HP inside the direct hit, and excludes monsters', () => {
    const engine = calc('requiem_roana'), skill = engine.currentHero.skills.s3;
    const expected = (percent: number) => Math.round((3000 * .35 + 30000 * percent / 100 * .09) * 1.871 * 1.3);
    expect(engine.getDamage(skill).normal).toBe(expected(100));
    expect(calc('requiem_roana', { targetCurrentHPPercent: 50 }).getDamage(skill).normal).toBe(expected(50));
    expect(calc('requiem_roana', { targetIsHero: false }).getDamage(skill).normal).toBe(expected(0));
    expect(calc('requiem_roana', { targetDefense: 4000 }).getDamage(skill)).toEqual(engine.getDamage(skill));
    const enhanced = calc('requiem_roana', { damageIncrease: 16 });
    expect(enhanced.getDamage(skill).normal).toBe(Math.round((3000 * .35 + 2700) * 1.871 * 1.3 * 1.16));
    const linked = mergeCalculatorValues({ ...values, targetCurrentHPPercent: 50 }, {
      targetMaxHP: 30000, targetDefense: 1500, targetHasSuperhumanization: true,
    }, true);
    expect(calc('requiem_roana', linked).getDamage(skill).normal).toBe(expected(100));
  });

  it('updates Victorika S1, S3 max-HP scaling and exposes soulburn S2 and its attack shield', () => {
    const engine = calc('victorika'), skills = engine.currentHero.skills;
    expect(engine.getDamage(skills.s1).crit).toBe(Math.round(3000 * 1.2 * 1.871 * 1.3 * 2.5 / 6));
    expect(engine.getDamage(skills.s3).crit).toBe(Math.round((3000 * 1.4 + 30000 * .07) * 1.871 * 1.3 * 2.5 / 6));
    expect(engine.updateDamages().some(row => row.skillId === 's2' && row.skill.includes('soulburn'))).toBe(true);
    expect(engine.getDamage(skills.s2, true).crit).toBe(Math.round(3000 * 1.45 * 1.871 * 1.3 * 2.5 / 6));
    expect(engine.getBarriers()).toEqual([{ label: 'S2', value: 3000 }]);
    expect(calc('victorika', { attackUp: true }).getBarriers()).toEqual([{ label: 'S2', value: 4500 }]);
  });

  it('keeps named old comparison entries and their skill icons available', () => {
    for (const id of ['guard_captain_krau', 'requiem_roana', 'victorika']) {
      expect(Heroes[`${id}_old`]).toBeDefined();
      expect(heroName(`${id}_old`)).toContain('.old');
      expect(skillIcon(`${id}_old`, 's1')).toBe(skillIcon(id, 's1'));
    }
  });

  it('renders screenshot multipliers and updated descriptions while retaining both new exclusives', async () => {
    const heroes = await library(), get = (code: string) => heroes.find(h => h.code === code)!;
    const text = (hero: string, n: number) => JSON.stringify(get(hero).skills[n - 1].multipliers);
    expect(text('guard-captain-krau', 1)).toContain('90.0% 自身 防御力');
    expect(text('guard-captain-krau', 3)).toContain('160.0% 自身 防御力');
    expect(text('guard-captain-krau', 3)).toContain('70.0% 自身 防御力');
    expect(text('requiem-roana', 1)).toContain('70.0% 自身 攻击力');
    expect(text('requiem-roana', 1)).toContain('独立结算，70%穿透');
    expect(text('requiem-roana', 3)).toContain('当前生命值');
    expect(get('requiem-roana').skills[2].description).toContain('解除2个');
    expect(get('requiem-roana').exclusives[0].name).toBe('寂静献花');
    expect(get('victorika').skills[1].cooldown).toBe('冷却时间3回合');
    expect(text('victorika', 2)).toContain('100.0% 自身 攻击力');
    expect(text('victorika', 3)).toContain('7.0% 目标 最大生命值');
    const multiplier = (code: string, slot: number, key: string, group = 'skill_multiplier') =>
      get(code).skills[slot - 1].multipliers?.find(item => item.id === group)?.items.find(item => item.key === key)?.displayValue;
    for (const [code, slot, rate] of [
      ['requiem-roana', 1, '0.7'], ['requiem-roana', 3, '0.35'],
      ['guard-captain-krau', 1, '0.7'], ['guard-captain-krau', 3, '0.3'],
      ['victorika', 1, '1.2'], ['victorika', 2, '1.2'], ['victorika', 3, '1.4'],
    ] as const) {
      expect(multiplier(code, slot, 'att_rate')).toBe(rate);
      expect(multiplier(code, slot, 'pow')).toBe('1');
    }
    expect(multiplier('guard-captain-krau', 3, 'att_rate', 'soulburn_multiplier')).toBe('0.6');
    expect(multiplier('victorika', 2, 'att_rate', 'soulburn_multiplier')).toBe('1.45');
  });

  it('uses Ray Scorpio base stats on equipment scoring without inventing new aggregate preset totals', async () => {
    const heroes = await library(), ray = heroes.find(h => h.code === 'death-dealer-ray')!;
    expect(ray.baseStats).toMatchObject({ atk: 785, hp: 5077, def: 634, spd: 114, eff: .3 });
    expect(ray.zodiac).toBe('scorpion');
    const presets = JSON.parse(await readFile(new URL('../../../public/library/presets.json', import.meta.url), 'utf8'));
    const preset = presets.find((p: { heroCode: string }) => p.heroCode === ray.code);
    expect(preset.name).toBe('社区主流高配');
    expect(preset.targetStats).toMatchObject({ atk: 1253, hp: 17921, def: 1706, spd: 221, eff: 112 });
    expect(preset.selection.balance_cutoff).toBe('2026-11-19T00:00:00Z');
    expect(preset.selection.constellation_status).toBeUndefined();
  });
});
