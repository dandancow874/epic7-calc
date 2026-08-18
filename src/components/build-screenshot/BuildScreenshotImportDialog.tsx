import { AlertTriangle, Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cycleEquipmentSet, equipmentSet, equipmentSets } from '../../features/build-presets/setCatalog';
import type { BuildScreenshotRecognition, RecognizedTargetStats } from '../../features/build-screenshot/types';
import { recognizedStatKeys } from '../../features/build-screenshot/types';
import type { LibraryArtifact, LibraryHero } from '../../library/types';
import { artifactAliases, heroSearchNames } from '../../data/catalog';
import { calculatorHeroIdForLibraryCode } from '../../features/build-presets/calculatorBuildBridge';
import type { ImprintMode, ImprintRank } from '../../features/build-presets/types';
import { SearchableImportSelect, type SearchableImportOption } from './SearchableImportSelect';

type Props = {
  imageUrl: string;
  recognition: BuildScreenshotRecognition;
  heroes: LibraryHero[];
  artifacts: LibraryArtifact[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (recognition: BuildScreenshotRecognition) => void;
};

const statLabels: Record<keyof RecognizedTargetStats, string> = {
  atk: '攻击力', def: '防御力', hp: '生命值', spd: '速度',
  chc: '暴击率', chd: '暴击伤害', eff: '效果命中', efr: '效果抗性',
};

export function BuildScreenshotImportDialog({ imageUrl, recognition, heroes, artifacts, saving, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(recognition));
  const selectedHero = heroes.find((hero) => hero.code === draft.hero.value?.heroCode) || null;
  const compatibleArtifacts = useMemo(() => artifacts.filter((artifact) => artifact.role === 'common' || artifact.role === selectedHero?.role), [artifacts, selectedHero?.role]);
  const heroOptions = useMemo<SearchableImportOption[]>(() => heroes.map((hero) => ({
    value: hero.code,
    label: hero.name,
    detail: hero.nameEn || hero.code,
    image: hero.avatar,
    searchText: [hero.nameZht || '', ...hero.nicknames, heroSearchNames(calculatorHeroIdForLibraryCode(hero.code) || hero.code.replaceAll('-', '_'))].join(' '),
  })), [heroes]);
  const artifactOptions = useMemo<SearchableImportOption[]>(() => [
    { value: '', label: '无 / 未识别', searchText: 'none' },
    ...compatibleArtifacts.map((artifact) => ({
      value: artifact.code,
      label: artifact.name,
      detail: artifact.nameEn || artifact.code,
      image: artifact.image,
      searchText: artifactAliases(artifact.code.replaceAll('-', '_')),
    })),
  ], [compatibleArtifacts]);
  const usedPieces = (draft.sets.value || []).reduce((total, code) => total + equipmentSet(code).pieces, 0);
  const valid = Boolean(selectedHero)
    && recognizedStatKeys.every((key) => draft.targetStats[key].value != null)
    && usedPieces <= 6
    && (draft.artifactLevel.value == null || (draft.artifactLevel.value >= 0 && draft.artifactLevel.value <= 30));

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key === 'Enter' && valid && !saving) onConfirm(draft);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [draft, onClose, onConfirm, saving, valid]);

  const setHero = (code: string) => {
    const hero = heroes.find((item) => item.code === code);
    setDraft((current) => ({
      ...current,
      hero: { value: hero ? { heroCode: hero.code, gameId: hero.gameId, displayName: hero.name } : null, confidence: hero ? 1 : 0, source: 'manual' },
      artifact: hero && current.artifact.value && !artifactAllowed(current.artifact.value.artifactCode, hero, artifacts)
        ? { value: null, confidence: 0, source: 'manual' }
        : current.artifact,
    }));
  };

  return <div className="modal-scrim build-import-scrim" onClick={() => !saving && onClose()}>
    <section className="build-import-dialog" role="dialog" aria-modal="true" aria-label="截图装备识别预览" onClick={(event) => event.stopPropagation()}>
      <header className="build-import-head">
        <div><span className="eyebrow">Screenshot import</span><h2>确认截图识别结果</h2><p>确认后会自动跳转到截图角色，并创建一条新装备预设。</p></div>
        <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="关闭"><X size={22} /></button>
      </header>
      <div className="build-import-body">
        <aside>
          <img src={imageUrl} alt="待导入的角色装备截图" />
          <div className="build-import-warnings">{draft.warnings.map((warning) => <span key={warning}><AlertTriangle size={14} />{warning}</span>)}</div>
        </aside>
        <main>
          <div className="build-import-selects">
            <label><span>角色</span><SearchableImportSelect value={selectedHero?.code || ''} options={heroOptions} placeholder="输入中文名、英文名或别名" onChange={setHero} /><Confidence value={draft.hero.confidence} /></label>
            <label><span>神器</span><SearchableImportSelect value={draft.artifact.value?.artifactCode || ''} options={artifactOptions} placeholder="输入神器名称或别名" onChange={(value) => {
              const artifact = artifacts.find((item) => item.code === value);
              setDraft((current) => ({ ...current, artifact: { value: artifact ? { artifactCode: artifact.code, displayName: artifact.name } : null, confidence: artifact ? 1 : 0, source: 'manual' } }));
            }} /><Confidence value={draft.artifact.confidence} /></label>
            <label><span>神器等级</span><input type="number" min="0" max="30" value={draft.artifactLevel.value ?? ''} onChange={(event) => setDraft((current) => ({ ...current, artifactLevel: { value: event.target.value === '' ? null : Math.max(0, Math.min(30, Number(event.target.value))), confidence: 1, source: 'manual' } }))} /><Confidence value={draft.artifactLevel.confidence} /></label>
          </div>
          <section className="build-import-imprint">
            <div><h3>刻印</h3><span>截图识别后仍可手动切换</span></div>
            <div>
              {(['self', 'team'] as ImprintMode[]).map((mode) => <button type="button" className={(draft.imprint.value?.mode || 'self') === mode ? 'active' : ''} key={mode} onClick={() => setDraft((current) => ({ ...current, imprint: { value: { mode, rank: current.imprint.value?.rank || 'SSS' }, confidence: 1, source: 'manual' } }))}>{mode === 'self' ? '自阵（作用自身）' : '群阵（不作用自身）'}</button>)}
              {(['B', 'A', 'S', 'SS', 'SSS'] as ImprintRank[]).map((rank) => <button type="button" className={(draft.imprint.value?.rank || 'SSS') === rank ? 'active' : ''} key={rank} onClick={() => setDraft((current) => ({ ...current, imprint: { value: { mode: current.imprint.value?.mode || 'self', rank }, confidence: 1, source: 'manual' } }))}>{rank}</button>)}
            </div>
          </section>
          <section className="build-import-stats"><h3>角色最终面板</h3><div>{recognizedStatKeys.map((key) => <label className={draft.targetStats[key].confidence < 0.7 ? 'uncertain' : ''} key={key}><span>{statLabels[key]}</span><input type="number" value={draft.targetStats[key].value ?? ''} onChange={(event) => setDraft((current) => ({ ...current, targetStats: { ...current.targetStats, [key]: { value: event.target.value === '' ? null : Math.max(0, Number(event.target.value)), confidence: 1, source: 'manual' } } }))} />{['chc', 'chd', 'eff', 'efr'].includes(key) && <b>%</b>}</label>)}</div></section>
          <section className="build-import-sets"><div><h3>已激活套装</h3><span>{usedPieces}/6 件形成套装</span></div><div className="build-import-set-summary">{(draft.sets.value || []).map((code, index) => <button type="button" key={`${code}-${index}`} onClick={() => setDraft((current) => ({ ...current, sets: { value: current.sets.value?.filter((_, setIndex) => setIndex !== index) || [], confidence: 1, source: 'manual' } }))}><img src={equipmentSet(code).icon} alt="" />{equipmentSet(code).name}<X size={13} /></button>)}</div>
            <div className="build-import-set-picker">{equipmentSets.map((set) => <button type="button" key={set.code} disabled={usedPieces + set.pieces > 6} onClick={() => setDraft((current) => ({ ...current, sets: { value: cycleEquipmentSet(current.sets.value || [], set), confidence: 1, source: 'manual' } }))}><img src={set.icon} alt="" />{set.name}</button>)}</div>
          </section>
        </main>
      </div>
      <footer><button className="ghost-button" type="button" onClick={onClose} disabled={saving}>取消</button><button className="primary-button" type="button" onClick={() => onConfirm(draft)} disabled={!valid || saving}><Check size={17} />{saving ? '正在保存…' : '确认并跳转到角色'}</button></footer>
    </section>
  </div>;
}

function Confidence({ value }: { value: number }) {
  return <small className={value >= 0.88 ? 'reliable' : value >= 0.7 ? 'review' : 'uncertain'}>{value >= 0.88 ? '识别可靠' : value >= 0.7 ? '请确认' : '需要修正'}</small>;
}

function artifactAllowed(code: string, hero: LibraryHero, artifacts: LibraryArtifact[]) {
  const artifact = artifacts.find((item) => item.code === code);
  return !artifact || artifact.role === 'common' || artifact.role === hero.role;
}
