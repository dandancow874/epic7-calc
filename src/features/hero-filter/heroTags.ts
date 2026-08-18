import type { LibraryHero } from '../../library/types';
import { heroTagOverrides } from './heroTagOverrides';

export type HeroTagCategory = 'skill-bonus' | 'trait' | 'buff' | 'debuff' | 'self-imprint' | 'team-imprint' | 'equipment';
export type HeroTagTone = 'general' | 'blue' | 'gold';
export type HeroTagOption = { id: string; label: string; searchTerms: string[]; category: HeroTagCategory; count: number; icon: string | null; tone: HeroTagTone };
type TagRule = { id: string; label: string; pattern: RegExp; icon: string; aliases?: string[]; includeEffectText?: boolean };

const skillBonusRules: TagRule[] = [
  { id: 'skill-bonus:speed', label: '速度加成', pattern: /根据.*速度|速度越高|速度差|速度的.*比例/, icon: '/assets/skills/le_speed.png' },
  { id: 'skill-bonus:defense', label: '防御加成', pattern: /根据.*防御|防御力越高|防御力的.*比例/, icon: '/assets/skills/le_defence.png' },
  { id: 'skill-bonus:attack', label: '攻击加成', pattern: /根据.*攻击|攻击力越高|攻击力的.*比例/, icon: '/assets/skills/le_attack.png' },
  { id: 'skill-bonus:health', label: '血量加成', pattern: /根据.*生命|最大生命值越高|生命值的.*比例/, icon: '/assets/skills/le_health.png' },
  { id: 'skill-bonus:other', label: '其他加成', pattern: /根据.*(效果命中|效果抗性|目标已损失生命|目标最大生命)|每拥有1点|每层/, icon: '/assets/skills/extra.png' },
];

