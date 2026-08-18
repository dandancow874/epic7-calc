import { invoke } from '@tauri-apps/api/core';
import { Save, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isTauriRuntime } from '../../data/portableData';
import type { LibraryHero, LibrarySkill } from '../../library/types';

type Props = {
  hero: LibraryHero;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type SkillDraft = {
  description: string;
  soulGain: string;
  soulBurnEnabled: boolean;
  soulBurnCost: string;
  soulBurnDescription: string;
  multiplierValues: Record<string, Record<string, string>>;
  effectNames: Record<string, string>;
  effectDescriptions: Record<string, string>;
};

type Draft = {
  baseStats: Record<string, string>;
  skills: Record<string, SkillDraft>;
};

const statFields = [
  ['atk', '攻击力', false], ['hp', '生命值', false], ['def', '防御力', false], ['spd', '速度', false],
  ['chc', '暴击率', true], ['chd', '暴击伤害', true], ['eff', '效果命中', true], ['efr', '效果抗性', true],
] as const;

export function HeroDataEditorDialog({ hero, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => createDraft(hero));
  const [activeSkillId, setActiveSkillId] = useState(hero.skills[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const patch = useMemo(() => buildPatch(hero, draft), [hero, draft]);
  const changeCount = useMemo(() => countLeaves(patch), [patch]);
  const activeSkill = hero.skills.find((skill) => skill.id === activeSkillId) || null;
  const activeDraft = activeSkill ? draft.skills[activeSkill.id] : null;

  const updateSkill = (skillId: string, updater: (current: SkillDraft) => SkillDraft) => {
    setDraft((current) => ({ ...current, skills: { ...current.skills, [skillId]: updater(current.skills[skillId]) } }));
  };

  const save = async () => {
    if (!changeCount || saving) return;
    if (!isTauriRuntime()) {
      setStatus('请在 E7 Tools 桌面软件中保存；浏览器预览模式不会写入本地文件。');
      return;
    }
    setSaving(true);
    setStatus('正在保存精简补丁并重新生成图鉴…');
    try {
      await invoke('save_hero_patch', { heroCode: hero.code, patchJson: JSON.stringify(patch) });
      await invoke('rebuild_library_data');
      await onSaved();
      setStatus('保存成功，图鉴已经更新。');
      window.setTimeout(onClose, 450);
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return <div className="library-modal-backdrop hero-editor-backdrop" onClick={onClose}>
    <section className="hero-data-editor" role="dialog" aria-modal="true" aria-label={`${hero.name}角色数据编辑器`} onClick={(event) => event.stopPropagation()}>
      <header><div><span>Library maintenance</span><h2>{hero.name} · 数据编辑器</h2><p>直接修改现有值；保存时只记录发生变化的字段。</p></div><button type="button" onClick={onClose} aria-label="关闭角色数据编辑器"><X size={21} /></button></header>
      <div className="hero-data-editor__body">
        <section className="hero-editor-section">
          <div className="hero-editor-section__title"><strong>基础面板</strong><small>满级、满觉醒</small></div>
          {hero.baseStats ? <div className="hero-editor-stat-grid">{statFields.map(([key, label, percent]) => <label key={key}><span>{label}</span><div><input inputMode="decimal" value={draft.baseStats[key]} onChange={(event) => setDraft((current) => ({ ...current, baseStats: { ...current.baseStats, [key]: event.target.value } }))} />{percent && <b>%</b>}</div></label>)}</div> : <p className="hero-editor-empty">该角色暂无基础面板数据。</p>}
        </section>

        <section className="hero-editor-section hero-editor-skills">
          <div className="hero-editor-section__title"><strong>技能数据</strong><small>选择技能后修改</small></div>
          <div className="hero-editor-skill-tabs">{hero.skills.map((skill, index) => <button type="button" className={skill.id === activeSkillId ? 'active' : ''} key={skill.id} onClick={() => setActiveSkillId(skill.id)}><span>S{index + 1}</span>{skill.name}</button>)}</div>
          {activeSkill && activeDraft ? <div className="hero-editor-skill-form">
            <label className="hero-editor-wide"><span>技能说明</span><textarea value={activeDraft.description} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, description: event.target.value }))} /></label>
            <label><span>获得灵魂</span><input inputMode="numeric" value={activeDraft.soulGain} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, soulGain: event.target.value }))} /></label>
            <label className="hero-editor-toggle"><input type="checkbox" checked={activeDraft.soulBurnEnabled} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, soulBurnEnabled: event.target.checked }))} /><span>启用灵魂燃烧</span></label>
            {activeDraft.soulBurnEnabled && <><label><span>燃烧消耗</span><input inputMode="numeric" value={activeDraft.soulBurnCost} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, soulBurnCost: event.target.value }))} /></label><label className="hero-editor-wide"><span>灵魂燃烧效果</span><textarea value={activeDraft.soulBurnDescription} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, soulBurnDescription: event.target.value }))} /></label></>}

            {!!activeSkill.multipliers?.length && <div className="hero-editor-subsection hero-editor-wide"><strong>技能倍率</strong>{activeSkill.multipliers.map((group) => <div className="hero-editor-multiplier" key={group.id}><span>{group.name}</span>{group.items.map((item) => <label key={item.key}><small>{item.label}</small><input value={activeDraft.multiplierValues[group.id]?.[item.key] ?? ''} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, multiplierValues: { ...current.multiplierValues, [group.id]: { ...current.multiplierValues[group.id], [item.key]: event.target.value } } }))} /></label>)}</div>)}</div>}

            {!!activeSkill.effects.length && <div className="hero-editor-subsection hero-editor-wide"><strong>技能特效</strong>{activeSkill.effects.map((effect) => <div className="hero-editor-effect" key={effect.id}>{effect.icon ? <img src={effect.icon} alt="" /> : <span className="hero-editor-effect__fallback">◇</span>}<label><small>名称</small><input value={activeDraft.effectNames[effect.id]} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, effectNames: { ...current.effectNames, [effect.id]: event.target.value } }))} /></label><label><small>说明</small><textarea value={activeDraft.effectDescriptions[effect.id]} onChange={(event) => updateSkill(activeSkill.id, (current) => ({ ...current, effectDescriptions: { ...current.effectDescriptions, [effect.id]: event.target.value } }))} /></label></div>)}</div>}
          </div> : <p className="hero-editor-empty">该角色暂无完整技能数据。</p>}
        </section>
      </div>
      <footer><span className={status.startsWith('保存失败') ? 'error' : ''}>{status || (changeCount ? `检测到 ${changeCount} 项修改` : '尚未修改任何数值')}</span><div><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="button" className="primary-action" disabled={!changeCount || saving} onClick={save}><Save size={17} />{saving ? '保存中…' : '保存并更新图鉴'}</button></div></footer>
    </section>
  </div>;
}

