import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { clampUiScale, UI_SCALE_MAX, UI_SCALE_MIN } from '../../app/uiScale';

export function DisplaySettings({ uiScale, onScaleChange, onClose }: {
  uiScale: number;
  onScaleChange: (scale: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="ui-settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="ui-settings-panel" role="dialog" aria-modal="true" aria-labelledby="ui-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>DISPLAY</span><h2 id="ui-settings-title">界面设置</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭界面设置"><X size={19} /></button>
        </header>
        <UiScaleControl uiScale={uiScale} onScaleChange={onScaleChange} />
        <p>缩放和窗口大小、位置自动保存，下次打开恢复。Ctrl + 0 恢复 100%。</p>
      </section>
    </div>
  );
}

// The portable Windows release embeds this control in its own update dialog.
export function UiScaleControl({ uiScale, onScaleChange }: { uiScale: number; onScaleChange: (scale: number) => void }) {
  const percent = Math.round(uiScale * 100);
  const [draft, setDraft] = useState(String(percent));
  useEffect(() => setDraft(String(percent)), [percent]);
  const commitNumber = () => {
    const next = draft.trim() === '' ? uiScale : clampUiScale(Number(draft) / 100);
    onScaleChange(next);
    setDraft(String(Math.round(next * 100)));
  };
  return (
        <div className="ui-settings-group">
          <div><strong>UI 缩放</strong><small>所有页面即时生效；右键 + 滚轮或 Ctrl + 滚轮调整</small></div>
          <div className="ui-scale-controls">
            <div className="ui-scale-slider">
              <input type="range" aria-label="UI 缩放滑块" min={UI_SCALE_MIN * 100} max={UI_SCALE_MAX * 100} step={1} value={percent} onChange={(event) => onScaleChange(Number(event.target.value) / 100)} />
              <div><span>50%</span><span>150%</span></div>
            </div>
            <label className="ui-scale-number">
              <input type="number" aria-label="UI 缩放百分比" min={UI_SCALE_MIN * 100} max={UI_SCALE_MAX * 100} step={1} value={draft} onChange={(event) => {
                const text = event.target.value;
                setDraft(text);
                const scale = Number(text) / 100;
                if (text !== '' && scale >= UI_SCALE_MIN && scale <= UI_SCALE_MAX) onScaleChange(scale);
              }} onBlur={commitNumber} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
              <span>%</span>
            </label>
          </div>
        </div>
  );
}