const traitRules: TagRule[] = [
  { id: 'trait:aoe', label: '群攻技能', pattern: /全体敌人|全体目标|攻击所有敌人/, icon: '/assets/skills/m_combo.png' },
  { id: 'trait:defense-penetration', label: '防御穿透', pattern: /防御(?:力)?穿透|穿透.*防御|无视.*防御/, icon: '/assets/skills/le_defence.png' },
  { id: 'trait:full-penetration', label: '百穿', aliases: ['穿透', '100%穿透', '防御穿透'], pattern: /100(?:\.0)?%的防御(?:力)?穿透|防御(?:力)?穿透[^。\n]{0,40}(?:提升至|达到|为)100(?:\.0)?%/, icon: '/assets/skills/le_defence.png' },
  { id: 'trait:penetration-resistance', label: '穿透抗性', pattern: /穿透抗性/, icon: '/assets/skills/le_resist.png', includeEffectText: true },
  { id: 'trait:cannot-crit', label: '无法暴击', pattern: /不会触发暴击|无法暴击/, icon: '/assets/skills/m_critical.png' },
  { id: 'trait:critical-resistance', label: '暴击抗性', pattern: /暴击抗性/, icon: '/assets/skills/m_critical.png', includeEffectText: true },
  { id: 'trait:cr-push', label: '拉条', pattern: /速攻值提升(?!效果降低)/, icon: '/assets/skills/le_speed.png' },
  { id: 'trait:self-cr-push', label: '自拉', pattern: /(?:自身(?:的)?速攻值|使自身[^。；\n]{0,80}(?:，并|，)?使速攻值)提升(?!效果降低)/, icon: '/assets/skills/le_speed.png' },
  { id: 'trait:self-cr-push-50', label: '自拉50', pattern: /(?:自身(?:的)?速攻值|使自身[^。；\n]{0,80}(?:，并|，)?使速攻值)提升(?:50(?:\.0)?|\d+(?:\.\d+)?\(50(?:\.0)?\))%/, icon: '/assets/skills/le_speed.png' },
  { id: 'trait:cr-push-reduction', label: '拉条减少', pattern: /速攻值提升效果降低/, icon: '/assets/skills/le_speed.png' },
  { id: 'trait:cr-pull', label: '推条', pattern: /速攻值降低/, icon: '/assets/skills/le_speed.png' },
  { id: 'trait:attack-increase', label: '攻击力提升', pattern: /(?:^|\n)(?![^\n]*获得)(?:自身)?攻击力(?:、效果命中)?提升\d/m, icon: '/assets/skills/le_attack.png' },
  { id: 'trait:effectiveness-increase', label: '效果命中提升', pattern: /(?:^|\n)(?![^\n]*获得)(?:攻击力、)?效果命中提升\d/m, icon: '/assets/skills/le_target.png' },
  { id: 'trait:health-increase', label: '生命值提升', pattern: /(?:^|\n)(?![^\n]*获得)(?:最大)?生命值提升\d/m, icon: '/assets/skills/le_health.png', includeEffectText: true },
  { id: 'trait:transfer', label: '转移', pattern: /转移(?:自身|自己|1个|2个|弱化效果)/, icon: '/assets/skills/m_weak.png' },
  { id: 'trait:ignore-resistance', label: '无视抗性', pattern: /无视效果抗性/, icon: '/assets/skills/le_resist.png' },
  { id: 'trait:cannot-counter', label: '不会触发反击', pattern: /不会触发反击/, icon: '/assets/skills/m_counter.png' },
  { id: 'trait:counter-disabled', label: '无法反击', pattern: /无法(?:发动)?反击/, icon: '/assets/skills/m_counter.png' },
  { id: 'trait:guaranteed-crit', label: '必爆', aliases: ['必定暴击', '命中时触发暴击', '命中时发生暴击'], pattern: /必定发生暴击|必定暴击|命中时触发暴击|命中时发生暴击/, icon: '/assets/skills/m_critical.png' },
  { id: 'trait:dispel', label: '驱散Buff', pattern: /解除(?:(?:敌人|目标|全体敌人|所有敌人)(?:附带)?的?)?(?:所有|\d+个)?强化效果|强化效果(?:减少|解除|驱散)/, icon: '/assets/skills/m_weak.png' },
  { id: 'trait:cleanse', label: '解除Debuff', pattern: /解除(?:(?:自身|全体我军人员|我军目标|我军人员|除自身外的我军人员)(?:附带)?的?)?(?:所有|\d+个)?弱化效果/, icon: '/assets/skills/m_heal.png' },
  { id: 'trait:extra-turn', label: '额外回合', pattern: /额外回合/, icon: '/assets/skills/extra.png' },
  { id: 'trait:extra-damage', label: '额外伤害', pattern: /额外伤害/, icon: '/assets/skills/extra.png', includeEffectText: true },
  { id: 'trait:extra-attack', label: '额外攻击', pattern: /发动(?:相同的)?额外攻击/, icon: '/assets/skills/extra.png' },
  { id: 'trait:cooldown-decrease', label: '技能CD减少', pattern: /冷却时间减少/, icon: '/assets/icons/alarm.svg' },
  { id: 'trait:cooldown-reset', label: '技能CD重置', pattern: /冷却时间重置|重置.*冷却/, icon: '/assets/icons/alarm.svg' },
  { id: 'trait:cooldown-increase', label: '技能CD增加', pattern: /冷却时间增加/, icon: '/assets/icons/alarm.svg' },
  { id: 'trait:revive', label: '复活', pattern: /死亡时[^。\n]*复活|使(?:其|自身|目标|随机\d名|死亡的|全体我军人员|我军人员)[^。\n]{0,30}复活|以\d{1,3}(?:\(\d{1,3}\))?%的生命值复活/, icon: '/assets/skills/m_heal.png' },
  { id: 'trait:extinction', label: '灭亡', pattern: /灭亡/, icon: '/assets/skills/m_die.png' },
  { id: 'trait:counter', label: '自带反击', pattern: /发动反击|进行反击/, icon: '/assets/skills/m_counter.png' },
  { id: 'trait:dual-attack', label: '夹攻', pattern: /(?:使|令)[^。\n]{0,30}(?:发动)?夹攻|发动夹攻|夹攻率提升|夹攻强化|夹攻状态/, icon: '/assets/skills/m_combo.png' },
  { id: 'trait:injury', label: '伤口', pattern: /伤口/, icon: '/assets/debuffs/laceration-debuff.png' },
  { id: 'trait:damage-share', label: '伤害分配', pattern: /进行伤害分配|伤害分配(?:量)?提升|伤害分摊|分摊伤害|代为承受/, icon: '/assets/skills/m_blood.png', includeEffectText: true },
  { id: 'trait:ignore-damage-share', label: '无视伤害分配', pattern: /无视[^。\n]{0,12}伤害分配|不受[^。\n]{0,20}伤害分配[^。\n]{0,8}影响/, icon: '/assets/skills/m_blood.png' },
  { id: 'trait:damage-reduction', label: '伤害降低', aliases: ['减伤'], pattern: /所受伤害(?:量)?降低|获得[^。\n]{0,20}伤害降低效果|伤害量降低\d/, icon: '/assets/skills/m_blood.png', includeEffectText: true },
  { id: 'trait:ignore-damage-reduction', label: '无视减伤', aliases: ['无视伤害降低'], pattern: /无视[^。\n]{0,12}伤害降低|不受[^。\n]{0,20}伤害降低[^。\n]{0,8}影响/, icon: '/assets/skills/m_blood.png' },
  { id: 'trait:barrier', label: '防护罩', pattern: /防护罩/, icon: '/assets/buffs/barrier-buff.png' },
  { id: 'trait:heal', label: '恢复生命', pattern: /生命值恢复|恢复生命值/, icon: '/assets/skills/m_heal.png' },
  { id: 'trait:resource', label: '资源提升', pattern: /获得.*斗志|获得.*专注|获得.*灵魂|资源提升/, icon: '/assets/skills/m_resource.png' },
  { id: 'trait:resource-reduce', label: '资源减少', pattern: /斗志降低|专注降低|灵魂减少|资源减少|资源获得量降低/, icon: '/assets/skills/m_soul.png' },
  { id: 'trait:hit-increase', label: '命中提升', aliases: ['攻击命中提升'], pattern: /攻击的命中(?:率)?提升|(?:^|[^果])命中提升\d/m, icon: '/assets/skills/le_target.png', includeEffectText: true },
  { id: 'trait:evasion-increase', label: '回避提升', pattern: /回避提升/, icon: '/assets/skills/m_dodge.png', includeEffectText: true },
  { id: 'trait:fighting-spirit', label: '斗志', pattern: /斗志/, icon: '/assets/skills/m_resource.png' },
  { id: 'trait:focus', label: '专注', pattern: /专注(?:力)?/, icon: '/assets/skills/m_resource.png' },
];

