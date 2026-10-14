export const WINDOW_STATE_STORAGE_KEY = 'epic7.tools.windowState.v1';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export interface WindowWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export function loadWindowState(storage: Pick<Storage, 'getItem'> = localStorage): WindowState | null {
  try {
    const value = JSON.parse(storage.getItem(WINDOW_STATE_STORAGE_KEY) || 'null');
    if (!value || !['x', 'y', 'width', 'height', 'scaleFactor'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))) return null;
    if (value.width <= 0 || value.height <= 0 || value.scaleFactor < 0.5 || value.scaleFactor > 8) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveWindowState(state: WindowState, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(WINDOW_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function windowWorkAreaForState(state: WindowState, areas: WindowWorkArea[], fallback: WindowWorkArea): WindowWorkArea {
  // Prefer the monitor the window occupied, including monitors left of the
  // primary screen. A disconnected monitor falls back to the current screen.
  let best = fallback;
  let bestOverlap = 0;
  for (const area of areas) {
    const width = Math.max(0, Math.min(state.x + state.width, area.x + area.width) - Math.max(state.x, area.x));
    const height = Math.max(0, Math.min(state.y + state.height, area.y + area.height) - Math.max(state.y, area.y));
    if (width * height > bestOverlap) {
      best = area;
      bestOverlap = width * height;
    }
  }
  return best;
}

export function fitWindowState(state: WindowState, area: WindowWorkArea, frame: { width: number; height: number }): WindowState {
  const ratio = area.scaleFactor / state.scaleFactor;
  const minWidth = Math.min(area.width - frame.width, Math.round(320 * area.scaleFactor));
  const minHeight = Math.min(area.height - frame.height, Math.round(240 * area.scaleFactor));
  const width = Math.max(1, Math.min(area.width - frame.width, Math.max(minWidth, Math.round(state.width * ratio))));
  const height = Math.max(1, Math.min(area.height - frame.height, Math.max(minHeight, Math.round(state.height * ratio))));
  return {
    x: Math.round(Math.max(area.x, Math.min(state.x, area.x + area.width - width - frame.width))),
    y: Math.round(Math.max(area.y, Math.min(state.y, area.y + area.height - height - frame.height))),
    width,
    height,
    scaleFactor: area.scaleFactor,
  };
}
