import { Heroes } from 'src/assets/data/heroes';
import { readPortableJson, writePortableJson } from './portableData';
import { buildOwnedProfileFields, defenderManualProfileFields, withoutBuildPresetValues } from '../features/build-presets/calculatorBuildBridge';

export type Side = 'attacker' | 'defender';
export type ProfileValues = Record<string, number | boolean | string | null>;
export type ProfileSummary = {
  index: number;
  name: string;
  active: boolean;
};

const KEY = 'epic7.damageDesk.profiles.v1';
const FILE_NAME = 'profiles.json';
export const PROFILE_NAME_KEY = '__profileName';

type ActiveProfileDb = Record<Side, Record<string, number>>;
type ProfileDb = {
  attacker: Record<string, ProfileValues[]>;
  defender: Record<string, ProfileValues[]>;
  active: ActiveProfileDb;
};

const defaults: ProfileDb = {
  attacker: {},
  defender: {},
  active: {
    attacker: {},
    defender: {},
  },
};

let cachedDb: ProfileDb = readLocalDb();

export function loadProfile(side: Side, heroId: string): ProfileValues {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  const index = getActiveIndex(db, side, heroId);
  return withDefaults(side, heroId, profiles[index] || profiles[0]);
}

export function listProfiles(side: Side, heroId: string): ProfileSummary[] {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  const active = getActiveIndex(db, side, heroId);
  return profiles.map((profile, index) => ({
    index,
    name: profileName(profile, index),
    active: index === active,
  }));
}

export async function selectProfile(side: Side, heroId: string, index: number): Promise<ProfileValues> {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  const nextIndex = clampIndex(index, profiles.length);
  db.active[side][heroId] = nextIndex;
  await profileStore.write(db);
  return withDefaults(side, heroId, profiles[nextIndex]);
}

export async function createProfile(side: Side, heroId: string, values: ProfileValues, name?: string): Promise<ProfileValues> {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  const nextName = cleanName(name) || `配置 ${profiles.length + 1}`;
  const nextProfile = stripProfileMeta(side, values);
  nextProfile[PROFILE_NAME_KEY] = nextName;
  profiles.push(nextProfile);
  db.active[side][heroId] = profiles.length - 1;
  await profileStore.write(db);
  return withDefaults(side, heroId, nextProfile);
}

export async function renameProfile(side: Side, heroId: string, index: number, name: string) {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  const target = profiles[clampIndex(index, profiles.length)];
  target[PROFILE_NAME_KEY] = cleanName(name) || profileName(target, index);
  await profileStore.write(db);
}

export async function deleteProfile(side: Side, heroId: string, index: number): Promise<ProfileValues> {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  if (profiles.length <= 1) {
    profiles[0] = defaultValues(side, heroId);
    profiles[0][PROFILE_NAME_KEY] = '默认';
    db.active[side][heroId] = 0;
    await profileStore.write(db);
    return withDefaults(side, heroId, profiles[0]);
  }
  const removedIndex = clampIndex(index, profiles.length);
  profiles.splice(removedIndex, 1);
  const active = getActiveIndex(db, side, heroId);
  db.active[side][heroId] = active > removedIndex ? active - 1 : clampIndex(active, profiles.length);
  await profileStore.write(db);
  return withDefaults(side, heroId, profiles[db.active[side][heroId]]);
}

export async function saveProfile(side: Side, heroId: string, values: ProfileValues) {
  const db = loadDb();
  const profiles = ensureProfiles(db, side, heroId);
  const index = getActiveIndex(db, side, heroId);
  const previous = profiles[index] || profiles[0] || {};
  const next = stripProfileMeta(side, values, previous);
  next[PROFILE_NAME_KEY] = profileName(previous, index);
  profiles[index] = next;
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
  await writePortableJson(FILE_NAME, cachedDb);
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
    attacker: normalizeSideDb(db.attacker || {}),
    defender: normalizeSideDb(db.defender || {}),
    active: {
      attacker: { ...(db.active?.attacker || {}) },
      defender: { ...(db.active?.defender || {}) },
    },
  };
}