const imprintLabels: Record<string, string> = {
  max_hp_rate: '最大生命%', att_rate: '攻击力%', def_rate: '防御力%', cri: '暴击率', spd: '速度',
  res: '效果抗性', acc: '效果命中', max_hp: '最大生命', att: '攻击力', def: '防御力', coop: '夹攻率',
};

export function withHeroTags(hero: LibraryHero): LibraryHero {
  const tags = new Set<string>(hero.tags);
  const skillText = [
    ...hero.skills.map((skill) => [
      skill.name,
      skill.description,
      skill.cooldown,
      skill.soulBurn?.description,
    ].filter(Boolean).join('\n')),
    ...hero.exclusives.flatMap((equipment) => equipment.skillOptions.map((option) => option.description)),
  ].join('\n');
  const effectText = hero.skills.flatMap((skill) => skill.effects)
    .filter((effect) => effect.type !== 'common')
    .flatMap((effect) => [effect.name, effect.description])
    .filter(Boolean)
    .join('\n');

  for (const skill of hero.skills) {
    if (skill.isAoe) tags.add('trait:aoe');
    for (const effect of skill.effects) {
      const effectTag = tagIdForEffect(effect);
      if (shouldIncludeStructuredTrait(effectTag, skill.description)) tags.add(effectTag);
      if (/^剧毒(?:（|$)/.test(effect.name)) tags.add('trait:injury');
    }
  }
  if (hasReferencedExtraAttack(hero)) tags.add('trait:extra-attack');
  for (const rule of [...skillBonusRules, ...traitRules]) {
    if (rule.pattern.test(skillText) || (rule.includeEffectText && rule.pattern.test(effectText))) tags.add(rule.id);
  }

  for (const devotion of hero.devotion as Array<Record<string, unknown>>) {
    const selfType = String(devotion.self_type || '');
    const teamType = String(devotion.public_type || '');
    if (selfType) tags.add(`self-imprint:${selfType}`);
    if (teamType) tags.add(`team-imprint:${teamType}`);
  }
  if (hero.exclusives.length) tags.add('equipment:exclusive');

  const override = heroTagOverrides[hero.code];
  for (const tag of override?.add || []) tags.add(tag);
  for (const tag of override?.remove || []) tags.delete(tag);
  return { ...hero, tags: [...tags] };
}

export function buildHeroTagCatalog(heroes: LibraryHero[]): HeroTagOption[] {
  const counts = new Map<string, number>();
  const effectMeta = new Map<string, { icon: string | null; tone: HeroTagTone }>();
  heroes.forEach((hero) => {
    hero.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    hero.skills.flatMap((skill) => skill.effects).forEach((effect) => {
      effectMeta.set(tagIdForEffect(effect), { icon: effect.icon, tone: effectTone(effect.name, effect.icon) });
    });
  });
  return [...counts.entries()].map(([id, count]) => {
    const rule = [...skillBonusRules, ...traitRules].find((item) => item.id === id);
    const meta = effectMeta.get(id);
    return { id, count, category: categoryOf(id), label: labelOf(id), searchTerms: rule?.aliases || [], icon: meta?.icon || rule?.icon || null, tone: meta?.tone || 'general' };
  }).sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || toneOrder(a.tone) - toneOrder(b.tone) || b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
}

