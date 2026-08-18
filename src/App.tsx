import { useEffect, useState } from 'react';
import { CalculatorWorkspace } from './CalculatorWorkspace';
import { loadAppPage, saveAppPage, type AppPage } from './app/navigation';
import { PrimaryNav } from './components/app-shell/PrimaryNav';
import { HeroBuildPage } from './pages/builds/HeroBuildPage';
import { rememberCalculatorBuild } from './features/build-presets/calculatorBuildBridge';
import { calculateDockedWindowLayout } from './app/windowLayout';
import './library.css';

export function App() {
  const [page, setPage] = useState<AppPage>(loadAppPage);
  const [buildHeroCode, setBuildHeroCode] = useState<string | null>(() => localStorage.getItem('epic7.tools.buildHero.v1'));

  useEffect(() => {
    dockWindowToTopRight();
  }, []);

  useEffect(() => saveAppPage(page), [page]);

  return (
    <>
      <div className="suite-nav-shell"><PrimaryNav page={page} onNavigate={setPage} /></div>
      {page === 'calculator' && <CalculatorWorkspace />}
      {page === 'builds' && <HeroBuildPage initialHeroCode={buildHeroCode} onUseInCalculator={(side, heroId, presetId) => {
        localStorage.setItem(`epic7.tools.calculatorHero.${side}.v1`, heroId);
        rememberCalculatorBuild(side, heroId, presetId);
        setPage('calculator');
      }} />}
    </>
  );
}

async function dockWindowToTopRight() {
  if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return;
  try {
    const {
      currentMonitor,
      getCurrentWindow,
      PhysicalPosition,
      PhysicalSize,
      primaryMonitor,
    } = await import('@tauri-apps/api/window');
    const monitor = await currentMonitor() ?? await primaryMonitor();
    if (!monitor) return;

    // The work area excludes the taskbar, but setSize() controls only the
    // client area. Measure the native frame so the complete window fits.
    const workArea = monitor.workArea ?? { position: monitor.position, size: monitor.size };
    const appWindow = getCurrentWindow();
    const [innerSize, outerSize] = await Promise.all([appWindow.innerSize(), appWindow.outerSize()]);
    const layout = calculateDockedWindowLayout({
      workX: workArea.position.x,
      workY: workArea.position.y,
      workWidth: workArea.size.width,
      workHeight: workArea.size.height,
      scaleFactor: monitor.scaleFactor || 1,
      frameWidth: outerSize.width - innerSize.width,
      frameHeight: outerSize.height - innerSize.height,
    });

    await appWindow.setMinSize(new PhysicalSize(layout.minWidth, layout.minHeight));
    await appWindow.setSize(new PhysicalSize(layout.innerWidth, layout.innerHeight));
    await appWindow.setPosition(new PhysicalPosition(layout.x, layout.y));
  } catch (error) {
    console.warn('Unable to dock desktop window to the monitor work area', error);
  }
}