function normalizeSideDb(sideDb: Record<string, ProfileValues[] | ProfileValues>): Record<string, ProfileValues[]> {
  return Object.fromEntries(
    Object.entries(sideDb).map(([heroId, value]) => {
      const profiles = (Array.isArray(value) ? value : [value]).map((profile) => ({ ...profile, [PROFILE_NAME_KEY]: profile[PROFILE_NAME_KEY] }));
      return [heroId, profiles.length ? profiles : []];
    }),
  );
}

function ensureProfiles(db: ProfileDb, side: Side, heroId: string): ProfileValues[] {
  db[side] ??= {};
  db.active ??= { attacker: {}, defender: {} };
  db.active[side] ??= {};
  if (!db[side][heroId]?.length) {
    const first = defaultValues(side, heroId);
    first[PROFILE_NAME_KEY] = '默认';
    db[side][heroId] = [first];
  }
  const profiles = db[side][heroId];
  profiles.forEach((profile, index) => {
    profile[PROFILE_NAME_KEY] = profileName(profile, index);
  });
  db.active[side][heroId] = clampIndex(db.active[side][heroId] ?? 0, profiles.length);
  return profiles;
}

function getActiveIndex(db: ProfileDb, side: Side, heroId: string) {
  const profiles = db[side]?.[heroId] || [];
  return clampIndex(db.active?.[side]?.[heroId] ?? 0, profiles.length || 1);
}

function clampIndex(index: number, length: number) {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), Math.max(0, length - 1));
}

function profileName(profile: ProfileValues, index: number) {
  const name = typeof profile[PROFILE_NAME_KEY] === 'string' ? profile[PROFILE_NAME_KEY] : '';
  return cleanName(name) || (index === 0 ? '默认' : `配置 ${index + 1}`);
}

function cleanName(name: unknown) {
  return typeof name === 'string' ? name.trim().slice(0, 24) : '';
}

function stripProfileMeta(side: Side, values: ProfileValues, previous: ProfileValues = {}): ProfileValues {
  const next = profileOwnedValues(side, values, previous);
  delete next[PROFILE_NAME_KEY];
  return next;
}

function profileOwnedValues(side: Side, values: ProfileValues, previous: ProfileValues) {
  // With the equipment preset disabled, these fields are manual calculator
  // values and must remain part of the calculator profile.
  if (values.useBuildPreset === false) return { ...values };
  const next = withoutBuildPresetValues(values);
  const fields = side === 'attacker' ? buildOwnedProfileFields : defenderManualProfileFields;
  for (const key of fields) {
    delete next[key];
    if (previous[key] !== undefined) next[key] = previous[key];
  }
  return next;
}

function withDefaults(side: Side, heroId: string, profile: ProfileValues): ProfileValues {
  return { ...defaultValues(side, heroId), ...profile };
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
      useBuildPreset: true,
      useDefenderPresetValues: true,
      artifactId: 'noProc',
      artifactLevel: 30,
      molagoras1: hero.skills.s1?.enhance.length || 0,
      molagoras2: hero.skills.s2?.enhance.length || 0,
      molagoras3: hero.skills.s3?.enhance.length || 0,
    };
  }

  return {
    useBuildPreset: true,
    targetAttack: hero.baseAttack || 1000,
    targetDefense: hero.baseDefense || 1000,
    targetMaxHP: hero.baseHP || 10000,
    targetCurrentHP: hero.baseHP || 10000,
    targetCurrentHPPercent: 100,
    targetBarrier: 0,
    targetSpeed: 150,
    defenderArtifactCode: '',
    defenderArtifactLevel: 30,
    targetMaxHPIncrease: 0,
    targetDefenseIncrease: 0,
    targetLingeringFragranceStack: 0,
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
