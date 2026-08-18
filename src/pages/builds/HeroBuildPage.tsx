import { ChevronDown, ClipboardPaste, Copy, Plus, Save, Search, Shield, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createManualBuildPreset, deleteBuildPreset, hydrateBuildPresetsFromDisk, listBuildPresets, saveBuildPreset } from '../../features/build-presets/buildPresetStore';
import { calculatorHeroIdForLibraryCode } from '../../features/build-presets/calculatorBuildBridge';
import { loadCommunityBuildPresets } from '../../features/build-presets/communityPresetRepository';
import { cycleEquipmentSet, equipmentSet, equipmentSets } from '../../features/build-presets/setCatalog';
import { calculateGearScore, rightMainStatLabels, rightMainStatOptions, targetStatsAfterArtifactChange, type GearSlot } from '../../features/build-presets/buildScore';
import type { BuildPreset, ImprintMode, ImprintRank, RightMainStat, TargetStats } from '../../features/build-presets/types';
import { recognizeBuildScreenshot } from '../../features/build-screenshot/buildScreenshotRecognizer';
import type { BuildScreenshotRecognition } from '../../features/build-screenshot/types';
import { roleLabels } from '../../library/catalog';
import { loadLibraryArtifacts, loadLibraryHeroes } from '../../library/libraryRepository';
import type { LibraryArtifact, LibraryHero } from '../../library/types';
import { BuildScreenshotImportDialog } from '../../components/build-screenshot/BuildScreenshotImportDialog';
import { artifactAliases, heroName, heroSearchNames, hydrateAliasesFromDisk } from '../../data/catalog';
import { LibraryEmpty, LibraryFrame } from '../library/HeroLibraryPage';

type Props = { initialHeroCode: string | null; onUseInCalculator: (side: 'attacker' | 'defender', heroId: string, presetId: string) => void };
const statFields: Array<{ key: keyof TargetStats; label: string; max: number; percent?: boolean }> = [
  { key: 'atk', label: '攻击力', max: 10000 }, { key: 'def', label: '防御力', max: 5000 }, { key: 'hp', label: '生命值', max: 50000 },
  { key: 'spd', label: '速度', max: 400 }, { key: 'chc', label: '暴击率', max: 100, percent: true }, { key: 'chd', label: '暴击伤害', max: 350, percent: true },
  { key: 'eff', label: '效果命中', max: 300, percent: true }, { key: 'efr', label: '效果抗性', max: 300, percent: true },
];

