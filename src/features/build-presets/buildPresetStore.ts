import { readPortableJson, writePortableJson } from '../../data/portableData';
import { emptyTargetStats, type BuildPreset } from './types';

type BuildPresetDb = {
  manual: Record<string, BuildPreset[]>;
  communityOverrides: Record<string, BuildPreset>;
  hiddenCommunity: string[];
};

const KEY = 'epic7.tools.buildPresets.v1';
const FILE_NAME = 'build-presets.json';
let cachedDb = readLocalDb();

export async function hydrateBuildPresetsFromDisk() {
  const disk = await readPortableJson<Partial<BuildPresetDb>>(FILE_NAME);
  if (disk) {
    cachedDb = normalizeDb(disk);
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(cachedDb));
  } else {
    await writePortableJson(FILE_NAME, cachedDb);
  }
}

export function listBuildPresets(heroCode: string, community?: BuildPreset | null) {
  const result: BuildPreset[] = [];
  if (community && !cachedDb.hiddenCommunity.includes(heroCode)) result.push(normalizePreset(cachedDb.communityOverrides[heroCode] || community));
  result.push(...(cachedDb.manual[heroCode] || []).map(normalizePreset));
  return result;
}

export async function createManualBuildPreset(heroCode: string, base?: BuildPreset | null) {
  const manual = cachedDb.manual[heroCode] || [];
  const preset: BuildPreset = {
    id: `manual:${heroCode}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    heroCode,
    name: `配置 ${manual.length + 1}`,
    source: 'manual',
    sets: [...(base?.sets || [])],
    artifactCode: base?.artifactCode || null,
    artifactName: base?.artifactName || null,
    artifactLevel: base?.artifactLevel ?? 30,
    imprintMode: base?.imprintMode || 'self',
    imprintRank: base?.imprintRank || 'SSS',
    exclusiveEquipmentId: base?.exclusiveEquipmentId || null,
    rightMainStats: { necklace: 'auto', ring: 'auto', boots: 'auto', ...(base?.rightMainStats || {}) },
    targetStats: { ...emptyTargetStats, ...(base?.targetStats || {}) },
    updatedAt: new Date().toISOString(),
  };
  cachedDb = applyPresetSave(cachedDb, preset);
  await persist();
  return preset;
}

export async function saveBuildPreset(preset: BuildPreset) {
  const next = normalizePreset({ ...preset, targetStats: { ...preset.targetStats }, sets: [...preset.sets], rightMainStats: preset.rightMainStats ? { ...preset.rightMainStats } : undefined, updatedAt: new Date().toISOString() });
  cachedDb = applyPresetSave(cachedDb, next);
  await persist();
  return next;
}

export async function deleteManualBuildPreset(preset: BuildPreset) {
  if (preset.source !== 'manual') return;
  cachedDb = {
    ...cachedDb,
    manual: { ...cachedDb.manual, [preset.heroCode]: (cachedDb.manual[preset.heroCode] || []).filter((item) => item.id !== preset.id) },
  };
  await persist();
}

export async function deleteBuildPreset(preset: BuildPreset) {
  if (preset.source === 'manual') return deleteManualBuildPreset(preset);
  const communityOverrides = { ...cachedDb.communityOverrides };
  delete communityOverrides[preset.heroCode];
  cachedDb = { ...cachedDb, communityOverrides, hiddenCommunity: [...new Set([...cachedDb.hiddenCommunity, preset.heroCode])] };
  await persist();
}

export async function resetCommunityBuildPreset(heroCode: string) {
  const communityOverrides = { ...cachedDb.communityOverrides };
  delete communityOverrides[heroCode];
  cachedDb = { ...cachedDb, communityOverrides, hiddenCommunity: cachedDb.hiddenCommunity.filter((code) => code !== heroCode) };
  await persist();
}

export function applyPresetSave(db: BuildPresetDb, preset: BuildPreset): BuildPresetDb {
  if (preset.source === 'community') {
    return { ...db, communityOverrides: { ...db.communityOverrides, [preset.heroCode]: preset } };
  }
  const manual = [...(db.manual[preset.heroCode] || [])];
  const index = manual.findIndex((item) => item.id === preset.id);
  if (index >= 0) manual[index] = preset;
  else manual.push(preset);
  return { ...db, manual: { ...db.manual, [preset.heroCode]: manual } };
}

export function emptyBuildPresetDb(): BuildPresetDb {
  return { manual: {}, communityOverrides: {}, hiddenCommunity: [] };
}

async function persist() {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(cachedDb));
  await writePortableJson(FILE_NAME, cachedDb);
}

function readLocalDb() {
  if (typeof localStorage === 'undefined') return emptyBuildPresetDb();
  try { return normalizeDb(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return emptyBuildPresetDb(); }
}

function normalizeDb(db: Partial<BuildPresetDb>): BuildPresetDb {
  return { manual: db.manual || {}, communityOverrides: db.communityOverrides || {}, hiddenCommunity: db.hiddenCommunity || [] };
}

function normalizePreset(preset: BuildPreset): BuildPreset {
  return {
    ...preset,
    artifactLevel: preset.artifactLevel ?? 30,
    imprintMode: preset.imprintMode || 'self',
    imprintRank: preset.imprintRank || 'SSS',
    exclusiveEquipmentId: preset.exclusiveEquipmentId || null,
    rightMainStats: { necklace: 'auto', ring: 'auto', boots: 'auto', ...(preset.rightMainStats || {}) },
  };
}
