import { useEffect, useState } from 'react';

export function DefenderBarrierRatio(props: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(props.value ? String(props.value) : '');
  useEffect(() => setDraft(props.value ? String(props.value) : ''), [props.value]);
  return <div className="barrier-ratio-input" title="按防守方战斗最大生命值计算防护罩">
    <input aria-label="防护罩比例" type="text" inputMode="decimal" placeholder="比例" value={draft}
      onChange={event => {
        const next = event.target.value;
        if (!/^\d*(\.\d*)?$/.test(next)) return;
        setDraft(next);
        const percent = Number(next);
        if (next && Number.isFinite(percent) && percent <= 1000) props.onChange(percent);
      }}
      onBlur={() => {
        const percent = Math.min(1000, Math.max(0, Number(draft) || 0));
        props.onChange(percent);
        setDraft(percent ? String(percent) : '');
      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    <span>%</span>
  </div>;
}
