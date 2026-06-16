import type { Side } from './profiles';

const HERO_RECENTS_KEY = 'epic7.damageDesk.recentHeroes.v2';
const LIMIT = 10;

type RecentDb = Record<Side, string[]>;

export function loadRecentHeroes(side: Side): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(HERO_RECENTS_KEY) || '{}') as Partial<RecentDb>;
    const list = data[side] || [];
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function rememberHero(side: Side, heroId: string) {
  const db = loadDb();
  const next = [heroId, ...loadRecentHeroes(side).filter((id) => id !== heroId)].slice(0, LIMIT);
  db[side] = next;
  localStorage.setItem(HERO_RECENTS_KEY, JSON.stringify(db));
  return next;
}

function loadDb(): RecentDb {
  try {
    const data = JSON.parse(localStorage.getItem(HERO_RECENTS_KEY) || '{}') as Partial<RecentDb>;
    return {
      attacker: data.attacker || [],
      defender: data.defender || [],
    };
  } catch {
    return { attacker: [], defender: [] };
  }
}
