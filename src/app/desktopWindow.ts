import { calculateDockedWindowLayout } from './windowLayout';
import { fitWindowState, loadWindowState, saveWindowState, windowWorkAreaForState, type WindowWorkArea } from './windowState';
import type { Monitor, Window as DesktopWindow } from '@tauri-apps/api/window';

let restored: Promise<DesktopWindow | undefined> | undefined;

function workArea(monitor: Monitor): WindowWorkArea {
  const area = monitor.workArea ?? { position: monitor.position, size: monitor.size };
  return { x: area.position.x, y: area.position.y, width: area.size.width, height: area.size.height, scaleFactor: monitor.scaleFactor || 1 };
}

async function restoreDesktopWindow(uiScale: number) {
  const { availableMonitors, currentMonitor, primaryMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/window');
  const monitor = await currentMonitor() ?? await primaryMonitor();
  if (!monitor) return;
  const appWindow = getCurrentWindow();
  const [innerSize, outerSize, monitors] = await Promise.all([appWindow.innerSize(), appWindow.outerSize(), availableMonitors()]);
  const saved = loadWindowState();
  const area = saved ? windowWorkAreaForState(saved, monitors.map(workArea), workArea(monitor)) : workArea(monitor);
  const frameScale = area.scaleFactor / (monitor.scaleFactor || 1);
  const frame = { width: Math.max(0, Math.round((outerSize.width - innerSize.width) * frameScale)), height: Math.max(0, Math.round((outerSize.height - innerSize.height) * frameScale)) };
  const state = saved ? fitWindowState(saved, area, frame) : (() => {
    const layout = calculateDockedWindowLayout({
      workX: area.x, workY: area.y, workWidth: area.width, workHeight: area.height,
      scaleFactor: area.scaleFactor, frameWidth: frame.width, frameHeight: frame.height, uiScale,
    });
    return { x: layout.x, y: layout.y, width: layout.innerWidth, height: layout.innerHeight, scaleFactor: area.scaleFactor };
  })();

  // Allow a compact window at 50% zoom; native minimums are independent of
  // the selected page and never force a saved window back to its default size.
  await appWindow.setMinSize(new PhysicalSize(Math.min(state.width, Math.round(320 * area.scaleFactor)), Math.min(state.height, Math.round(240 * area.scaleFactor))));
  await appWindow.setPosition(new PhysicalPosition(state.x, state.y));
  // Moving to another monitor can cause Windows to resize for its DPI.
  // Set the final client size after that move, avoiding a second DPI scale.
  await appWindow.setSize(new PhysicalSize(state.width, state.height));
  return appWindow;
}

export async function initializeDesktopWindow(uiScale: number): Promise<() => void> {
  if (!('__TAURI_INTERNALS__' in window)) return () => {};
  // React StrictMode can mount twice while the asynchronous restore is still
  // running. Restore once, before either mount begins observing geometry.
  const appWindow = await (restored ??= restoreDesktopWindow(uiScale));
  if (!appWindow) return () => {};
  let disposed = false;
  let sequence = 0;
  const capture = async () => {
    const request = ++sequence;
    try {
      const [minimized, maximized, size, position, scaleFactor] = await Promise.all([
        appWindow.isMinimized(), appWindow.isMaximized(), appWindow.innerSize(), appWindow.outerPosition(), appWindow.scaleFactor(),
      ]);
      // Keep the last normal rectangle: minimizing must not replace it with
      // Windows' off-screen coordinates, nor maximizing with the screen size.
      if (disposed || request !== sequence || minimized || maximized || size.width <= 0 || size.height <= 0) return;
      saveWindowState({ x: position.x, y: position.y, width: size.width, height: size.height, scaleFactor });
    } catch (error) {
      console.warn('Unable to save desktop window size', error);
    }
  };
  const unlisten: Array<() => void> = [];
  try {
    unlisten.push(await appWindow.onResized(() => { void capture(); }));
    unlisten.push(await appWindow.onMoved(() => { void capture(); }));
    unlisten.push(await appWindow.onScaleChanged(() => { void capture(); }));
    await capture();
  } catch (error) {
    unlisten.forEach((stop) => stop());
    throw error;
  }
  return () => {
    disposed = true;
    unlisten.forEach((stop) => stop());
  };
}
