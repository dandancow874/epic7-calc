import { Heroes } from 'src/assets/data/heroes';
import { readPortableJson, writePortableJson } from './portableData';

export type Side = 'attacker' | 'defender';

export type ProfileValues = Record<string, number | boolean | string | null>;

const KEY = 'epic7.damageDesk.profiles.v1';
const FILE_NAME = 'profiles.json';

type ProfileDb = Record<Side, Record<string, ProfileValues[]>>;

const defaults: ProfileDb = {
  attacker: {},
  defender: {},
};

let cachedDb: ProfileDb = readLocalDb();

export function loadProfile(side: Side, heroId: string): ProfileValues {
  const db = loadDb();
  const first = db[side]?.[heroId]?.[0];
  return first ? { ...defaultValues(side, heroId), ...first } : defaultValues(side, heroId);
}

export async function saveProfile(side: Side, heroId: string, values: ProfileValues) {
  const db = loadDb();
  db[side] ??= {};
  db[side][heroId] = [{ ...values }];
  await profileStore.write(db);
}

export async function exportProfiles() {
  return JSON.stringify(loadDb(), null, 2);
}

export async function hydrateProfilesFromDisk() {
  const disk = await readPortableJson<Partial<ProfileDb>>(FILE_NAME);
  if (!disk) {
    await writePortableJson(FILE_NAME, cachedDb);
    return false;
  }
  cachedDb = mergeDb(disk);
  localStorage.setItem(KEY, JSON.stringify(cachedDb));
  return true;
}

function loadDb(): ProfileDb {
  return cachedDb;
}

const profileStore = {
  read(): Partial<ProfileDb> {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  },
  async write(db: ProfileDb) {
    cachedDb = db;
    localStorage.setItem(KEY, JSON.stringify(db));
    await writePortableJson(FILE_NAME, db);
  },
};

function readLocalDb(): ProfileDb {
  try {
    return mergeDb(profileStore.read());
  } catch {
    return mergeDb({});
  }
}

function mergeDb(db: Partial<ProfileDb>): ProfileDb {
  return {
    attacker: { ...(db.attacker || {}) },
    defender: { ...(db.defender || {}) },
  };
}

function defaultValues(side: Side, heroId: string): ProfileValues {
  const hero = Heroes[heroId] ?? Heroes.abigail;
  if (side === 'attacker') {
    return {
      attack: 2500,
      critDamage: 250,
      damageIncrease: 0,
      attackIncreasePercent: 0,
      attackIncrease: 0,
      casterSpeed: 150,
      casterMaxHP: 10000,
      casterDefense: 750,
      elementalAdvantage: false,
      attackUp: false,
      attackUpGreat: false,
      decreasedAttack: false,
      increasedCritDamage: false,
      casterVigor: false,
      rageSet: false,
      fervorSet: false,
      penetrationSet: false,
      torrentSetStack: 0,
      pursuitSet: false,
      artifactId: 'noProc',
      artifactLevel: 30,
      molagoras1: hero.skills.s1?.enhance.length || 0,
      molagoras2: hero.skills.s2?.enhance.length || 0,
      molagoras3: hero.skills.s3?.enhance.length || 0,
    };
  }

  return {
    targetDefense: hero.baseDefense || 1000,
    targetMaxHP: hero.baseHP || 10000,
    targetCurrentHP: hero.baseHP || 10000,
    targetCurrentHPPercent: 100,
    targetSpeed: 150,
    damageReduction: 0,
    additionalDamageReduction: 0,
    damageTransfer: 0,
    penetrationResistance: 0,
    targetDefenseUp: false,
    targetDefenseDown: false,
    targetVigor: false,
    targetTargeted: false,
    targetLaceration: false,
    targetPilfered: false,
    targetHasTrauma: false,
    targetFractured: false,
    targetFractureStack: 0,
    targetMagicNailed: false,
    targetRuptured: false,
  };
}