function effectTone(name: string, icon: string | null): HeroTagTone {
  if (/固有效果/.test(name) || /_aura$/.test(icon || '')) return 'gold';
  if (/无法解除/.test(name) || /_keep$/.test(icon || '')) return 'blue';
  return 'general';
}

function tagIdForEffect(effect: LibraryHero['skills'][number]['effects'][number]) {
  if (effect.type !== 'buff' && effect.type !== 'debuff') {
    const canonical = commonEffectTraitIds[effect.name];
    if (canonical) return canonical;
    return `trait:${effect.name}`;
  }
  const category = effect.type === 'buff' ? 'buff' : effect.type === 'debuff' ? 'debuff' : 'common';
  return `${category}:${effect.name}`;
}

const commonEffectTraitIds: Record<string, string> = {
  额外回合: 'trait:extra-turn',
  额外攻击: 'trait:extra-attack',
  额外伤害: 'trait:extra-damage',
  穿透: 'trait:defense-penetration',
  夹攻: 'trait:dual-attack',
  伤口: 'trait:injury',
  伤害降低: 'trait:damage-reduction',
  伤害分配: 'trait:damage-share',
  灭亡: 'trait:extinction',
  转移: 'trait:transfer',
  减少灵魂: 'trait:resource-reduce',
  资源减少: 'trait:resource-reduce',
  资源提升: 'trait:resource',
};

function shouldIncludeStructuredTrait(tag: string, description: string) {
  if (tag === 'trait:damage-share') return /进行伤害分配|伤害分配(?:量)?提升|伤害分摊|分摊伤害|代为承受/.test(description);
  if (tag === 'trait:damage-reduction') return /所受伤害(?:量)?降低|获得[^。\n]{0,20}伤害降低效果|伤害量降低\d/.test(description);
  if (tag === 'trait:dual-attack') return /(?:使|令)[^。\n]{0,30}(?:发动)?夹攻|发动夹攻|夹攻率提升|夹攻强化|夹攻状态/.test(description);
  return true;
}

function hasReferencedExtraAttack(hero: LibraryHero) {
  for (const skill of hero.skills) {
    for (const match of skill.description.matchAll(/额外使用([^。，\n]+?)(?=。|，|仅能|$)/g)) {
      const actionName = match[1].replace(/^1次/, '').replace(/技能$/, '').trim();
      const damageAction = referencedDamageAction(hero, skill.description, actionName);
      if (damageAction !== false) return true;
    }
    for (const match of skill.description.matchAll(/使用([^。，\n]+?)(?=。|，|后|时|代替|$)/g)) {
      const actionName = match[1].replace(/^1次/, '').replace(/技能$/, '').trim();
      if (referencedDamageAction(hero, skill.description, actionName) === true) return true;
    }
  }
  return false;
}

function referencedDamageAction(hero: LibraryHero, description: string, actionName: string) {
  const referencedSkill = hero.skills.find((candidate) => candidate.name === actionName);
  if (referencedSkill?.dealsDamage) return true;
  const definition = description.match(new RegExp(`${escapeRegExp(actionName)}(?:（[^）]*）)?[：:]([^\\n]{0,160})`));
  if (definition) return /攻击|刺击|射击|砍击|斩击|打击|踢击|重击/.test(definition[1]);
  return referencedSkill ? false : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function categoryOf(id: string): HeroTagCategory { return id.split(':', 1)[0] as HeroTagCategory; }

function labelOf(id: string) {
  const [category, value] = id.split(':');
  if (category === 'skill-bonus') return skillBonusRules.find((rule) => rule.id === id)?.label || value;
  if (category === 'trait') return traitRules.find((rule) => rule.id === id)?.label || value;
  if (category === 'self-imprint' || category === 'team-imprint') return imprintLabels[value] || value;
  if (category === 'equipment') return '拥有专属装备';
  return value;
}

function categoryOrder(category: HeroTagCategory) { return ['self-imprint', 'team-imprint', 'equipment', 'skill-bonus', 'trait', 'buff', 'debuff'].indexOf(category); }
function toneOrder(tone: HeroTagTone) { return ['general', 'blue', 'gold'].indexOf(tone); }
