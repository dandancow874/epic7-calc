import { describe, expect, it } from 'vitest';
import type { LibraryHero } from '../../library/types';
import { filterHeroes } from './filterHeroes';
import { buildHeroTagCatalog, withHeroTags } from './heroTags';

function hero(overrides: Partial<LibraryHero>): LibraryHero {
  return {
    code: 'hero', gameId: 'c1', name: '测试角色', nameEn: 'Test Hero', nameZht: null, nicknames: [],
    attribute: 'fire', role: 'warrior', rarity: 5, zodiac: null, publishDate: null, descriptionLine: '', story: '',
    profile: null, baseStats: null, artwork: null, avatar: null, devotion: [], exclusives: [], tags: [], dataStatus: 'complete',
    skills: [], ...overrides,
  };
}

function skill(description: string, effects: LibraryHero['skills'][number]['effects'] = [], soulBurn: LibraryHero['skills'][number]['soulBurn'] = null): LibraryHero['skills'][number] {
  return { id: 's1', name: '测试技能', description, icon: null, cooldown: '', soulGain: 0, soulBurn, isAoe: false, dealsDamage: true, enhancements: [], effects };
}

describe('filterHeroes', () => {
  const heroes = [
    hero({ code: 'a', role: 'warrior', attribute: 'fire', tags: ['trait:aoe', 'debuff:晕眩'] }),
    hero({ code: 'b', role: 'mage', attribute: 'ice', tags: ['trait:aoe'] }),
    hero({ code: 'c', role: 'thief', attribute: 'fire', tags: ['debuff:晕眩'] }),
  ];

  it('uses OR within a basic category and AND between categories', () => {
    const result = filterHeroes(heroes, { query: '', roles: ['warrior', 'mage'], attributes: ['fire'], rarities: [], zodiacs: [], advancedTags: [] });
    expect(result.map((item) => item.code)).toEqual(['a']);
  });

  it('requires every selected advanced tag', () => {
    const result = filterHeroes(heroes, { query: '', roles: [], attributes: [], rarities: [], zodiacs: [], advancedTags: ['trait:aoe', 'debuff:晕眩'] });
    expect(result.map((item) => item.code)).toEqual(['a']);
  });

  it('returns no records for an unknown tag and all records after reset', () => {
    expect(filterHeroes(heroes, { query: '', roles: [], attributes: [], rarities: [], zodiacs: [], advancedTags: ['unknown'] })).toHaveLength(0);
    expect(filterHeroes(heroes, { query: '', roles: [], attributes: [], rarities: [], zodiacs: [], advancedTags: [] })).toHaveLength(3);
  });

  it('filters zodiac as another basic AND category', () => {
    const zodiacHeroes = [hero({ code: 'ram', zodiac: 'ram' }), hero({ code: 'fish', zodiac: 'fish' })];
    expect(filterHeroes(zodiacHeroes, { query: '', roles: [], attributes: [], rarities: [], zodiacs: ['ram'], advancedTags: [] }).map((item) => item.code)).toEqual(['ram']);
  });
});

