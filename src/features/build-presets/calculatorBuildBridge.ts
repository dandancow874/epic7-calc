import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import cn from '../../assets/i18n/cn.json';
import type { ProfileValues, Side } from '../../data/profiles';
import { loadLibraryArtifacts, loadLibraryHeroes } from '../../library/libraryRepository';
import type { LibraryArtifact, LibraryHero } from '../../library/types';
import { hydrateBuildPresetsFromDisk, listBuildPresets } from './buildPresetStore';
import { loadCommunityBuildPresets } from './communityPresetRepository';
import { targetStatsAfterArtifactChange } from './buildScore';
import type { BuildPreset } from './types';

export type CalculatorBuildCatalog = {
  heroes: LibraryHero[];
  artifacts: LibraryArtifact[];
  community: BuildPreset[];
};

const LAST_BUILD_KEY = 'epic7.tools.calculatorLastBuild.v1';
const legacyHeroCodes: Record<string, string> = {
  ainos_2_0: 'ainos-20',
  archdemon_shadow: 'archdemons-shadow',
  baal_and_sezan: 'baal-sezan',
  charlotte_old: 'charlotte',
  elphelt_valentine: 'elphelt',
  kanna: 'bomb-model-kanna',
  kise_old: 'kise',
  lethe_old: 'lethe',
  lone_crescent_bellona_old: 'lone-crescent-bellona',
  mighty_scout: 'mighty-scout',
  righteous_thief_roozid_old: 'righteous-thief-roozid',
  sage_baal_and_sezan: 'sage-baal-sezan',
  summer_disciple_alexa: 'summers-disciple-alexa',
  top_model_luluca_old: 'top-model-luluca',
  vildred_old: 'vildred',
  zeno_old: 'zeno',
};

export const buildOwnedProfileFields = new Set([
  'attack', 'critDamage', 'casterSpeed', 'casterMaxHP', 'casterDefense',
  'artifactId', 'artifactLevel',
  'defenderArtifactCode', 'defenderArtifactLevel',
]);
export const defenderManualProfileFields = new Set([
  'targetAttack', 'targetDefense', 'targetMaxHP', 'targetCurrentHP', 'targetSpeed',
  'defenderArtifactCode', 'defenderArtifactLevel',
]);

export async function loadCalculatorBuildCatalog(): Promise<CalculatorBuildCatalog> {
  const [heroes, artifacts, community] = await Promise.all([
    loadLibraryHeroes(), loadLibraryArtifacts(), loadCommunityBuildPresets(), hydrateBuildPresetsFromDisk(),
  ]);
  return { heroes, artifacts, community };
}

export function calculatorBuildOptions(heroId: string, catalog: CalculatorBuildCatalog | null): BuildPreset[] {
  if (!catalog) return [];
  const heroCode = calculatorHeroCode(heroId, catalog.heroes);
  if (!heroCode) return [];
  const community = catalog.community.find((preset) => preset.heroCode === heroCode) || null;
  return listBuildPresets(heroCode, community);
}

export function defaultCalculatorBuild(side: Side, heroId: string, options: BuildPreset[]) {
  const remembered = readLastBuilds()[`${side}:${heroId}`];
  const selected = options.find((preset) => preset.id === remembered);
  if (selected) return selected;
  const recentlyEdited = options.filter((preset) => preset.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return recentlyEdited || options.find((preset) => preset.source === 'community') || options[0] || null;
}

export function rememberCalculatorBuild(side: Side, heroId: string, presetId: string) {
  const values = readLastBuilds();
  values[`${side}:${heroId}`] = presetId;
  localStorage.setItem(LAST_BUILD_KEY, JSON.stringify(values));
}

export function applyBuildToCalculator(side: Side, preset: BuildPreset, catalog: CalculatorBuildCatalog, current: ProfileValues) {
  const stats = preset.targetStats;
  if (side === 'attacker') {
    const artifactId = calculatorArtifactId(preset, catalog.artifacts);
    return {
      values: {
        ...current,
        attack: stats.atk,
        critDamage: stats.chd,
        casterSpeed: stats.spd,
        casterMaxHP: stats.hp,
        casterDefense: stats.def,
        artifactId,
        artifactLevel: preset.artifactLevel ?? 30,
      },
      artifactId,
    };
  }

  return {
    values: {
      ...current,
      targetAttack: stats.atk,
      targetDefense: stats.def,
      targetMaxHP: stats.hp,
      targetCurrentHP: stats.hp,
      targetSpeed: stats.spd,
      defenderArtifactCode: preset.artifactCode || '',
      defenderArtifactLevel: preset.artifactLevel ?? 30,
    },
    artifactId: preset.artifactCode || null,
  };
}

export function withoutBuildPresetValues(values: ProfileValues) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !buildOwnedProfileFields.has(key)));
}

