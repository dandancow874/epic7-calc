import type { LibraryArtifact } from '../../library/types';

export type ArtifactTagOption = { id: string; label: string; count: number };
type ArtifactTagRule = { id: string; label: string; test: (text: string) => boolean };
const has = (pattern: RegExp) => (text: string) => pattern.test(text);

export const artifactTagRules: ArtifactTagRule[] = [
  { id: 'stat:attack', label: '攻击力提升', test: has(/攻击力提升/) },
  { id: 'stat:health', label: '生命值提升', test: has(/(?:最大)?生命值提升/) },
  { id: 'stat:defense', label: '防御力提升', test: has(/防御力提升/) },
  { id: 'stat:speed', label: '速度提升', test: has(/速度提升/) },
  { id: 'stat:crit-rate', label: '暴击率提升', test: has(/暴击率提升/) },
  { id: 'stat:crit-damage', label: '暴击伤害提升', test: has(/暴击伤害提升/) },
  { id: 'stat:effectiveness', label: '效果命中提升', test: has(/效果命中提升/) },
  { id: 'stat:resistance', label: '效果抗性提升', test: has(/效果抗性提升/) },
  { id: 'action:cr-push', label: '拉条', test: has(/速攻值提升(?!效果降低)/) },
  { id: 'action:cr-pull', label: '推条', test: has(/速攻值降低/) },
  {
    id: 'effect:buff', label: 'Buff', test: has(/(?:获得|产生)[^。\n]{0,40}(?:攻击力提升|防御力提升|速度提升|暴击率提升|暴击伤害提升|效果命中提升|效果抗性提升|免疫|防护罩|无敌|隐身|魄力|不死|复活)[^。\n]{0,12}效果|在\d回合内[^。\n]{0,40}(?:攻击力提升|防御力提升|速度提升|暴击率提升|暴击伤害提升|效果命中提升|效果抗性提升|免疫|防护罩|无敌|隐身|魄力|不死)/),
  },
  {
    id: 'effect:debuff', label: 'Debuff', test: has(/(?:造成|附带)[^。\n]{0,45}(?:攻击力降低|防御力降低|速度降低|命中降低|中毒|烧伤|出血|晕眩|睡眠|沉默|挑衅|标靶|无法恢复|无法强化|弱化效果)/),
  },
  { id: 'defense:damage-reduction', label: '减伤', test: has(/伤害量降低|所受伤害[^。\n]{0,20}降低|伤害降低/) },
  { id: 'resource:soul-gain', label: '增加灵魂', test: has(/获得(?:\d+(?:\.\d+)?(?:\(\d+(?:\.\d+)?\))?点)?灵魂|灵魂(?:点数)?(?:提升|增加)/) },
  { id: 'resource:soul-reduce', label: '减少灵魂', test: has(/减少灵魂|灵魂(?:点数)?(?:降低|减少)/) },
  { id: 'defense:damage-share', label: '伤害分配', test: (text) => /伤害分配|分摊/.test(text) && !/无视[^。\n]{0,12}伤害分配/.test(text) },
  { id: 'offense:ignore-damage-share', label: '无视伤害分配', test: has(/无视[^。\n]{0,12}伤害分配/) },
  { id: 'offense:damage-increase', label: '增加伤害', test: has(/伤害量提升|造成的伤害(?:量)?提升/) },
  { id: 'offense:accuracy', label: '命中提升', test: has(/(?<!效果)命中(?:率)?提升/) },
];

export function artifactTags(artifact: LibraryArtifact) {
  const text = artifact.skillDescription || '';
  return artifactTagRules.filter((rule) => rule.test(text)).map((rule) => rule.id);
}

export function buildArtifactTagCatalog(artifacts: LibraryArtifact[]): ArtifactTagOption[] {
  return artifactTagRules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    count: artifacts.filter((artifact) => rule.test(artifact.skillDescription || '')).length,
  })).filter((option) => option.count > 0);
}
