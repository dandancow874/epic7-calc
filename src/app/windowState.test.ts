import { describe, expect, it } from 'vitest';
import { fitWindowState, loadWindowState, saveWindowState, windowWorkAreaForState, type WindowState } from './windowState';

const area = { x: 0, y: 0, width: 1920, height: 1040, scaleFactor: 1 };
const frame = { width: 8, height: 31 };
const state: WindowState = { x: 530, y: 72, width: 1240, height: 850, scaleFactor: 1 };

describe('desktop window preference', () => {
  it('saves and reloads the chosen rectangle', () => {
    let value: string | null = null;
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    expect(loadWindowState(storage)).toBeNull();
    saveWindowState(state, storage);
    expect(loadWindowState(storage)).toEqual(state);
  });

  it.each(['bad json', '{}', 'null', JSON.stringify({ ...state, width: 0 }), JSON.stringify({ ...state, x: '530' }), JSON.stringify({ ...state, scaleFactor: 0 })])('ignores an invalid preference: %s', (value) => {
    expect(loadWindowState({ getItem: () => value })).toBeNull();
  });

  it('restores an unchanged rectangle without docking or resizing it', () => {
    expect(fitWindowState(state, area, frame)).toEqual(state);
  });

  it('keeps a negative-coordinate monitor when it still exists', () => {
    const left = { ...area, x: -1920 };
    const leftState = { ...state, x: -1780 };
    expect(windowWorkAreaForState(leftState, [area, left], area)).toBe(left);
    expect(fitWindowState(leftState, left, frame)).toEqual(leftState);
  });

  it('moves a disconnected screen rectangle back into the current work area', () => {
    const lost = { ...state, x: 3840, y: 2200, width: 2560, height: 1600 };
    const targetArea = windowWorkAreaForState(lost, [area], area);
    const fitted = fitWindowState(lost, targetArea, frame);
    expect(fitted.x).toBeGreaterThanOrEqual(area.x);
    expect(fitted.y).toBeGreaterThanOrEqual(area.y);
    expect(fitted.x + fitted.width + frame.width).toBeLessThanOrEqual(area.width);
    expect(fitted.y + fitted.height + frame.height).toBeLessThanOrEqual(area.height);
  });

  it('preserves logical window dimensions after a DPI change', () => {
    const fitted = fitWindowState(state, { ...area, width: 3840, height: 2080, scaleFactor: 2 }, { width: 16, height: 62 });
    expect(fitted.width).toBe(2480);
    expect(fitted.height).toBe(1700);
  });
});