export function createDraft(hero: LibraryHero): Draft {
  return {
    baseStats: Object.fromEntries(statFields.map(([key, , percent]) => [key, hero.baseStats ? String(percent ? hero.baseStats[key] * 100 : hero.baseStats[key]) : ''])),
    skills: Object.fromEntries(hero.skills.map((skill) => [skill.id, createSkillDraft(skill)])),
  };
}

function createSkillDraft(skill: LibrarySkill): SkillDraft {
  return {
    description: skill.description,
    soulGain: String(skill.soulGain),
    soulBurnEnabled: Boolean(skill.soulBurn),
    soulBurnCost: String(skill.soulBurn?.cost ?? 10),
    soulBurnDescription: skill.soulBurn?.description || '',
    multiplierValues: Object.fromEntries((skill.multipliers || []).map((group) => [group.id, Object.fromEntries(group.items.map((item) => [item.key, item.displayValue || item.value]))])),
    effectNames: Object.fromEntries(skill.effects.map((effect) => [effect.id, effect.name])),
    effectDescriptions: Object.fromEntries(skill.effects.map((effect) => [effect.id, effect.description])),
  };
}

export function buildPatch(hero: LibraryHero, draft: Draft) {
  const patch: Record<string, unknown> = {};
  if (hero.baseStats) {
    const changedStats: Record<string, number> = {};
    for (const [key, , percent] of statFields) {
      const entered = Number(draft.baseStats[key]);
      if (!Number.isFinite(entered)) continue;
      const normalized = percent ? entered / 100 : entered;
      if (Math.abs(normalized - hero.baseStats[key]) > 0.000001) changedStats[key] = normalized;
    }
    if (Object.keys(changedStats).length) patch.baseStats = changedStats;
  }

  const skillPatches: Record<string, unknown> = {};
  for (const skill of hero.skills) {
    const current = draft.skills[skill.id];
    const change: Record<string, unknown> = {};
    if (current.description !== skill.description) change.description = current.description;
    const soulGain = Number(current.soulGain);
    if (Number.isFinite(soulGain) && soulGain !== skill.soulGain) change.soulGain = soulGain;
    if (current.soulBurnEnabled !== Boolean(skill.soulBurn)) change.soulBurn = current.soulBurnEnabled ? { cost: Number(current.soulBurnCost) || 0, description: current.soulBurnDescription } : null;
    else if (current.soulBurnEnabled && skill.soulBurn && (Number(current.soulBurnCost) !== skill.soulBurn.cost || current.soulBurnDescription !== skill.soulBurn.description)) change.soulBurn = { cost: Number(current.soulBurnCost) || 0, description: current.soulBurnDescription };

    const multipliers: Record<string, unknown> = {};
    for (const group of skill.multipliers || []) {
      const items: Record<string, unknown> = {};
      for (const item of group.items) {
        const value = current.multiplierValues[group.id]?.[item.key] ?? '';
        if (value !== (item.displayValue || item.value)) items[item.key] = { value, displayValue: value };
      }
      if (Object.keys(items).length) multipliers[group.id] = { items };
    }
    if (Object.keys(multipliers).length) change.multipliers = multipliers;

    const effects: Record<string, unknown> = {};
    for (const effect of skill.effects) {
      const effectChange: Record<string, string> = {};
      if (current.effectNames[effect.id] !== effect.name) effectChange.name = current.effectNames[effect.id];
      if (current.effectDescriptions[effect.id] !== effect.description) effectChange.description = current.effectDescriptions[effect.id];
      if (Object.keys(effectChange).length) effects[effect.id] = effectChange;
    }
    if (Object.keys(effects).length) change.effects = effects;
    if (Object.keys(change).length) skillPatches[skill.id] = change;
  }
  if (Object.keys(skillPatches).length) patch.skills = skillPatches;
  return patch;
}

function countLeaves(value: unknown): number {
  if (!value || typeof value !== 'object') return 1;
  const values = Object.values(value);
  if (!values.length) return 0;
  return values.reduce<number>((sum, item) => sum + countLeaves(item), 0);
}