describe('hero tags', () => {
  it('prefers structured effects and supplements text traits', () => {
    const tagged = withHeroTags(hero({
      code: 'tagged',
      skills: [{
        id: 's3', name: '测试', description: '攻击全体敌人后，使自身速攻值提升20%。', icon: null, cooldown: '', soulGain: 2, soulBurn: null,
        isAoe: true, dealsDamage: true, enhancements: [], effects: [{ id: 'stun', name: '晕眩', type: 'debuff', description: '', icon: null }],
      }],
    }));
    expect(tagged.tags).toEqual(expect.arrayContaining(['trait:aoe', 'trait:cr-push', 'debuff:晕眩']));
    expect(buildHeroTagCatalog([tagged])).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'debuff:晕眩', count: 1 })]));
  });

  it('normalizes penetration and transfer effects into skill traits', () => {
    const tagged = withHeroTags(hero({
      skills: [{
        id: 's1', name: '横扫', description: '攻击敌人，转移自身的2个弱化效果。', icon: null, cooldown: '', soulGain: 1, soulBurn: null,
        isAoe: false, dealsDamage: true, enhancements: [], effects: [{ id: 'penetrate', name: '穿透', type: 'common', description: '', icon: null }],
      }],
    }));
    expect(tagged.tags).toEqual(expect.arrayContaining(['trait:defense-penetration', 'trait:transfer']));
    expect(tagged.tags).not.toContain('common:穿透');
  });

  it('moves every common effect into skill traits and removes the common category', () => {
    const tagged = withHeroTags(hero({ skills: [{ id: 's3', name: '激爆', description: '', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [{ id: 'detonate', name: '激爆', type: 'common', description: '', icon: null }] }] }));
    expect(tagged.tags).toContain('trait:激爆');
    expect(tagged.tags.some((tag) => tag.startsWith('common:'))).toBe(false);
    expect(buildHeroTagCatalog([tagged])).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'trait:激爆', category: 'trait', label: '激爆' })]));
  });

  it('creates hierarchical CR traits without treating CR gain reduction as a push', () => {
    const selfPush = withHeroTags(hero({ skills: [{ id: 's2', name: '加速', description: '使自身速攻值提升50%。', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [] }] }));
    expect(selfPush.tags).toEqual(expect.arrayContaining(['trait:cr-push', 'trait:self-cr-push', 'trait:self-cr-push-50']));
    const impliedSelfPush = withHeroTags(hero({ skills: [{ id: 's2', name: '强化', description: '使自身在2回合内获得攻击力提升效果，使速攻值提升50%。', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [] }] }));
    expect(impliedSelfPush.tags).toEqual(expect.arrayContaining(['trait:cr-push', 'trait:self-cr-push', 'trait:self-cr-push-50']));
    const enhancedToFifty = withHeroTags(hero({ skills: [{ id: 's2', name: '暗月', description: '使自身在3回合内获得不死效果，使速攻值提升35(50)% 。', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [] }] }));
    expect(enhancedToFifty.tags).toEqual(expect.arrayContaining(['trait:cr-push', 'trait:self-cr-push', 'trait:self-cr-push-50']));
    const reduction = withHeroTags(hero({ skills: [{ id: 's2', name: '压制', description: '使敌人的速攻值提升效果降低50%。', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [] }] }));
    expect(reduction.tags).toContain('trait:cr-push-reduction');
    expect(reduction.tags).not.toContain('trait:cr-push');
  });

  it('recognizes passive attack, effectiveness and health increases', () => {
    const beehoo = withHeroTags(hero({ skills: [{ id: 's2', name: '火花守护者', description: '攻击力、效果命中提升20(30)%', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [] }] }));
    expect(beehoo.tags).toEqual(expect.arrayContaining(['trait:attack-increase', 'trait:effectiveness-increase']));
    const health = withHeroTags(hero({ skills: [{ id: 's2', name: '强健', description: '最大生命值提升10%。', icon: null, cooldown: '', soulGain: 0, soulBurn: null, isAoe: false, dealsDamage: false, enhancements: [], effects: [] }] }));
    expect(health.tags).toContain('trait:health-increase');
  });

  it('separates damage protection from effects that ignore it', () => {
    const share = withHeroTags(hero({ skills: [skill('对我军人员所受伤害的30%进行伤害分配。')] }));
    const ignoreShare = withHeroTags(hero({ skills: [skill('若目标为英雄，则无视伤害分配效果。', [{ id: 'share', name: '伤害分配', type: 'common', description: '代为承受目标所受部分伤害量。', icon: null }])] }));
    expect(share.tags).toContain('trait:damage-share');
    expect(ignoreShare.tags).toContain('trait:ignore-damage-share');
    expect(ignoreShare.tags).not.toContain('trait:damage-share');

    const reduction = withHeroTags(hero({ skills: [skill('受到攻击时，获得30%的伤害降低效果。')] }));
    const ignoreReduction = withHeroTags(hero({ skills: [skill('攻击时，无视伤害降低效果。')] }));
    expect(reduction.tags).toContain('trait:damage-reduction');
    expect(ignoreReduction.tags).toContain('trait:ignore-damage-reduction');
    expect(ignoreReduction.tags).not.toContain('trait:damage-reduction');
  });

  it('recognizes full penetration and keeps ordinary penetration separate', () => {
    const full = withHeroTags(hero({ skills: [skill('防御力穿透量越提升，最多可提升至100%。')] }));
    const partial = withHeroTags(hero({ skills: [skill('对目标造成70%的防御力穿透。')] }));
    expect(full.tags).toEqual(expect.arrayContaining(['trait:defense-penetration', 'trait:full-penetration']));
    expect(partial.tags).toContain('trait:defense-penetration');
    expect(partial.tags).not.toContain('trait:full-penetration');
  });

  it('distinguishes counter prevention and excludes negative dual-attack mentions', () => {
    const cannotTrigger = withHeroTags(hero({ skills: [skill('此攻击不会触发反击。此技能不会触发夹攻。')] }));
    const disabled = withHeroTags(hero({ skills: [skill('在2回合内造成无法反击效果。')] }));
    const dual = withHeroTags(hero({ skills: [skill('使攻击力最高的我军人员发动夹攻。')] }));
    expect(cannotTrigger.tags).toContain('trait:cannot-counter');
    expect(cannotTrigger.tags).not.toContain('trait:counter-disabled');
    expect(cannotTrigger.tags).not.toContain('trait:dual-attack');
    expect(disabled.tags).toContain('trait:counter-disabled');
    expect(disabled.tags).not.toContain('trait:cannot-counter');
    expect(dual.tags).toContain('trait:dual-attack');
  });

  it('only marks skills that actually revive an ally or self', () => {
    expect(withHeroTags(hero({ skills: [skill('死亡时，以50%的生命值复活。')] })).tags).toContain('trait:revive');
    expect(withHeroTags(hero({ skills: [skill('敌人复活时，获得斗志40点。')] })).tags).not.toContain('trait:revive');
    expect(withHeroTags(hero({ skills: [skill('所有英雄无法复活。')] })).tags).not.toContain('trait:revive');
  });

  it('derives traits from effect descriptions and soul burn text', () => {
    const tagged = withHeroTags(hero({ skills: [skill(
      '使全体我军人员获得余香效果。',
      [
        { id: 'perfume', name: '余香（无法解除）', type: 'buff', description: '最大生命值提升5%。', icon: null },
        { id: 'toxic', name: '剧毒', type: 'debuff', description: '回合开始时，受到伤口效果。', icon: null },
      ],
      { cost: 20, description: '无视效果抗性。' },
    )] }));
    expect(tagged.tags).toEqual(expect.arrayContaining(['trait:health-increase', 'trait:injury', 'trait:ignore-resistance', 'buff:余香（无法解除）', 'debuff:剧毒']));
  });

  it('recognizes the expanded combat traits and resource vocabulary', () => {
    const tagged = withHeroTags(hero({ skills: [skill([
      '造成100%的防御力穿透，穿透抗性提升50%，暴击抗性提升50%。',
      '命中时触发暴击，造成额外伤害，并发动相同的额外攻击。',
      '攻击的命中提升50%，回避提升30%。',
      '获得斗志20点和专注力1点，使敌人的资源获得量降低50%。',
    ].join('\n'))] }));
    expect(tagged.tags).toEqual(expect.arrayContaining([
      'trait:full-penetration', 'trait:penetration-resistance', 'trait:critical-resistance', 'trait:guaranteed-crit',
      'trait:extra-damage', 'trait:extra-attack', 'trait:hit-increase', 'trait:evasion-increase',
      'trait:fighting-spirit', 'trait:focus', 'trait:resource-reduce',
    ]));
  });

  it('adds fuzzy search terms to canonical filter options', () => {
    const tagged = withHeroTags(hero({ skills: [skill('受到攻击时获得30%的伤害降低效果。造成100%的防御力穿透。')] }));
    const catalog = buildHeroTagCatalog([tagged]);
    expect(catalog.find((item) => item.id === 'trait:damage-reduction')?.searchTerms).toContain('减伤');
    expect(catalog.find((item) => item.id === 'trait:full-penetration')?.searchTerms).toContain('穿透');
  });
});