export function HeroBuildPage({ initialHeroCode, onUseInCalculator }: Props) {
  const [heroes, setHeroes] = useState<LibraryHero[]>([]);
  const [artifacts, setArtifacts] = useState<LibraryArtifact[]>([]);
  const [community, setCommunity] = useState<BuildPreset[]>([]);
  const [heroCode, setHeroCode] = useState(initialHeroCode || '');
  const [presets, setPresets] = useState<BuildPreset[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<BuildPreset | null>(null);
  const [artifactQuery, setArtifactQuery] = useState('');
  const [heroQuery, setHeroQuery] = useState('');
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [equipmentPicker, setEquipmentPicker] = useState<null | 'sets' | 'artifact' | 'mains' | 'exclusive' | 'imprint'>(null);
  const [pasteState, setPasteState] = useState('Ctrl+V 粘贴角色装备截图');
  const [screenshotImport, setScreenshotImport] = useState<{ imageUrl: string; recognition: BuildScreenshotRecognition } | null>(null);
  const [importSaving, setImportSaving] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const hydrated = useRef(false);
  const skipNextSave = useRef(true);
  const pendingImportedId = useRef('');

  useEffect(() => {
    Promise.all([loadLibraryHeroes(), loadLibraryArtifacts(), loadCommunityBuildPresets(), hydrateBuildPresetsFromDisk(), hydrateAliasesFromDisk()])
      .then(([heroRows, artifactRows, communityRows]) => {
        setHeroes(heroRows); setArtifacts(artifactRows); setCommunity(communityRows); hydrated.current = true;
        setHeroCode((current) => heroRows.some((hero) => hero.code === current) ? current : heroRows[0]?.code || '');
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current || !heroCode) return;
    const source = community.find((item) => item.heroCode === heroCode) || null;
    const rows = listBuildPresets(heroCode, source);
    if (rows.length) {
      const preferred = rows.find((preset) => preset.id === pendingImportedId.current) || rows[0];
      pendingImportedId.current = '';
      setPresets(rows); selectPreset(preferred);
    } else {
      createManualBuildPreset(heroCode, null).then((preset) => { setPresets([preset]); selectPreset(preset); });
    }
  }, [heroCode, community]);

  useEffect(() => {
    if (!draft || !hydrated.current) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveState('saving');
    const timer = window.setTimeout(() => saveBuildPreset(draft).then((saved) => {
      setDraft(saved);
      setPresets((rows) => rows.map((item) => item.id === saved.id ? saved : item));
      setSaveState('saved');
    }).catch(() => setSaveState('error')), 450);
    return () => window.clearTimeout(timer);
  }, [draft?.id, draft?.name, draft?.artifactCode, draft?.artifactLevel, draft?.imprintMode, draft?.imprintRank, draft?.exclusiveEquipmentId, JSON.stringify(draft?.rightMainStats), JSON.stringify(draft?.sets), JSON.stringify(draft?.targetStats)]);

  const hero = heroes.find((item) => item.code === heroCode) || null;
  const heroDisplayName = hero ? heroName(calculatorHeroIdForLibraryCode(hero.code) || hero.code.replaceAll('-', '_')) || hero.name : '';
  const compatibleArtifacts = useMemo(() => artifacts.filter((artifact) => (artifact.role === 'common' || artifact.role === hero?.role)
    && (!artifactQuery.trim() || `${artifact.name} ${artifact.nameEn || ''} ${artifactAliases(artifact.code.replaceAll('-', '_'))}`.toLocaleLowerCase().includes(artifactQuery.trim().toLocaleLowerCase()))).slice(0, 36), [artifacts, hero?.role, artifactQuery]);
  const selectedArtifact = artifacts.find((artifact) => artifact.code === draft?.artifactCode) || null;
  const pieces = draft?.sets.reduce((sum, code) => sum + equipmentSet(code).pieces, 0) || 0;
  const calculatorHeroId = calculatorHeroIdForLibraryCode(heroCode);
  const score = hero && draft ? calculateGearScore(hero, draft, selectedArtifact) : null;
  const selectedExclusive = hero?.exclusives.find((item) => item.id === draft?.exclusiveEquipmentId) || (draft?.exclusiveEquipmentId === 'none' ? null : hero?.exclusives[0]) || null;

  const selectPreset = (preset: BuildPreset) => { skipNextSave.current = true; setSaveState('saved'); setActiveId(preset.id); setDraft({ ...preset, artifactLevel: preset.artifactLevel ?? 30, imprintMode: preset.imprintMode || 'self', imprintRank: preset.imprintRank || 'SSS', rightMainStats: { necklace: 'auto', ring: 'auto', boots: 'auto', ...(preset.rightMainStats || {}) }, sets: [...preset.sets], targetStats: { ...preset.targetStats } }); };
  const refreshPresets = (next?: BuildPreset) => {
    const source = community.find((item) => item.heroCode === heroCode) || null;
    const rows = listBuildPresets(heroCode, source); setPresets(rows);
    if (next) selectPreset(next); else if (rows[0]) selectPreset(rows[0]); else setDraft(null);
  };
  const changeArtifactLevel = (nextLevel: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      artifactLevel: nextLevel,
      targetStats: targetStatsAfterArtifactChange(draft.targetStats, selectedArtifact, draft.artifactLevel ?? 30, selectedArtifact, nextLevel),
    });
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
      const file = image?.getAsFile();
      if (!file || !heroes.length || !artifacts.length) return;
      event.preventDefault();
      setPasteState('正在识别角色、神器、面板和套装…');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const imageUrl = String(reader.result || '');
          const recognition = await recognizeBuildScreenshot(imageUrl, heroes, artifacts);
          setScreenshotImport({ imageUrl, recognition });
          setPasteState('识别完成，请在预览中确认');
        } catch (error) {
          console.error(error); setPasteState('截图识别失败，请确认是完整装备页面');
        }
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [heroes, artifacts]);

  const confirmScreenshotImport = async (recognition: BuildScreenshotRecognition) => {
    const recognizedHero = recognition.hero.value;
    if (!recognizedHero) return;
    const recognizedCode = recognizedHero.heroCode;
    setImportSaving(true);
    try {
      const source = community.find((item) => item.heroCode === recognizedCode) || null;
      const existing = listBuildPresets(recognizedCode, source)[0] || source;
      const created = await createManualBuildPreset(recognizedCode, existing || null);
      const stats = Object.fromEntries(Object.entries(recognition.targetStats).map(([key, field]) => [key, field.value])) as Partial<TargetStats>;
      const imported = await saveBuildPreset({
        ...created,
        name: `截图导入 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
        sets: [...(recognition.sets.value || [])],
        artifactCode: recognition.artifact.value?.artifactCode || null,
        artifactName: recognition.artifact.value?.displayName || null,
        artifactLevel: recognition.artifactLevel.value ?? 30,
        imprintMode: recognition.imprint.value?.mode || 'self',
        imprintRank: recognition.imprint.value?.rank || 'SSS',
        targetStats: { ...created.targetStats, ...stats },
      });
      pendingImportedId.current = imported.id;
      setScreenshotImport(null);
      setPasteState(`已导入到${recognizedHero.displayName}`);
      if (heroCode === recognizedCode) refreshPresets(imported);
      else setHeroCode(recognizedCode);
    } catch (error) {
      console.error(error);
      setPasteState('保存识别预设失败，请重试');
    } finally {
      setImportSaving(false);
    }
  };

  useEffect(() => {
    const closePicker = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setHeroPickerOpen(false);
      setEquipmentPicker(null);
    };
    window.addEventListener('keydown', closePicker);
    return () => window.removeEventListener('keydown', closePicker);
  }, []);

  if (!heroes.length) return <LibraryFrame eyebrow="Build workshop" title="角色装备" count="加载中"><LibraryEmpty title="正在加载装备工作台" message="正在准备角色、神器和推荐预设。" /></LibraryFrame>;

  return (
    <LibraryFrame eyebrow="Build workshop" title="角色装备" count={hero ? `${heroDisplayName} · ${roleLabels[hero.role]}` : '选择角色'}>
      <section className="build-hero-strip">
        <button type="button" className="build-hero-picker-trigger" onClick={() => { setHeroQuery(''); setHeroPickerOpen(true); }}>
          {hero?.avatar ? <img src={hero.avatar} alt="" /> : <span>{hero?.name.slice(0, 1) || '?'}</span>}
          <span><small>当前角色</small><strong>{heroDisplayName || '选择角色'}</strong></span>
          <Search size={18} />
        </button>
        <div className="build-strip-status"><span className="paste-hint"><ClipboardPaste size={15} />{pasteState}</span><span className={`build-save-state ${saveState}`}><Save size={15} />{saveState === 'saving' ? '保存中' : saveState === 'error' ? '保存失败，可继续修改后重试' : '已保存到本机'}</span></div>
      </section>
      <div className="build-workbench">
        <aside className="preset-rail">
          <div className="preset-rail__heading"><strong>装备预设</strong><button type="button" title="新建空白预设" onClick={async () => refreshPresets(await createManualBuildPreset(heroCode, null))}><Plus size={16} /></button></div>
          <div className="preset-list">{presets.map((preset) => <button type="button" className={preset.id === activeId ? 'active' : ''} key={preset.id} onClick={() => selectPreset(preset)}><span>{preset.name}</span><small>{preset.source === 'community' ? '社区推荐' : '手动'}</small></button>)}</div>
          {draft && <div className="preset-rail__actions">
            <button type="button" onClick={async () => refreshPresets(await createManualBuildPreset(heroCode, draft))}><Copy size={15} />复制</button>
            <button type="button" className="danger" onClick={async () => { if (!window.confirm(`删除预设「${draft.name}」？`)) return; await deleteBuildPreset(draft); refreshPresets(); }}><Trash2 size={15} />删除</button>
          </div>}
        </aside>

        {draft ? <section className="build-editor">
          <section className="build-editor__section build-name-row"><label>预设名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value.slice(0, 24) })} /></label><span className={draft.source}>{draft.source === 'community' ? '社区推荐，可编辑' : '手动预设'}</span><div className="build-calculator-actions"><button type="button" disabled={!calculatorHeroId} onClick={async () => { if (!calculatorHeroId) return; const saved = await saveBuildPreset(draft); onUseInCalculator('attacker', calculatorHeroId, saved.id); }}>应用到攻击角色</button><button type="button" disabled={!calculatorHeroId} onClick={async () => { if (!calculatorHeroId) return; const saved = await saveBuildPreset(draft); onUseInCalculator('defender', calculatorHeroId, saved.id); }}>应用到防守角色</button></div></section>
          <section className="build-editor__section target-panel"><div className="section-title"><div><Shield size={18} /><strong>角色最终面板</strong></div><span>点击数值即可修改</span></div><div className="target-stat-grid">{statFields.map((field) => (
            <label key={field.key}><span>{field.label}</span><div className="target-stat-value"><input aria-label={field.label} type="number" min="0" max={field.max} step={field.percent ? 0.1 : 1} value={draft.targetStats[field.key]} onChange={(event) => setDraft({ ...draft, targetStats: { ...draft.targetStats, [field.key]: Math.max(0, Math.min(field.max, Number(event.target.value) || 0)) } })} />{field.percent && <b>%</b>}</div></label>
          ))}<label className="target-stat-fixed"><span>夹攻率</span><div className="target-stat-value"><strong>3.0</strong><b>%</b></div></label></div></section>
          {score && <section className={`build-score-strip ${score.valid ? '' : 'warning'}`}><div><span>均分</span><strong>{score.average.toFixed(2)}</strong></div><div><span>均速</span><strong>{score.averageSpeed.toFixed(2)}</strong></div><small>{score.inferred ? `自动推断：${rightMainStatLabels[score.mains.necklace]} / ${rightMainStatLabels[score.mains.ring]} / ${rightMainStatLabels[score.mains.boots]}` : '按已选右三件主属性计算'}{!score.valid ? ' · 当前配置存在负副属性，请检查主属性或阵型' : ''}</small></section>}
          <section className="build-editor__section equipment-summary-grid">
            <EquipmentSummary title="右三件主属性" detail={score ? `${rightMainStatLabels[score.mains.necklace]} · ${rightMainStatLabels[score.mains.ring]} · ${rightMainStatLabels[score.mains.boots]}` : '自动推断'} onClick={() => setEquipmentPicker('mains')} />
            <EquipmentSummary title="装备套装" detail={draft.sets.length ? draft.sets.map((code) => equipmentSet(code).name).join(' · ') : '未选择套装'} meta={`${pieces} / 6 件`} onClick={() => setEquipmentPicker('sets')} />
            <EquipmentSummary title="阵型刻印" detail={`${draft.imprintRank || 'SSS'} ${(draft.imprintMode || 'self') === 'self' ? '自阵（作用自身）' : '群阵（不作用自身）'}`} onClick={() => setEquipmentPicker('imprint')} />
            <EquipmentSummary title="专属装备" detail={selectedExclusive ? `${selectedExclusive.name} · ${selectedExclusive.mainStat ? `${exclusiveStatLabel(selectedExclusive.mainStat.type)} ${formatExclusiveValue(selectedExclusive.mainStat.max, selectedExclusive.mainStat.type)}` : '满属性'}` : hero?.exclusives.length ? '不使用' : '该角色没有专属装备'} onClick={() => hero?.exclusives.length && setEquipmentPicker('exclusive')} />
          </section>
        </section> : <section className="build-editor"><LibraryEmpty title="这个角色还没有预设" message="点击左侧加号创建一条空白预设。" /></section>}

        <aside className="artifact-picker-panel collapsed-artifact-panel">
          <div className="section-title"><div><Shield size={18} /><strong>神器</strong></div></div>
          <button type="button" className="selected-artifact" onClick={() => setEquipmentPicker('artifact')}>{selectedArtifact ? <>{selectedArtifact.image ? <img src={selectedArtifact.image} alt="" /> : <span>{selectedArtifact.name.slice(0, 1)}</span>}<div><strong>{selectedArtifact.name}</strong><small>{selectedArtifact.nameEn || selectedArtifact.code} · +{draft?.artifactLevel ?? 30}</small></div><ChevronDown size={18} /></> : <div><strong>{draft?.artifactName || '尚未选择神器'}</strong><small>点击选择与职业匹配的神器</small></div>}</button>
          {selectedArtifact && draft && <label className="artifact-level-control"><span>神器等级</span><input type="range" min="0" max="30" value={draft.artifactLevel ?? 30} onChange={(event) => changeArtifactLevel(Number(event.target.value))} /><b>+{draft.artifactLevel ?? 30}</b></label>}
        </aside>
      </div>
      {screenshotImport && <BuildScreenshotImportDialog imageUrl={screenshotImport.imageUrl} recognition={screenshotImport.recognition} heroes={heroes} artifacts={artifacts} saving={importSaving} onClose={() => setScreenshotImport(null)} onConfirm={confirmScreenshotImport} />}
      {draft && equipmentPicker && <EquipmentPickerModal mode={equipmentPicker} draft={draft} hero={hero} artifacts={compatibleArtifacts} artifactQuery={artifactQuery} pieces={pieces} selectedArtifact={selectedArtifact} onQuery={setArtifactQuery} onChange={setDraft} onClose={() => setEquipmentPicker(null)} />}
      {heroPickerOpen && <BuildHeroPickerModal heroes={heroes} query={heroQuery} onQuery={setHeroQuery} onSelect={(code) => { setHeroCode(code); setHeroPickerOpen(false); }} onClose={() => setHeroPickerOpen(false)} />}
    </LibraryFrame>
  );
}

function removeLastSet(sets: string[], code: string) {
  const index = sets.lastIndexOf(code);
  return index < 0 ? sets : sets.filter((_, itemIndex) => itemIndex !== index);
}

function EquipmentSummary({ title, detail, meta, onClick }: { title: string; detail: string; meta?: string; onClick: () => void }) {
  return <button type="button" className="equipment-summary" onClick={onClick}><span>{title}</span><strong>{detail}</strong>{meta && <small>{meta}</small>}<ChevronDown size={17} /></button>;
}

function BuildHeroPickerModal({ heroes, query, onQuery, onSelect, onClose }: {
  heroes: LibraryHero[];
  query: string;
  onQuery: (value: string) => void;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const normalized = query.trim().toLocaleLowerCase();
  const visible = heroes.filter((hero) => !normalized || [
    hero.name,
    hero.nameEn || '',
    hero.nameZht || '',
    hero.code,
    ...hero.nicknames,
    heroSearchNames(calculatorHeroIdForLibraryCode(hero.code) || hero.code.replaceAll('-', '_')),
  ].join(' ').toLocaleLowerCase().includes(normalized)).slice(0, 120);
  return <div className="library-modal-backdrop" onClick={onClose}>
    <section className="build-hero-picker-modal" onClick={(event) => event.stopPropagation()}>
      <header><div><span>Hero selector</span><h2>切换角色</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={21} /></button></header>
      <label className="build-hero-search"><Search size={18} /><input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索中文名、英文名或别名" /></label>
      <div className="build-hero-picker-list">{visible.map((hero) => <button type="button" key={hero.code} onClick={() => onSelect(hero.code)}>
        {hero.avatar ? <img src={hero.avatar} alt="" /> : <span>{hero.name.slice(0, 1)}</span>}
        <div><strong>{heroName(calculatorHeroIdForLibraryCode(hero.code) || hero.code.replaceAll('-', '_')) || hero.name}</strong><small>{hero.nameEn || hero.code}</small></div>
      </button>)}{!visible.length && <div className="library-empty compact"><strong>没有匹配的角色</strong><span>可以尝试中文名、英文名或已保存的别名。</span></div>}</div>
    </section>
  </div>;
}

function EquipmentPickerModal({ mode, draft, hero, artifacts, artifactQuery, pieces, selectedArtifact, onQuery, onChange, onClose }: {
  mode: 'sets' | 'artifact' | 'mains' | 'exclusive' | 'imprint'; draft: BuildPreset; hero: LibraryHero | null; artifacts: LibraryArtifact[]; artifactQuery: string; pieces: number;
  selectedArtifact: LibraryArtifact | null;
  onQuery: (value: string) => void; onChange: (preset: BuildPreset) => void; onClose: () => void;
}) {
  return <div className="library-modal-backdrop" onClick={onClose}><section className="equipment-picker-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Equipment setup</span><h2>{mode === 'sets' ? '切换装备套装' : mode === 'artifact' ? '切换神器' : mode === 'mains' ? '设置右三件主属性' : mode === 'imprint' ? '设置阵型刻印' : '选择专属装备'}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={21} /></button></header>
    {mode === 'sets' && <div className="set-picker modal-set-picker">{equipmentSets.map((set) => { const count = draft.sets.filter((code) => code === set.code).length; const canAdd = pieces + set.pieces <= 6; return <button type="button" className={count ? 'active' : ''} disabled={!count && !canAdd} key={set.code} onClick={() => onChange({ ...draft, sets: cycleEquipmentSet(draft.sets, set) })}><img src={set.icon} alt="" /><span>{set.name}{count > 0 ? ` ×${count}` : ''}</span><small>{count ? (canAdd ? '点击再加一套' : '点击取消') : `${set.pieces}件`}</small></button>; })}</div>}
    {mode === 'artifact' && <><label className="artifact-search modal-artifact-search"><Search size={16} /><input autoFocus value={artifactQuery} onChange={(event) => onQuery(event.target.value)} placeholder="搜索神器中文名或英文名" /></label><div className="artifact-choice-list modal-artifact-list">{artifacts.map((artifact) => <button type="button" className={draft.artifactCode === artifact.code ? 'active' : ''} key={artifact.code} onClick={() => {
      onChange({
        ...draft,
        artifactCode: artifact.code,
        artifactName: artifact.nameEn || artifact.code,
        targetStats: targetStatsAfterArtifactChange(draft.targetStats, selectedArtifact, draft.artifactLevel ?? 30, artifact, draft.artifactLevel ?? 30),
      });
      onClose();
    }}>{artifact.image ? <img src={artifact.image} alt="" /> : <span>{artifact.name.slice(0, 1)}</span>}<div><strong>{artifact.name}</strong><small>{artifact.nameEn || artifact.code} · {artifact.rarity}★</small></div></button>)}</div></>}
    {mode === 'mains' && <div className="right-main-editor">{(['necklace', 'ring', 'boots'] as GearSlot[]).map((slot) => <label key={slot}><span>{slot === 'necklace' ? '项链' : slot === 'ring' ? '戒指' : '鞋子'}</span><select value={draft.rightMainStats?.[slot] || 'auto'} onChange={(event) => onChange({ ...draft, rightMainStats: { necklace: 'auto', ring: 'auto', boots: 'auto', ...(draft.rightMainStats || {}), [slot]: event.target.value as RightMainStat } })}>{rightMainStatOptions[slot].map((option) => <option value={option} key={option}>{rightMainStatLabels[option]}</option>)}</select></label>)}</div>}
    {mode === 'imprint' && <div className="imprint-picker">
      <div><strong>刻印方式</strong>{(['self', 'team'] as ImprintMode[]).map((item) => <button type="button" className={(draft.imprintMode || 'self') === item ? 'active' : ''} key={item} onClick={() => onChange({ ...draft, imprintMode: item })}>{item === 'self' ? '自阵（作用自身）' : '群阵（不作用自身）'}</button>)}</div>
      <div><strong>刻印等级</strong>{(['B', 'A', 'S', 'SS', 'SSS'] as ImprintRank[]).map((rank) => <button type="button" className={(draft.imprintRank || 'SSS') === rank ? 'active' : ''} key={rank} onClick={() => onChange({ ...draft, imprintRank: rank })}>{rank}</button>)}</div>
    </div>}
    {mode === 'exclusive' && <div className="exclusive-picker-list"><button type="button" className={draft.exclusiveEquipmentId === 'none' ? 'active' : ''} onClick={() => { onChange({ ...draft, exclusiveEquipmentId: 'none' }); onClose(); }}><strong>不使用专属装备</strong></button>{hero?.exclusives.map((equipment) => <button type="button" className={draft.exclusiveEquipmentId === equipment.id || (!draft.exclusiveEquipmentId && equipment === hero.exclusives[0]) ? 'active' : ''} key={equipment.id} onClick={() => { onChange({ ...draft, exclusiveEquipmentId: equipment.id }); onClose(); }}>{equipment.iconKey && <img src={equipment.iconKey} alt="" />}<strong>{equipment.name}</strong><span>{equipment.mainStat ? `${exclusiveStatLabel(equipment.mainStat.type)} ${formatExclusiveValue(equipment.mainStat.max, equipment.mainStat.type)}` : '满属性'}</span><small>{equipment.skillOptions.map((item) => item.description).join('；')}</small></button>)}</div>}
  </section></div>;
}

function exclusiveStatLabel(type: string) {
  return ({ acc: '效果命中', max_hp_rate: '生命值', att_rate: '攻击力', def_rate: '防御力', speed: '速度', cri: '暴击率', cri_dmg: '暴击伤害', res: '效果抗性' } as Record<string, string>)[type] || type;
}

function formatExclusiveValue(value: number, type: string) {
  return ['acc', 'max_hp_rate', 'att_rate', 'def_rate', 'cri', 'cri_dmg', 'res'].includes(type) ? `+${(value * 100).toFixed(1)}%` : `+${value}`;
}