export function restoreManualBuildValues(side: Side, current: ProfileValues, stored: ProfileValues) {
  const restored = { ...current };
  const fields = side === 'attacker' ? buildOwnedProfileFields : defenderManualProfileFields;
  for (const key of fields) {
    if (stored[key] !== undefined) restored[key] = stored[key];
  }
  return restored;
}

export function calculatorHeroCode(heroId: string, heroes: LibraryHero[]) {
  const expected = legacyHeroCodes[heroId] || heroId.replaceAll('_', '-');
  return heroes.some((hero) => hero.code === expected) ? expected : null;
}

export function calculatorHeroIdForLibraryCode(heroCode: string) {
  return Object.keys(Heroes).find((heroId) => (legacyHeroCodes[heroId] || heroId.replaceAll('_', '-')) === heroCode) || null;
}

export function withCalculatorStat(preset: BuildPreset, side: Side, key: string, value: number, artifacts: LibraryArtifact[] = []) {
  if ((side === 'attacker' && key === 'artifactLevel') || (side === 'defender' && key === 'defenderArtifactLevel')) {
    const artifact = artifacts.find((item) => item.code === preset.artifactCode) || null;
    return {
      ...preset,
      artifactLevel: value,
      targetStats: targetStatsAfterArtifactChange(preset.targetStats, artifact, preset.artifactLevel ?? 30, artifact, value),
    };
  }
  const statKey = side === 'attacker'
    ? ({ attack: 'atk', critDamage: 'chd', casterSpeed: 'spd', casterMaxHP: 'hp', casterDefense: 'def' } as const)[key as 'attack']
    : ({ targetAttack: 'atk', targetDefense: 'def', targetMaxHP: 'hp', targetSpeed: 'spd' } as const)[key as 'targetDefense'];
  if (!statKey) return preset;
  return { ...preset, targetStats: { ...preset.targetStats, [statKey]: value } };
}

export function withCalculatorArtifact(preset: BuildPreset, artifactId: string, level: number, artifacts: LibraryArtifact[]) {
  const previousArtifact = artifacts.find((artifact) => artifact.code === preset.artifactCode) || null;
  if (!artifactId || artifactId === 'noProc') {
    return {
      ...preset,
      artifactCode: null,
      artifactName: null,
      artifactLevel: level,
      targetStats: targetStatsAfterArtifactChange(preset.targetStats, previousArtifact, preset.artifactLevel ?? 30, null, level),
    };
  }
  const source = libraryArtifactForCalculatorId(artifactId, artifacts);
  return {
    ...preset,
    artifactCode: source?.code || artifactId.replaceAll('_', '-'),
    artifactName: source?.nameEn || source?.name || artifactId,
    artifactLevel: level,
    targetStats: targetStatsAfterArtifactChange(preset.targetStats, previousArtifact, preset.artifactLevel ?? 30, source || null, level),
  };
}

export function libraryArtifactForCalculatorId(artifactId: string, artifacts: LibraryArtifact[]) {
  const normalizedId = toCalculatorId(artifactId);
  return artifacts.find((artifact) => [artifact.code, artifact.nameEn || '', artifact.name].map(toCalculatorId).includes(normalizedId)) || null;
}

export function calculatorArtifactIdForLibraryArtifact(artifact: LibraryArtifact) {
  const candidates = [artifact.code, artifact.nameEn || '', artifact.name].map(toCalculatorId).filter(Boolean);
  for (const candidate of candidates) if (Artifacts[candidate]) return candidate;
  const names = new Set([artifact.name, artifact.nameEn].filter(Boolean).map(normalizeName));
  const translated = (cn as { artifacts?: Record<string, string> }).artifacts || {};
  return Object.keys(Artifacts).find((id) => names.has(normalizeName(translated[id] || id))) || artifact.code;
}

function calculatorArtifactId(preset: BuildPreset, artifacts: LibraryArtifact[]) {
  if (!preset.artifactCode) return 'noProc';
  const source = artifacts.find((artifact) => artifact.code === preset.artifactCode);
  if (source) return calculatorArtifactIdForLibraryArtifact(source);
  const candidates = [preset.artifactCode, preset.artifactName || ''].map(toCalculatorId).filter(Boolean);
  for (const candidate of candidates) if (Artifacts[candidate]) return candidate;
  const names = new Set([preset.artifactName].filter(Boolean).map(normalizeName));
  const translated = (cn as { artifacts?: Record<string, string> }).artifacts || {};
  return Object.keys(Artifacts).find((id) => names.has(normalizeName(translated[id] || id))) || preset.artifactCode;
}

function toCalculatorId(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeName(value: unknown) {
  return String(value || '').toLocaleLowerCase().replace(/[\s·・’'“”"-]/g, '');
}

function readLastBuilds(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_BUILD_KEY) || '{}'); } catch { return {}; }
}
