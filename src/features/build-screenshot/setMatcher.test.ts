import { describe, expect, it } from 'vitest';
import { matchSetLines } from './setMatcher';
import type { OcrLine } from './types';

const line = (text: string): OcrLine => ({ text, rect: { x: 0, y: 0, width: 100, height: 20 }, words: [] });

describe('screenshot set matcher', () => {
  it('matches active set names and permits unused gear pieces', () => {
    expect(matchSetLines([line('开幕套装'), line('免疫套装'), line('没有套装效果')]).value).toEqual(['set_opener', 'set_immune']);
  });

  it('preserves repeated two-piece sets', () => {
    expect(matchSetLines([line('激流套装'), line('激流套装'), line('激流套装')]).value).toEqual(['set_torrent', 'set_torrent', 'set_torrent']);
  });
});
