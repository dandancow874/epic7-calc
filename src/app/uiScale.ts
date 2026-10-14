export const UI_SCALE_STORAGE_KEY = 'epic7.tools.uiScale.v2';
export const UI_SCALE_MIN = 0.5;
export const UI_SCALE_MAX = 1.5;
export const UI_SCALE_STEP = 0.05;

export type UiScale = number;

export const DEFAULT_UI_SCALE: UiScale = 0.8;

export function loadUiScale(storage: Pick<Storage, 'getItem'> = localStorage): UiScale {
  const stored = Number(storage.getItem(UI_SCALE_STORAGE_KEY));
  if (validScale(stored)) return clampUiScale(stored);

  // Previously the calculator's body zoom multiplied the app/WebView zoom.
  // Migrate the visible scale once so the new single control preserves it.
  const appScale = Number(storage.getItem('epic7.tools.uiScale.v1'));
  const calculatorScale = Number(storage.getItem('epic7.damageDesk.uiScale.v1'));
  return clampUiScale((validScale(appScale) ? appScale : DEFAULT_UI_SCALE)
    * (calculatorScale >= 0.8 && calculatorScale <= 1.4 ? calculatorScale : 1));
}

export function saveUiScale(scale: UiScale, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(UI_SCALE_STORAGE_KEY, String(clampUiScale(scale)));
}

function validScale(value: number) {
  return Number.isFinite(value) && value >= UI_SCALE_MIN && value <= UI_SCALE_MAX;
}

export function clampUiScale(value: number): UiScale {
  return Math.round(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number.isFinite(value) ? value : DEFAULT_UI_SCALE)) * 100) / 100;
}

export async function applyUiScale(scale: UiScale) {
  const root = document.documentElement;
  const isTauri = '__TAURI_INTERNALS__' in window;
  document.body.style.removeProperty('zoom');

  // CSS zoom is the browser/dev fallback. The desktop build uses WebView zoom,
  // which reflows the viewport as it scales fonts, images, icons and controls.
  root.style.removeProperty('zoom');
  if (isTauri) {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().setZoom(scale);
  } else {
    root.style.setProperty('zoom', String(scale));
  }
}
