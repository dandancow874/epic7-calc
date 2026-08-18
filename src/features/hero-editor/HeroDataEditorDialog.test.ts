import { describe, expect, it } from 'vitest';
import type { LibraryHero } from '../../library/types';
import { buildPatch, createDraft } from './HeroDataEditorDialog';

const hero = {
  code: 'test-hero', name: '测试角色', baseStats: { atk: 1000, hp: 5000, def: 600, spd: 110, chc: .15, chd: 1.5, eff: 0, efr: 0 },
  skills: [{
    id: 'sk_test_1', name: '测试技能', description: '原说明', icon: null, cooldown: '', soulGain: 1, soulBurn: null,
    isAoe: false, dealsDamage: true, enhancements: [],
    multipliers: [{ id: 'skill_multiplier', name: '技能倍率', items: [{ key: 'att_rate', label: '攻击倍率', value: '1', displayValue: '1' }] }],
    effects: [{ id: '203', name: '防御力降低', type: 'debuff', description: '降低70%。', icon: null }],
  }],
} as unknown as LibraryHero;

describe('hero data editor patch', () => {
  it('saves only fields changed by the editor', () => {
    const draft = createDraft(hero);
    draft.baseStats.atk = '1001';
    draft.skills.sk_test_1.multiplierValues.skill_multiplier.att_rate = '0.9';
    expect(buildPatch(hero, draft)).toEqual({
      baseStats: { atk: 1001 },
      skills: { sk_test_1: { multipliers: { skill_multiplier: { items: { att_rate: { value: '0.9', displayValue: '0.9' } } } } } },
    });
  });

  it('can add soul burn without copying the rest of the skill', () => {
    const draft = createDraft(hero);
    draft.skills.sk_test_1.soulBurnEnabled = true;
    draft.skills.sk_test_1.soulBurnCost = '20';
    draft.skills.sk_test_1.soulBurnDescription = '无视效果抗性。';
    expect(buildPatch(hero, draft)).toEqual({ skills: { sk_test_1: { soulBurn: { cost: 20, description: '无视效果抗性。' } } } });
  });
});
