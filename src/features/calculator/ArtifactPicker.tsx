import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import type { DamageRow } from '../../calc/damageEngine';
import { artifactAliases, isArtifactAllowed, skillName } from '../../data/catalog';
import { calculatorArtifactIdForLibraryArtifact } from '../build-presets/calculatorBuildBridge';
import {
  artifactDamageIncrease, compareArtifact, comparisonDamage, comparisonRowKey, formatArtifactIncrease, isArtifactAutoComparisonAllowed,
  type ArtifactComparison, type ArtifactComparisonContext, type ComparisonHit,
} from './artifactComparison';

type Props = {
  context: ArtifactComparisonContext;
  rows: DamageRow[];
  query: string;
  onSelect: (id: string) => void;
};

const hitOptions: Array<[ComparisonHit, string]> = [['crit', '暴击'], ['crush', '强击'], ['normal', '普通'], ['miss', '闪避']];

export function ArtifactPicker({ context, rows, query, onSelect }: Props) {
  const [automatic, setAutomatic] = useState(false);
  const [rowKey, setRowKey] = useState(() => rows[0] ? comparisonRowKey(rows[0]) : '');
  const [hit, setHit] = useState<ComparisonHit>('crit');
  const [results, setResults] = useState<Map<string, ArtifactComparison> | null>(null);
  const { heroId, defenderId, attacker, defender, preset, artifacts } = context;
  const items = useMemo(() => artifacts
    .filter((item) => item.role === 'common' || item.role === Heroes[heroId].class)
    .map((artifact) => ({ artifact, id: calculatorArtifactIdForLibraryArtifact(artifact) }))
    .filter(({ id }) => !Artifacts[id] || isArtifactAllowed(Artifacts[id], heroId, Heroes[heroId].class))
    .filter(({ id }) => !automatic || isArtifactAutoComparisonAllowed(id)), [artifacts, heroId, automatic]);
  const selectedRow = rows.find((row) => comparisonRowKey(row) === rowKey) || rows[0];
  const selectedKey = selectedRow ? comparisonRowKey(selectedRow) : '';
  const availableHits = hitOptions.filter(([key]) => selectedRow?.[key] != null);
  const selectedHit = availableHits.some(([key]) => key === hit) ? hit : availableHits[0]?.[0] || 'normal';

  useEffect(() => {
    if (!automatic) { setResults(null); return; }
    setResults(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const calculated = new Map<string, ArtifactComparison>();
    const ids = ['noProc', ...new Set(items.map((item) => item.id))];
    let offset = 0;
    const calculateBatch = () => {
      if (cancelled) return;
      for (const id of ids.slice(offset, offset + 6)) {
        try {
          calculated.set(id, compareArtifact({ heroId, defenderId, attacker, defender, preset, artifacts }, id));
        } catch {
          calculated.set(id, { artifactId: id, supported: false, rows: [] });
        }
      }
      offset += 6;
      if (offset < ids.length) timer = setTimeout(calculateBatch, 0);
      else setResults(calculated);
    };
    // Let the controls paint first; yield between batches rather than blocking the picker.
    timer = setTimeout(calculateBatch, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [automatic, items, heroId, defenderId, attacker, defender, preset, artifacts]);

  const baseline = results?.get('noProc');
  const increase = (id: string, status = selectedHit) => artifactDamageIncrease(results?.get(id), baseline, selectedKey, status);
  const q = query.trim().toLowerCase();
  const filtered = items.filter(({ artifact }) => !q || `${artifact.code} ${artifact.name} ${artifact.nameEn || ''} ${artifactAliases(artifact.code.replaceAll('-', '_'))}`.toLowerCase().includes(q));
  if (automatic && results) filtered.sort((a, b) => (increase(b.id) ?? -Infinity) - (increase(a.id) ?? -Infinity));

  const preview = (id: string) => {
    if (!automatic || !results) return null;
    const result = results.get(id);
    if (!result?.supported) return <small className="artifact-increase unavailable">（未接入计算）</small>;
    const value = increase(id);
    const miss = increase(id, 'miss');
    const damage = comparisonDamage(result, selectedKey, selectedHit);
    const base = comparisonDamage(baseline, selectedKey, selectedHit);
    return <small className={`artifact-increase${value === null ? ' unavailable' : ''}`}
      title={`当前伤害 ${damage ?? '—'} / 不带神器 ${base ?? '—'}`}>
      （{formatArtifactIncrease(value)}，{formatArtifactIncrease(miss)}（闪避））
    </small>;
  };

  return <>
    <div className="artifact-auto-select">
      <button type="button" className={automatic ? 'active' : ''} aria-expanded={automatic}
        onClick={() => setAutomatic((value) => !value)}>快速筛选 <ChevronDown size={16} /></button>
      {automatic && <div className="artifact-auto-options">
        <label>技能选择<select aria-label="技能选择" value={selectedKey} onChange={(event) => setRowKey(event.target.value)}>
          {rows.map((row) => <option key={comparisonRowKey(row)} value={comparisonRowKey(row)}>
            {skillName(row.skill)}{row.variant ? `(${row.variant})` : ''}{row.skill.endsWith('_soulburn') ? '（烧魂）' : ''}{row.skill.endsWith('_extra') ? '（额外攻击）' : ''}
          </option>)}
        </select></label>
        <label>命中状态<select aria-label="命中状态" value={selectedHit} onChange={(event) => setHit(event.target.value as ComparisonHit)}>
          {availableHits.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <span className="artifact-auto-note" role="status">{results ? '+30 · 以不带神器为准 · 已按增伤排序' : '正在比较神器…'}</span>
        <span className="artifact-auto-note">触发条件沿用当前设置；{attacker.useBuildPreset !== false && preset ? '计入更换神器后的面板变化' : '保持当前手填面板'}</span>
      </div>}
    </div>
    <div className="picker-list artifact-picker-list">
      <button className="picker-row" onClick={() => onSelect('noProc')}>
        <img src="/assets/artifacts/noProc.png" alt="" /><span>不使用神器{preview('noProc')}</span>
      </button>
      {filtered.slice(0, 80).map(({ artifact, id }) => <button key={artifact.code} className="picker-row" onClick={() => onSelect(id)}>
        <img src={artifact.image || '/assets/artifacts/noProc.png'} alt="" onError={(event) => {
          event.currentTarget.onerror = null; event.currentTarget.src = '/assets/artifacts/noProc.png';
        }} />
        <span>{artifact.name}{preview(id)}</span>
      </button>)}
    </div>
  </>;
}
