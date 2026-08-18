import { describe, expect, it } from 'vitest';
import type { LibraryArtifact } from '../../library/types';
import { artifactTags, buildArtifactTagCatalog } from './artifactTags';

function artifact(skillDescription: string): LibraryArtifact {
  return { code: 'test', name: '测试神器', nameEn: null, nameZht: null, description: '', skillDescription, rarity: 5, role: 'common', limited: false, stats: { atk: 0, hp: 0, def: 0 }, image: null, artwork: null, publishDate: null };
}

describe('artifact tags', () => {
  it('keeps CR filters simple and separates gain from reduction', () => {
    expect(artifactTags(artifact('使自身速攻值提升20%。')).includes('action:cr-push')).toBe(true);
    expect(artifactTags(artifact('使目标速攻值降低15%。')).includes('action:cr-pull')).toBe(true);
    expect(artifactTags(artifact('速攻值提升效果降低50%。')).includes('action:cr-push')).toBe(false);
  });

  it('distinguishes accuracy from effectiveness', () => {
    expect(artifactTags(artifact('命中提升20%。'))).toContain('offense:accuracy');
    expect(artifactTags(artifact('效果命中提升20%。'))).not.toContain('offense:accuracy');
  });

  it('separates damage sharing from ignoring damage sharing', () => {
    expect(artifactTags(artifact('对我军人员所受伤害的20%进行伤害分配。'))).toContain('defense:damage-share');
    expect(artifactTags(artifact('攻击时无视伤害分配效果。'))).toContain('offense:ignore-damage-share');
    expect(artifactTags(artifact('攻击时无视伤害分配效果。'))).not.toContain('defense:damage-share');
  });

  it('only exposes catalog entries that exist', () => {
    const catalog = buildArtifactTagCatalog([artifact('攻击力提升20%。')]);
    expect(catalog).toEqual([expect.objectContaining({ id: 'stat:attack', count: 1 })]);
  });

  it('recognizes a numeric soul grant', () => {
    expect(artifactTags(artifact('首次战斗开始时，获得10点灵魂。'))).toContain('resource:soul-gain');
  });
});
