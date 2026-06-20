import cn from 'src/assets/i18n/cn.json';
import us from 'src/assets/i18n/us.json';
import aliases from './aliases.json';
import { Artifacts } from 'src/assets/data/artifacts';
import { Heroes } from 'src/assets/data/heroes';
import { SkillIDs } from 'src/assets/data/skill_ids';
import { Hero, HeroClass, HeroElement } from 'src/app/models/hero';
import { Artifact } from 'src/app/models/artifact';
import { readPortableJson, writePortableJson } from './portableData';

type TranslationPack = {
  heroes?: Record<string, string>;
  artifacts?: Record<string, string>;
  nicknames?: Record<string, string>;
  form?: Record<string, string>;
  skills?: Record<string, string | Record<string, string>>;
};

const zh = cn as unknown as TranslationPack;
const en = us as unknown as TranslationPack;
const localAliases = aliases as {
  heroes?: Record<string, string[]>;
  artifacts?: Record<string, string[]>;
};

const HERO_ALIAS_KEY = 'epic7.damageDesk.heroAliases.v1';
const USER_ALIAS_FILE = 'aliases.json';

export type UiLanguage = 'cn' | 'en';

let activeLanguage: UiLanguage = 'cn';
let aliasOverrides: Record<string, string[]> = loadLocalHeroAliasOverrides();

export function setCatalogLanguage(language: UiLanguage) {
  activeLanguage = language;
}

export const heroEntries = Object.entries(Heroes).filter(([, hero]) => hero instanceof Hero);
export const artifactEntries = Object.entries(Artifacts).filter(([, artifact]) => artifact instanceof Artifact);

export function heroName(id: string) {
  if (activeLanguage === 'en') return pack().heroes?.[id] || startCase(id);
  const saved = loadHeroAliasOverrides()[id];
  if (saved?.length) return saved[0];
  return pack().heroes?.[id] || localAliases.heroes?.[id]?.[0] || startCase(id);
}

export function heroNickname(id: string) {
  return [zh.nicknames?.[id], ...heroAliasList(id)].filter(Boolean).join(' ');
}

export function heroAliasText(id: string) {
  return heroAliasList(id).join(',');
}

export function saveHeroAliasText(id: string, text: string) {
  const names = text
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const db = loadHeroAliasOverrides();
  if (names.length) db[id] = names;
  else delete db[id];
  aliasOverrides = db;
  localStorage.setItem(HERO_ALIAS_KEY, JSON.stringify(db));
  void writePortableJson(USER_ALIAS_FILE, { heroes: db });
}

export async function hydrateAliasesFromDisk() {
  const disk = await readPortableJson<{ heroes?: Record<string, string[]> }>(USER_ALIAS_FILE);
  if (!disk?.heroes) {
    await writePortableJson(USER_ALIAS_FILE, { heroes: aliasOverrides });
    return false;
  }
  aliasOverrides = normalizeAliasMap(disk.heroes);
  localStorage.setItem(HERO_ALIAS_KEY, JSON.stringify(aliasOverrides));
  return true;
}

export function artifactName(id: string) {
  return pack().artifacts?.[id] || Artifacts[id]?.id || startCase(id);
}

export function artifactAliases(id: string) {
  return (localAliases.artifacts?.[id] || []).join(' ');
}

export function fieldName(id: string) {
  const custom = pack().skills?.custom;
  return pack().form?.[id] || (typeof custom === 'object' ? custom[id] : '') || startCase(id);
}

export function skillName(skill: string) {
  const clean = skill.replace(/_(soulburn|extra|counter)$/g, '');
  const base = clean.match(/^s[123]$/)?.[0];
  if (base) return base.toUpperCase();
  const direct = pack().skills?.[skill];
  const fallback = pack().skills?.[clean];
  return (typeof direct === 'string' ? direct : '') || (typeof fallback === 'string' ? fallback : '') || clean.toUpperCase();
}

export function skillIcon(heroId: string, skill: string) {
  const base = skill.replace(/_(soulburn|extra|counter)$/g, '');
  const matchingSkill = Object.values(Heroes[heroId]?.skills || {}).find((item) => item.name === base || item.id === base);
  const id = SkillIDs[heroId]?.[base]
    || (matchingSkill ? SkillIDs[heroId]?.[matchingSkill.id] : '')
    || (matchingSkill ? SkillIDs[heroId]?.[matchingSkill.id.replace(/_.+$/, '')] : '')
    || SkillIDs[heroId]?.[base.replace(/_.+$/, '')]
    || base;
  return `/assets/skills/${id}.png`;
}

export function isArtifactAllowed(artifact: Artifact, heroId: string, heroClass: HeroClass) {
  if (!artifact.id || artifact.id === 'noProc') return true;
  if (artifact.heroExclusive?.length && !artifact.heroExclusive.includes(heroId)) return false;
  return artifact.exclusive === HeroClass.common || artifact.exclusive === heroClass;
}

export function advantageousElement(attacker: HeroElement, defender: HeroElement) {
  return counterElement(attacker) === defender;
}

export function counterElement(attacker: HeroElement) {
  const map: Record<HeroElement, HeroElement> = {
    [HeroElement.fire]: HeroElement.earth,
    [HeroElement.ice]: HeroElement.fire,
    [HeroElement.earth]: HeroElement.ice,
    [HeroElement.dark]: HeroElement.light,
    [HeroElement.light]: HeroElement.dark,
  };
  return map[attacker];
}

function startCase(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pack() {
  return activeLanguage === 'en' ? en : zh;
}

function heroAliasList(id: string) {
  const saved = loadHeroAliasOverrides()[id];
  if (saved?.length) return saved;
  return localAliases.heroes?.[id] || [];
}

function loadHeroAliasOverrides(): Record<string, string[]> {
  return aliasOverrides;
}

function loadLocalHeroAliasOverrides(): Record<string, string[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const value = JSON.parse(localStorage.getItem(HERO_ALIAS_KEY) || '{}');
    return normalizeAliasMap(value);
  } catch {
    return {};
  }
}

function normalizeAliasMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, names]) => [
        key,
        Array.isArray(names) ? names.map(String).map((name) => name.trim()).filter(Boolean) : [],
      ])
      .filter(([, names]) => names.length),
  );
}
