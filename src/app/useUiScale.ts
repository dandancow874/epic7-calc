import { useEffect, useState } from 'react';
import { applyUiScale, clampUiScale, loadUiScale, saveUiScale, UI_SCALE_STEP } from './uiScale';

export function useUiScale() {
  const [uiScale, setUiScale] = useState(loadUiScale);

  useEffect(() => {
    saveUiScale(uiScale);
    void applyUiScale(uiScale).then(() => {
      window.dispatchEvent(new Event('resize'));
    }).catch((error) => console.warn('Unable to apply UI scale', error));
  }, [uiScale]);

  useEffect(() => {
    let rightWheelUsed = false;
    let rightButtonDown = false;
    const handleWheel = (event: WheelEvent) => {
      // Chromium sometimes reports buttons=0 on wheel events even while a
      // mouse button is held, so also track the button's down/up lifecycle.
      const rightButton = rightButtonDown || (event.buttons & 2) !== 0;
      if ((!event.ctrlKey && !rightButton) || event.deltaY === 0) return;
      event.preventDefault();
      if (rightButton) rightWheelUsed = true;
      setUiScale((value) => clampUiScale(value + (event.deltaY < 0 ? UI_SCALE_STEP : -UI_SCALE_STEP)));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !['0', '+', '=', '-'].includes(event.key)) return;
      event.preventDefault();
      setUiScale((value) => event.key === '0' ? 1 : clampUiScale(value + (event.key === '-' ? -UI_SCALE_STEP : UI_SCALE_STEP)));
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        rightButtonDown = true;
        rightWheelUsed = false;
      }
    };
    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 2) rightButtonDown = false;
    };
    const handleBlur = () => {
      rightButtonDown = false;
      rightWheelUsed = false;
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (rightWheelUsed || rightButtonDown) {
        event.preventDefault();
        rightWheelUsed = false;
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return [uiScale, (value: number) => setUiScale(clampUiScale(value))] as const;
}
