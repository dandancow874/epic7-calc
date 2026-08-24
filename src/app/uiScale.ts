export const UI_SCALE_STORAGE_KEY = 'epic7.tools.uiScale.v1';

export const UI_SCALE_OPTIONS = [1, 0.9, 0.8, 0.75, 0.67] as const;
export type UiScale = (typeof UI_SCALE_OPTIONS)[number];

export const DEFAULT_UI_SCALE: UiScale = 0.8;

export function loadUiScale(storage: Pick<Storage, 'getItem'> = localStorage): UiScale {
  const stored = Number(storage.getItem(UI_SCALE_STORAGE_KEY));
  return UI_SCALE_OPTIONS.includes(stored as UiScale) ? stored as UiScale : DEFAULT_UI_SCALE;
}

export function saveUiScale(scale: UiScale, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(UI_SCALE_STORAGE_KEY, String(scale));
}

export async function applyUiScale(scale: UiScale) {
  const root = document.documentElement;
  const isTauri = '__TAURI_INTERNALS__' in window;
  root.style.removeProperty('zoom');
  if (isTauri) {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().setZoom(scale);
  } else {
    root.style.setProperty('zoom', String(scale));
  }
}
