import { useEffect, useState } from 'react';
import { CalculatorWorkspace } from './CalculatorWorkspace';
import { loadAppPage, saveAppPage, type AppPage } from './app/navigation';
import { PrimaryNav } from './components/app-shell/PrimaryNav';
import { HeroBuildPage } from './pages/builds/HeroBuildPage';
import { rememberCalculatorBuild } from './features/build-presets/calculatorBuildBridge';
import { initializeDesktopWindow } from './app/desktopWindow';
import { useUiScale } from './app/useUiScale';
import './library.css';

export function App() {
  const [page, setPage] = useState<AppPage>(loadAppPage);
  const [buildHeroCode, setBuildHeroCode] = useState<string | null>(() => localStorage.getItem('epic7.tools.buildHero.v1'));
  const [uiScale, setUiScale] = useUiScale();

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void initializeDesktopWindow(uiScale).then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    }).catch((error) => console.warn('Unable to restore desktop window', error));
    return () => { cancelled = true; stop?.(); };
  }, []);

  useEffect(() => saveAppPage(page), [page]);

  return (
    <>
      <div className="suite-nav-shell"><PrimaryNav page={page} onNavigate={setPage} uiScale={uiScale} onUiScaleChange={setUiScale} /></div>
      {page === 'calculator' && <CalculatorWorkspace manageUiScale={false} />}
      {page === 'builds' && <HeroBuildPage initialHeroCode={buildHeroCode} onUseInCalculator={(side, heroId, presetId) => {
        localStorage.setItem(`epic7.tools.calculatorHero.${side}.v1`, heroId);
        rememberCalculatorBuild(side, heroId, presetId);
        setPage('calculator');
      }} />}
    </>
  );
}
