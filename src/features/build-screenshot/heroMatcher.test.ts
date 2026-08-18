import { describe, expect, it } from 'vitest';
import type { LibraryHero } from '../../library/types';
import { matchHeroName, matchHeroNameWithRoleFallback } from './heroMatcher';

const heroes = [
  { code: 'genesis-ras', gameId: 'c0001', name: '起源拉斯', nameEn: 'Genesis Ras', nameZht: '起源拉斯', nicknames: ['新拉斯'] },
  { code: 'notos', gameId: 'c0002', name: '诺托斯', nameEn: 'Notos', nameZht: '諾托斯', nicknames: [] },
  { code: 'dragon-bride-senya', gameId: 'c2106', name: '龙之伴侣赛娜', nameEn: 'Dragon Bride Senya', nameZht: '龍之伴侶賽娜', nicknames: [] },
  { code: 'sez', gameId: 'c0003', name: '赛兹', nameEn: 'Sez', nameZht: '賽茲', nicknames: [], role: 'thief' },
] as unknown as LibraryHero[];

describe('screenshot hero matcher', () => {
  it('matches localized names and tolerates one OCR substitution', () => {
    expect(matchHeroName('起源拉斯', heroes).value?.heroCode).toBe('genesis-ras');
    expect(matchHeroName('起源拉期', heroes).alternatives?.[0].value.heroCode).toBe('genesis-ras');
    expect(matchHeroName('Notos', heroes).value?.heroCode).toBe('notos');
  });

  it('accepts a reliable Chinese prefix followed by OCR noise', () => {
    expect(matchHeroName('诺托斯妈妈x纺', heroes).value?.heroCode).toBe('notos');
  });

  it('falls back to the full catalog when the role icon is misclassified', () => {
    expect(matchHeroNameWithRoleFallback('赛兹', heroes, 'mage').value?.heroCode).toBe('sez');
  });
});
