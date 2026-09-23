import { describe, expect, it } from 'vitest';
import { latestChangedHeroIds, sortLatestChangedHeroesFirst } from './latestChangedHeroes';

describe('latest changed hero ordering', () => {
  it('puts Renoa and Haru at the front of All Heroes', () => {
    expect(latestChangedHeroIds.slice(0, 2)).toEqual(['renoa', 'haru']);
  });

  it('puts recent additions and balance changes before unchanged heroes', () => {
    const sorted = sortLatestChangedHeroesFirst([
      ['abigail', 1],
      ['renoa', 2],
      ['aube', 3],
      ['krau', 4],
      ['haru', 5],
    ]);

    expect(sorted.map(([id]) => id)).toEqual(['renoa', 'haru', 'aube', 'abigail', 'krau']);
  });

  it('keeps unchanged heroes stable and excludes old snapshots from the priority list', () => {
    expect(sortLatestChangedHeroesFirst([
      ['krau', 1],
      ['urban_shadow_choux_old', 2],
      ['abigail', 3],
    ]).map(([id]) => id)).toEqual(['krau', 'urban_shadow_choux_old', 'abigail']);
    expect(latestChangedHeroIds.some((id) => id.endsWith('_old'))).toBe(false);
  });
});
