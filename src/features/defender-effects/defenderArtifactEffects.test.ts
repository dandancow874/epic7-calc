import { describe, expect, it } from 'vitest';
import type { LibraryArtifact } from '../../library/types';
import { resolveDefenderArtifactEffects } from './defenderArtifactEffects';

function artifact(skillDescription: string): LibraryArtifact {
  return {
    code: 'fixture', name: '测试神器', nameEn: 'Fixture', nameZht: null, description: '', skillDescription,
    rarity: 5, role: 'common', limited: false, stats: { atk: 0, hp: 0, def: 0 }, image: null, artwork: null, publishDate: null,
  };
}

describe('defender artifact effects', () => {
  it('reads max-level HP, defense, reduction and transfer effects', () => {
    expect(resolveDefenderArtifactEffects(artifact([
      '最大生命值提升5.0(10.0)%。',
      '防御力提升5(10)%。',
      '受到攻击时，获得15(30)%的伤害降低效果。',
      '对我军人员所受伤害的10(20)%进行伤害分配。',
      '获得相当于自身最大生命值15(30)%的防护罩。',
    ].join('\n')), 30)).toEqual({ hpIncrease: 10, defenseIncrease: 10, damageReduction: 30, damageTransfer: 20, barrierPercent: 30 });
  });

  it('interpolates artifact values every three levels', () => {
    expect(resolveDefenderArtifactEffects(artifact('最大生命值提升5.0(10.0)%。'), 15).hpIncrease).toBe(7.5);
  });

  it('ignores transfer-only reduction and unknown text', () => {
    expect(resolveDefenderArtifactEffects(artifact('因伤害分配而代替承受的伤害降低25.0(50.0)%。'))).toEqual({
      hpIncrease: 0, defenseIncrease: 0, damageReduction: 0, damageTransfer: 0, barrierPercent: 0,
    });
    expect(resolveDefenderArtifactEffects(null)).toEqual({ hpIncrease: 0, defenseIncrease: 0, damageReduction: 0, damageTransfer: 0, barrierPercent: 0 });
  });

  it('reads Bastion of Perlutia max-HP barrier at the selected level', () => {
    const effect = resolveDefenderArtifactEffects(artifact('战斗开始时，在2回合内获得相当于自身最大生命值15.0(30.0)%的防护罩。'), 30);
    expect(effect.barrierPercent).toBe(30);
  });
});
