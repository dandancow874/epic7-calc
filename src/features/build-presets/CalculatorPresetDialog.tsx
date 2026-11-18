import { useState } from 'react';
import { X } from 'lucide-react';
import { artifactName } from '../../data/catalog';
import { equipmentSet, equipmentSets } from './setCatalog';
import { presetEquipmentPieces, snapshotStats, type CalculatorPresetSnapshot } from './calculatorPresetSnapshot';
import type { BuildPreset } from './types';

export function CalculatorPresetDialog(props: {
  snapshot: CalculatorPresetSnapshot; onSave: (preset: BuildPreset) => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ ...props.snapshot.preset, name: '手动面板' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pieces = presetEquipmentPieces(draft);
  return <div className="modal-scrim snapshot-scrim" onClick={() => { if (!saving) props.onClose(); }}>
    <form className="profile-modal calculator-preset-dialog" aria-label="保存装备预设" onClick={event => event.stopPropagation()} onSubmit={async event => {
      event.preventDefault();
      if (pieces > 6 || !draft.name.trim() || saving) return;
      setSaving(true);
      try { await props.onSave({ ...draft, name: draft.name.trim() }); }
      catch { setError('保存失败，请重试'); setSaving(false); }
    }}>
      <div className="modal-head"><h2>当前面板存为新预设</h2><button type="button" className="icon-button" aria-label="关闭" disabled={saving} onClick={props.onClose}><X size={22} /></button></div>
      <div className="profile-body">
        <label className="snapshot-name">预设名称<input required maxLength={24} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <div className="snapshot-stats">{snapshotStats.map(({ key, label }) => {
          const missing = draft.missingStats?.includes(key);
          const edited = draft.targetStats[key] !== props.snapshot.preset.targetStats[key] || Boolean(props.snapshot.preset.missingStats?.includes(key)) !== Boolean(missing);
          const origin = missing ? '待补充' : edited ? '已修改' : props.snapshot.currentStats.includes(key) ? '当前数值' : '沿用原预设';
          return <label key={key} className={props.snapshot.currentStats.includes(key) ? 'from-current' : ''}>
            <span>{label}<small>{origin}</small></span>
            <input type="number" aria-label={label} min={0} step="any" placeholder="待补充" value={missing ? '' : draft.targetStats[key]} onChange={event => {
              const blank = event.target.value === '';
              setDraft({ ...draft, targetStats: { ...draft.targetStats, [key]: blank ? 0 : Number(event.target.value) },
                missingStats: [...(draft.missingStats || []).filter(field => field !== key), ...(blank ? [key] : [])] });
            }} />
          </label>;
        })}</div>
        <p className="snapshot-note">待补充项可留空，不会覆盖计算器现有数值。战斗 Buff 不写入装备面板。</p>
        <p>神器：{draft.artifactName || (draft.artifactCode ? artifactName(draft.artifactCode.replaceAll('-', '_')) : '不使用神器')}　+{draft.artifactLevel ?? 30}</p>
        <div className="snapshot-set-heading"><strong>装备套装</strong><span className={pieces > 6 ? 'snapshot-error' : ''}>{pieces} / 6 件</span></div>
        <div className="snapshot-selected-sets">{draft.sets.map((code, index) => <button key={`${code}:${index}`} type="button" onClick={() => setDraft({ ...draft, sets: draft.sets.filter((_, i) => i !== index) })}>{equipmentSet(code).name} ×</button>)}{!draft.sets.length && <span>未指定</span>}</div>
        <select aria-label="添加套装" value="" onChange={event => { if (event.target.value) setDraft({ ...draft, sets: [...draft.sets, event.target.value] }); }}>
          <option value="">添加套装…</option>{equipmentSets.map(set => <option key={set.code} value={set.code} disabled={pieces + set.pieces > 6}>{set.name}（{set.pieces}件）</option>)}
        </select>
        {pieces > 6 && <p className="snapshot-error" role="alert">套装超过6件，请移除多余套装后保存。</p>}
        {error && <p role="alert">{error}</p>}
        <div className="snapshot-actions"><button type="button" className="ghost-button" disabled={saving} onClick={props.onClose}>取消</button><button type="submit" className="primary-button" disabled={pieces > 6 || saving}>{saving ? '保存中…' : '保存并使用'}</button></div>
      </div>
    </form>
  </div>;
}
