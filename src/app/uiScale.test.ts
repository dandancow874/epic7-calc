import { describe, expect, it } from 'vitest';
import { clampUiScale, DEFAULT_UI_SCALE, loadUiScale, saveUiScale, UI_SCALE_STORAGE_KEY } from './uiScale';

function memoryStorage(initial?: string, legacy: Record<string, string> = {}) {
  const values: Record<string, string> = { ...legacy };
  if (initial !== undefined) values[UI_SCALE_STORAGE_KEY] = initial;
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, next: string) => { values[key] = next; },
  };
}

describe('UI scale preference', () => {
  it('defaults to the compact 80% layout', () => {
    expect(loadUiScale(memoryStorage())).toBe(DEFAULT_UI_SCALE);
  });

  it('restores a supported saved scale', () => {
    for (const scale of [0.5, 0.75, 0.83, 1.27, 1.5]) expect(loadUiScale(memoryStorage(String(scale)))).toBe(scale);
  });

  it('ignores unsupported saved values', () => {
    for (const value of ['0.42', '1.51', 'NaN', 'Infinity', 'garbage']) expect(loadUiScale(memoryStorage(value))).toBe(DEFAULT_UI_SCALE);
  });

  it('persists the selected scale', () => {
    const storage = memoryStorage();
    saveUiScale(0.67, storage);
    expect(loadUiScale(storage)).toBe(0.67);
  });

  it('migrates the previously compounded scale exactly once', () => {
    const storage = memoryStorage(undefined, { 'epic7.tools.uiScale.v1': '0.8', 'epic7.damageDesk.uiScale.v1': '1.2' });
    expect(loadUiScale(storage)).toBe(0.96);
    saveUiScale(loadUiScale(storage), storage);
    expect(loadUiScale(storage)).toBe(0.96);
  });

  it('keeps a new saved value independent of legacy calculator zoom', () => {
    expect(loadUiScale(memoryStorage('1.1', { 'epic7.damageDesk.uiScale.v1': '1.4' }))).toBe(1.1);
  });

  it('clamps at 50–150% and rounds to whole percentages', () => {
    expect(clampUiScale(0.2)).toBe(0.5);
    expect(clampUiScale(2)).toBe(1.5);
    expect(clampUiScale(0.80000000001)).toBe(0.8);
    expect(clampUiScale(Number.NaN)).toBe(DEFAULT_UI_SCALE);
  });
});
