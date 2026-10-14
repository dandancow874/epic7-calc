import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WINDOW_STATE_STORAGE_KEY } from './windowState';

const native = vi.hoisted(() => ({
  geometry: { x: 50, y: 40, width: 1100, height: 800, scaleFactor: 1 },
  minimized: false,
  maximized: false,
  handlers: {} as Record<string, () => void>,
  stopped: [] as string[],
  moves: [] as Array<{ x: number; y: number }>,
  sizes: [] as Array<{ width: number; height: number }>,
}));

vi.mock('@tauri-apps/api/window', () => {
  const monitor = { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1040 } }, scaleFactor: 1 };
  const listen = async (name: string, callback: () => void) => {
    native.handlers[name] = callback;
    return () => { native.stopped.push(name); delete native.handlers[name]; };
  };
  const appWindow = {
    innerSize: async () => ({ width: native.geometry.width, height: native.geometry.height }),
    outerSize: async () => ({ width: native.geometry.width + 8, height: native.geometry.height + 31 }),
    outerPosition: async () => ({ x: native.geometry.x, y: native.geometry.y }),
    scaleFactor: async () => native.geometry.scaleFactor,
    isMinimized: async () => native.minimized,
    isMaximized: async () => native.maximized,
    setMinSize: async () => {},
    setSize: async (value: { width: number; height: number }) => { native.sizes.push(value); Object.assign(native.geometry, value); },
    setPosition: async (value: { x: number; y: number }) => { native.moves.push(value); Object.assign(native.geometry, value); },
    onResized: (callback: () => void) => listen('resized', callback),
    onMoved: (callback: () => void) => listen('moved', callback),
    onScaleChanged: (callback: () => void) => listen('scale', callback),
  };
  return {
    getCurrentWindow: () => appWindow,
    currentMonitor: async () => monitor,
    primaryMonitor: async () => monitor,
    availableMonitors: async () => [monitor],
    PhysicalPosition: class { constructor(public x: number, public y: number) {} },
    PhysicalSize: class { constructor(public width: number, public height: number) {} },
  };
});

describe('desktop window lifecycle', () => {
  let values: Record<string, string>;
  beforeEach(() => {
    vi.resetModules();
    values = {};
    vi.stubGlobal('localStorage', { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values[key] = value; } });
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    native.geometry = { x: 50, y: 40, width: 1100, height: 800, scaleFactor: 1 };
    native.handlers = {};
    native.stopped = [];
    native.moves = [];
    native.sizes = [];
    native.minimized = false;
    native.maximized = false;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores saved bounds and tracks later resize and move events', async () => {
    const saved = { x: 100, y: 70, width: 1300, height: 840, scaleFactor: 1 };
    values[WINDOW_STATE_STORAGE_KEY] = JSON.stringify(saved);
    const { initializeDesktopWindow } = await import('./desktopWindow');
    const stop = await initializeDesktopWindow(1.25);
    expect(native.geometry).toEqual(saved);
    Object.assign(native.geometry, { x: 320, width: 1420, height: 900 });
    native.handlers.resized();
    native.handlers.moved();
    await vi.waitFor(() => expect(JSON.parse(values[WINDOW_STATE_STORAGE_KEY])).toEqual(native.geometry));
    stop();
    expect(native.stopped).toEqual(['resized', 'moved', 'scale']);
  });

  it('does not overwrite the normal bounds while minimized or maximized', async () => {
    const { initializeDesktopWindow } = await import('./desktopWindow');
    const stop = await initializeDesktopWindow(0.8);
    const saved = values[WINDOW_STATE_STORAGE_KEY];
    native.minimized = true;
    Object.assign(native.geometry, { x: -32000, y: -32000 });
    native.handlers.moved();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(values[WINDOW_STATE_STORAGE_KEY]).toBe(saved);
    native.minimized = false;
    native.maximized = true;
    Object.assign(native.geometry, { x: 0, y: 0, width: 1912, height: 1009 });
    native.handlers.resized();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(values[WINDOW_STATE_STORAGE_KEY]).toBe(saved);
    stop();
  });

  it('performs only one restore during StrictMode startup', async () => {
    const { initializeDesktopWindow } = await import('./desktopWindow');
    const stops = await Promise.all([initializeDesktopWindow(0.8), initializeDesktopWindow(0.8)]);
    expect(native.sizes).toHaveLength(1);
    expect(native.moves).toHaveLength(1);
    stops.forEach((stop) => stop());
  });

  it('does nothing to native geometry in a browser', async () => {
    vi.stubGlobal('window', {});
    const { initializeDesktopWindow } = await import('./desktopWindow');
    (await initializeDesktopWindow(1))();
    expect(native.moves).toHaveLength(0);
    expect(native.sizes).toHaveLength(0);
  });
});
