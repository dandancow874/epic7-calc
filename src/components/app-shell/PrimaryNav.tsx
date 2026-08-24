import { Calculator, Check, Download, FlaskConical, RefreshCw, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppPage } from '../../app/navigation';
import { UI_SCALE_OPTIONS, type UiScale } from '../../app/uiScale';
import { checkPortableUpdate, initialPortableUpdateState, startPortableUpdate, type PortableUpdateState } from '../../data/portableUpdater';

type Props = {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  uiScale: UiScale;
  onUiScaleChange: (scale: UiScale) => void;
};

const items: Array<{ page: AppPage; label: string; icon: typeof Calculator }> = [
  { page: 'calculator', label: '伤害计算', icon: Calculator },
  { page: 'builds', label: '角色装备', icon: Shield },
];

export function PrimaryNav({ page, onNavigate, uiScale, onUiScaleChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scaleRestartRequired, setScaleRestartRequired] = useState(false);
  const [updateState, setUpdateState] = useState<PortableUpdateState>(() => initialPortableUpdateState());

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [settingsOpen]);

  const handleUpdate = async () => {
    if (updateState.status === 'checking' || updateState.status === 'updating') return;
    if (updateState.status === 'available') {
      const size = formatBytes(updateState.downloadSize);
      const confirmed = window.confirm(`发现新版本 ${updateState.latestVersion}${size ? `（${size}）` : ''}\n\n现在下载并安装吗？程序将在完成后自动重启。`);
      if (!confirmed) return;
      setUpdateState((state) => ({ ...state, status: 'updating', message: '准备下载更新' }));
      try {
        setUpdateState(await startPortableUpdate(updateState));
      } catch (error) {
        setUpdateState((state) => ({ ...state, status: 'error', message: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    setUpdateState((state) => ({ ...state, status: 'checking', message: '正在检查更新' }));
    setUpdateState(await checkPortableUpdate());
  };

  return (
    <>
      <nav className="primary-nav" aria-label="Epic7 Damage Calc 主导航">
        <button type="button" className="primary-nav__mark" onClick={() => setSettingsOpen(true)} title="界面设置与更新" aria-label="打开界面设置与更新">
          <FlaskConical size={18} />
        </button>
        <div className="primary-nav__items">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.page} type="button" className={page === item.page ? 'active' : ''} title={item.label} onClick={() => onNavigate(item.page)}>
                <Icon size={17} /><span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {settingsOpen && (
        <div className="ui-settings-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="ui-settings-panel" role="dialog" aria-modal="true" aria-labelledby="ui-settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>DISPLAY & UPDATE</span><h2 id="ui-settings-title">界面设置</h2></div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="关闭界面设置"><X size={19} /></button>
            </header>

            <div className="ui-settings-group">
              <div><strong>UI 缩放</strong><small>字体、图片、图标、控件和窗口宽度一起缩放</small></div>
              <div className="ui-scale-options">
                {UI_SCALE_OPTIONS.map((scale) => (
                  <button type="button" key={scale} className={uiScale === scale ? 'active' : ''} onClick={() => {
                    if (scale === uiScale) return;
                    onUiScaleChange(scale);
                    setScaleRestartRequired(true);
                  }}>
                    {uiScale === scale && <Check size={15} />}{Math.round(scale * 100)}%
                  </button>
                ))}
              </div>
              {scaleRestartRequired && <div className="ui-settings-notice"><strong>缩放设置已保存</strong><span>请关闭并重新打开程序后生效。</span></div>}
            </div>

            <div className="ui-update-group">
              <div className="ui-update-copy">
                <strong>程序更新</strong>
                <span>当前版本 {updateState.currentVersion}{updateState.latestVersion ? ` · 最新 ${updateState.latestVersion}` : ''}</span>
                <small className={updateState.status}>{updateMessage(updateState)}</small>
              </div>
              <button type="button" className={`ui-update-action ${updateState.status}`} disabled={updateState.status === 'checking' || updateState.status === 'updating'} onClick={handleUpdate}>
                {updateState.status === 'available' ? <Download size={17} /> : <RefreshCw size={17} />}
                {updateButtonLabel(updateState)}
              </button>
            </div>

            <p>设置与更新均由你确认后执行。</p>
          </section>
        </div>
      )}
    </>
  );
}

function updateButtonLabel(state: PortableUpdateState) {
  if (state.status === 'checking') return '检查中…';
  if (state.status === 'available') return '下载并安装';
  if (state.status === 'updating') return '下载中…';
  return '检查更新';
}

function updateMessage(state: PortableUpdateState) {
  if (state.status === 'available') {
    const size = formatBytes(state.downloadSize);
    return `发现新版本 ${state.latestVersion}${size ? `，下载包 ${size}` : ''}`;
  }
  return state.message || '点击按钮检查 GitHub Release';
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
