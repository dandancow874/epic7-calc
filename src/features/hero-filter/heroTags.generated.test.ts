import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LibraryHero } from '../../library/types';
import { buildHeroTagCatalog, withHeroTags } from './heroTags';

const heroes = JSON.parse(readFileSync(resolve(process.cwd(), 'public/library/heroes.json'), 'utf8')) as LibraryHero[];

function tagged(name: string) {
  const hero = heroes.find((item) => item.name === name);
  if (!hero) throw new Error(`missing generated hero: ${name}`);
  return withHeroTags(hero);
}

describe('generated hero tags', () => {
  it('classifies the named counter-prevention heroes as unable to counter', () => {
    for (const name of ['赫尔赛蒂', '魔勒', '星辰神谕艾蕾娜']) {
      expect(tagged(name).tags, name).toContain('trait:counter-disabled');
    }
  });

  it('reads health and injury mechanics from Perfumer Byblis effects', () => {
    expect(tagged('调香师维波里丝').tags).toEqual(expect.arrayContaining(['trait:health-increase', 'trait:injury']));
  });

  it('recognizes Sea Phantom Politis resource gain reduction', () => {
    expect(tagged('海上幽灵佛里蒂丝').tags).toContain('trait:resource-reduce');
  });

  it('recognizes Jenua referenced damage skill as an extra attack', () => {
    expect(tagged('济纽亚').tags).toContain('trait:extra-attack');
    expect(tagged('雅碧凯').tags).not.toContain('trait:extra-attack');
  });

  it('recognizes conditionally triggered named attacks without the word extra', () => {
    for (const name of ['维德瑞', '赛兹', '花园丽迪卡', '瑟琳']) {
      expect(tagged(name).tags, name).toContain('trait:extra-attack');
    }
  });

  it('recognizes implied self CR pushes after a self buff', () => {
    for (const name of ['鲁特比', '实验体赛兹', '黑暗牧者迪埃妮']) {
      expect(tagged(name).tags, name).toEqual(expect.arrayContaining([
        'trait:cr-push',
        'trait:self-cr-push',
        'trait:self-cr-push-50',
      ]));
    }
  });

  it('indexes skill traits granted by exclusive equipment', () => {
    expect(tagged('赫卡特').tags).toEqual(expect.arrayContaining([
      'trait:cr-push',
      'trait:self-cr-push',
      'trait:self-cr-push-50',
    ]));
  });

  it('indexes Aube new effects and soul burn from local generated data', () => {
    expect(tagged('奥芙').tags).toEqual(expect.arrayContaining([
      'buff:淹没（无法解除）',
      'buff:技能伤害无效',
      'buff:隐蔽（无法解除）',
      'debuff:僵直',
      'debuff:束缚',
      'trait:extra-turn',
      'trait:extra-damage',
      'trait:ignore-resistance',
    ]));
  });

  it('does not classify ignore-damage-share attacks as damage sharing', () => {
    expect(tagged('里安娜路西艾拉').tags).toContain('trait:ignore-damage-share');
    expect(tagged('里安娜路西艾拉').tags).not.toContain('trait:damage-share');
  });

  it('only derives cleanse from the skill action, not effect tooltip wording', () => {
    expect(tagged('黎明序曲鲁特比').tags).not.toContain('trait:cleanse');
    expect(tagged('里安娜路西艾拉').tags).not.toContain('trait:cleanse');
    expect(tagged('调香师维波里丝').tags).toContain('trait:cleanse');
  });

  it('publishes every requested trait in the generated advanced-filter catalog', () => {
    const catalogIds = new Set(buildHeroTagCatalog(heroes.map(withHeroTags)).map((item) => item.id));
    for (const id of [
      'trait:ignore-damage-share',
      'trait:ignore-damage-reduction',
      'trait:full-penetration',
      'trait:penetration-resistance',
      'trait:counter-disabled',
      'trait:extra-damage',
      'trait:extra-attack',
      'trait:health-increase',
      'trait:injury',
      'trait:hit-increase',
      'trait:evasion-increase',
      'trait:fighting-spirit',
      'trait:focus',
      'trait:resource-reduce',
      'trait:critical-resistance',
      'trait:guaranteed-crit',
    ]) expect(catalogIds, id).toContain(id);
  });
});
