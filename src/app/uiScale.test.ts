import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_SCALE, loadUiScale, saveUiScale, UI_SCALE_STORAGE_KEY } from './uiScale';

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: (key: string) => key === UI_SCALE_STORAGE_KEY ? value : null,
    setItem: (key: string, next: string) => { if (key === UI_SCALE_STORAGE_KEY) value = next; },
  };
}

describe('UI scale preference', () => {
  it('defaults to 80%', () => expect(loadUiScale(memoryStorage())).toBe(DEFAULT_UI_SCALE));
  it('restores a supported value', () => expect(loadUiScale(memoryStorage('0.67'))).toBe(0.67));
  it('ignores unsupported values', () => expect(loadUiScale(memoryStorage('0.42'))).toBe(DEFAULT_UI_SCALE));
  it('persists the selected value', () => {
    const storage = memoryStorage();
    saveUiScale(0.75, storage);
    expect(loadUiScale(storage)).toBe(0.75);
  });
});
