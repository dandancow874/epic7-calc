import { access, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(
  process.argv[2]
    || process.env.E7_WIKI_DATA_DIR
    || path.join(projectRoot, '..', 'epic7-wiki-data'),
);
const outputRoot = path.join(projectRoot, 'public', 'library');
const heroOutputDir = path.join(outputRoot, 'heroes');
const artifactOutputDir = path.join(outputRoot, 'artifacts');
const artifactArtworkOutputDir = path.join(outputRoot, 'artifact-artworks');
const effectOutputDir = path.join(outputRoot, 'effects');
const exclusiveOutputDir = path.join(outputRoot, 'exclusives');
const maintenanceRoot = path.join(projectRoot, 'library-maintenance');
const heroPatchRoot = path.join(maintenanceRoot, 'heroes');
const legacyArtifactImageDir = path.join(projectRoot, 'public', 'assets', 'artifacts');

const roleMap = {
  assassin: 'thief',
  manauser: 'soul_weaver',
};

await mkdir(heroOutputDir, { recursive: true });
await mkdir(artifactOutputDir, { recursive: true });
await mkdir(artifactArtworkOutputDir, { recursive: true });
await mkdir(effectOutputDir, { recursive: true });
await mkdir(exclusiveOutputDir, { recursive: true });

const heroIndex = await readJson(path.join(sourceRoot, 'indexes', 'heroes-index.json'));
const artifactIndex = await readJson(path.join(sourceRoot, 'indexes', 'artifacts-index.json'));
const heroOverrides = await readJsonIfExists(path.join(maintenanceRoot, 'heroes.overrides.json')) || {};
const heroPatches = await readJsonDirectory(heroPatchRoot);
const gearScoreAdjustments = await readJsonIfExists(path.join(maintenanceRoot, 'gear-score-adjustments.json')) || {};
const artifactOverrides = await readJsonIfExists(path.join(maintenanceRoot, 'artifacts.overrides.json')) || {};
const presetOverrides = await readJsonIfExists(path.join(maintenanceRoot, 'presets.overrides.json')) || {};
const effectIcons = await readJsonIfExists(path.join(maintenanceRoot, 'effect-icons.json')) || {};

await copyAvailableImages(path.join(sourceRoot, 'images', 'heroes'), heroOutputDir);
await copyAvailableImages(path.join(sourceRoot, 'images', 'artifacts'), artifactOutputDir);
await copyAvailableImages(path.join(sourceRoot, 'images', 'artifact-artworks'), artifactArtworkOutputDir);
await copyAvailableImages(path.join(sourceRoot, 'images', 'effects'), effectOutputDir);
await copyAvailableImages(path.join(sourceRoot, 'images', 'exclusives'), exclusiveOutputDir);

const heroes = [];
for (const summary of heroIndex) {
  const detailPath = path.join(sourceRoot, 'heroes', `${summary.code}.json`);
  const detail = await readJsonIfExists(detailPath);
  const normalized = await normalizeHero(summary, detail);
  const legacyMerged = mergeRecord(normalized, heroOverrides[summary.code]);
  const patched = applyHeroPatch(legacyMerged, heroPatches[summary.code]);
  const scoreAdjustment = gearScoreAdjustments[summary.code];
  if (scoreAdjustment) {
    patched.gearScoreAdjustments = {
      finalMultipliers: scoreAdjustment.finalMultipliers || {},
      additivePercentPoints: scoreAdjustment.additivePercentPoints || {},
      libraryBaseStatsIncludes: scoreAdjustment.libraryBaseStatsIncludes || [],
    };
  }
  heroes.push(patched);
}

const artifacts = [];
for (const artifact of artifactIndex) {
  artifacts.push(mergeRecord(await normalizeArtifact(artifact), artifactOverrides[artifact.code]));
}

const artifactCodeByName = new Map(artifacts.flatMap((artifact) => [artifact.nameEn, artifact.name, artifact.nameZht]
  .filter(Boolean).map((name) => [String(name).toLocaleLowerCase(), artifact.code])));
const presets = applyPresetOverrides(await normalizePresets(path.join(sourceRoot, 'presets', 'fribbels', 'recommended'), artifactCodeByName), presetOverrides);

await writeJson(path.join(outputRoot, 'heroes.json'), heroes);
await writeJson(path.join(outputRoot, 'artifacts.json'), artifacts);
await writeJson(path.join(outputRoot, 'presets.json'), presets);
await writeJson(path.join(outputRoot, 'manifest.json'), {
  generatedAt: new Date().toISOString(),
  heroCount: heroes.length,
  heroDetailCount: heroes.filter((hero) => hero.dataStatus === 'complete').length,
  artifactCount: artifacts.length,
  artifactImageCount: artifacts.filter((artifact) => artifact.image).length,
  presetCount: presets.length,
});

console.log(`Generated ${heroes.length} heroes and ${artifacts.length} artifacts in ${outputRoot}`);

async function normalizeHero(summary, detail) {
  if (isStaticHeroDetail(detail)) return normalizeStaticHero(summary, detail);
  const source = detail || summary;
  const stats = detail?.stats?.find((entry) => entry.stats_type === 'full_awaken') || detail?.stats?.[0];
  const artworkFile = `${summary.code}.webp`;
  const avatarFile = `${summary.code}-avatar.png`;
  const skills = await Promise.all((detail?.skills || []).slice(0, 3).map(async (skill) => {
    const iconFile = `${summary.code}-${skill.skill_id}.png`;
    const soulBurnSource = typeof skill.soul_burn_skill === 'string' ? parseJsonObject(skill.soul_burn_skill) : (skill.soul_burn_skill || null);
    return {
      id: skill.skill_id,
      name: skill.name,
      description: cleanText(skill.description),
      icon: await publicAssetIfExists(heroOutputDir, iconFile, `/library/heroes/${iconFile}`),
      cooldown: cleanText(skill.turn_cool_desc),
      soulGain: numberOrZero(skill.soul_gain),
      soulBurn: soulBurnSource ? {
        cost: numberOrZero(soulBurnSource.soul_req),
        description: cleanText(soulBurnSource.desc),
      } : null,
      isAoe: Boolean(skill.is_aoe),
      dealsDamage: Boolean(skill.deal_damage),
      enhancements: (skill.lv_eff || []).map((entry) => ({ level: entry.level, text: cleanText(entry.text) })),
      multipliers: (skill.multipliers || []).map((multiplier) => ({
        id: String(multiplier.name || multiplier.id || 'multiplier'),
        name: cleanText(multiplier.display_name || multiplier.name || '技能倍率'),
        items: (multiplier.display_items || []).map((item) => ({
          key: String(item.key_name || item.display_key || ''),
          label: cleanText(item.display_key || item.key_name),
          value: String(item.value ?? item.display_value ?? ''),
          displayValue: cleanText(item.display_value ?? item.value),
        })),
      })).filter((multiplier) => multiplier.items.length),
      effects: (skill.skill_eff_explains || []).map((effect) => ({
        id: String(effect.explains_id || effect.name),
        name: effect.name,
        type: effect.type || 'common',
        description: cleanText(effect.effect),
        icon: effectIcons[effect.name] || effectIcons[effect.icon] || null,
      })),
    };
  }));

  return {
    code: summary.code,
    gameId: source.face_id || null,
    name: source.name || summary.name,
    nameEn: source.name_en || null,
    nameZht: source.name_zht || null,
    nicknames: splitNicknames(source.nicknames),
    attribute: source.attribute || summary.attribute,
    role: roleMap[source.role] || source.role || 'warrior',
    rarity: Number(source.rarity || summary.rarity || 3),
    zodiac: source.zodiac || summary.zodiac || null,
    publishDate: source.publish_dt || summary.publish_dt || null,
    descriptionLine: cleanText(source.description_line),
    story: cleanText(source.story),
    profile: detail ? {
      hobby: cleanText(detail.hobby),
      likes: cleanText(detail.likes),
      dislikes: cleanText(detail.dislikes),
      motto: cleanText(detail.motto),
      specialty: cleanText(detail.specialty),
      voiceCv: parseJsonObject(detail.voice_cv),
    } : null,
    baseStats: stats ? {
      atk: numberOrZero(stats.atk), hp: numberOrZero(stats.hp), def: numberOrZero(stats.def), spd: numberOrZero(stats.spd),
      chc: numberOrZero(stats.chc), chd: numberOrZero(stats.chd), eff: numberOrZero(stats.eff), efr: numberOrZero(stats.efr),
    } : null,
    artwork: await publicAssetIfExists(heroOutputDir, artworkFile, `/library/heroes/${artworkFile}`),
    avatar: await publicAssetIfExists(heroOutputDir, avatarFile, `/library/heroes/${avatarFile}`),
    skills,
    devotion: detail?.devotion || [],
    exclusives: await normalizeExclusiveEquipment(detail?.exclusives),
    tags: [],
    dataStatus: detail && skills.length && stats ? 'complete' : 'summary-only',
  };
}

function isStaticHeroDetail(detail) {
  return Boolean(detail && detail.stats && !Array.isArray(detail.stats) && Array.isArray(detail.skills) && detail.skills.some((skill) => skill.id));
}

async function normalizeStaticHero(summary, detail) {
  const artworkFile = `${summary.code}.webp`;
  const avatarFile = `${summary.code}-avatar.png`;
  const skills = await Promise.all((detail.skills || []).slice(0, 3).map(async (skill) => {
    const iconFile = `${summary.code}-${skill.id}.png`;
    return {
      id: String(skill.id),
      name: cleanText(skill.name),
      description: richText(skill.description),
      icon: await publicAssetIfExists(heroOutputDir, iconFile, `/library/heroes/${iconFile}`),
      cooldown: richText(skill.cooldown),
      soulGain: numberOrZero(skill.soulGain),
      soulBurn: skill.soulBurn ? { cost: numberOrZero(skill.soulBurn.cost), description: richText(skill.soulBurn.description) } : null,
      isAoe: richText(skill.description).includes('全体') || String(skill.targets || '').includes('全体'),
      dealsDamage: (skill.multipliers || []).some((group) => (group.items || []).some((item) => item.key === 'att_rate')),
      enhancements: (skill.enhancements || []).map((entry) => ({ level: numberOrZero(entry.level), text: richText(entry.description) })),
      multipliers: (skill.multipliers || []).map((group) => ({
        id: String(group.key || group.id || 'skill_multiplier'),
        name: cleanText(group.label || group.name || '技能倍率'),
        items: (group.items || []).map((item) => ({ key: String(item.key || ''), label: cleanText(item.label || item.key), value: String(item.value ?? ''), displayValue: cleanText(item.value) })),
      })).filter((group) => group.items.length),
      effects: await Promise.all((skill.effects || []).map(async (effect) => {
        const effectFile = effect.iconUrl ? path.basename(effect.iconUrl) : '';
        return {
          id: String(effect.id || effect.name), name: cleanText(effect.name), type: effect.type || 'common', description: richText(effect.description),
          icon: effectFile ? await publicAssetIfExists(effectOutputDir, effectFile, `/library/effects/${effectFile}`) : null,
        };
      })),
    };
  }));
  const self = detail.selfDevotion || {};
  const team = detail.devotion || {};
  const exclusive = detail.exclusiveEquipment;
  const exclusiveExtension = exclusive?.iconUrl ? (path.extname(exclusive.iconUrl) || '.webp') : '';
  const exclusiveIcon = exclusiveExtension ? await publicAssetIfExists(exclusiveOutputDir, `${summary.code}-exclusive${exclusiveExtension}`, `/library/exclusives/${summary.code}-exclusive${exclusiveExtension}`) : null;
  return {
    code: summary.code,
    gameId: detail.id || null,
    name: detail.name || summary.name,
    nameEn: detail.nameEn || null,
    nameZht: null,
    nicknames: splitNicknames(summary.nicknames),
    attribute: detail.attribute || summary.attribute,
    role: roleMap[detail.role] || detail.role || 'warrior',
    rarity: Number(detail.rarity || summary.rarity || 3),
    zodiac: detail.zodiac || summary.zodiac || null,
    publishDate: summary.publish_dt || null,
    descriptionLine: cleanText(detail.subtitle),
    story: richText(detail.story),
    profile: detail.profile ? { hobby: cleanText(detail.profile.hobby), likes: cleanText(detail.profile.like), dislikes: cleanText(detail.profile.dislike), motto: cleanText(detail.profile.motto), specialty: cleanText(detail.profile.specialty), voiceCv: detail.voice || {} } : null,
    baseStats: detail.stats ? { atk: numberOrZero(detail.stats.atk), hp: numberOrZero(detail.stats.hp), def: numberOrZero(detail.stats.def), spd: numberOrZero(detail.stats.spd), chc: numberOrZero(detail.stats.chc), chd: numberOrZero(detail.stats.chd), eff: numberOrZero(detail.stats.eff), efr: numberOrZero(detail.stats.efr) } : null,
    artwork: await publicAssetIfExists(heroOutputDir, artworkFile, `/library/heroes/${artworkFile}`),
    avatar: await publicAssetIfExists(heroOutputDir, avatarFile, `/library/heroes/${avatarFile}`),
    skills,
    devotion: (self.type || team.type) ? [{ self_type: self.type || '', self_effect_max: numberOrZero(self.grades?.sss), self_effect: numberOrZero(self.grades?.sss), public_type: team.type || '', public_effect_max: numberOrZero(team.grades?.sss), public_effect: numberOrZero(team.grades?.sss), public_slot: detail.devotionSlot || '' }] : [],
    exclusives: exclusive ? [{ id: String(exclusive.id || `${summary.code}-exclusive-equipment`), name: cleanText(exclusive.name || '专属装备'), description: richText(exclusive.description), iconKey: exclusiveIcon, mainStat: exclusive.mainStat ? { type: String(exclusive.mainStat.type || ''), min: numberOrZero(exclusive.mainStat.min), max: numberOrZero(exclusive.mainStat.max) } : null, skillOptions: (exclusive.skills || []).map((option) => ({ skillNumber: numberOrZero(option.slot ?? option.index), description: richText(option.description) })) }] : [],
    tags: [],
    dataStatus: skills.length && detail.stats ? 'complete' : 'summary-only',
  };
}

async function normalizeArtifact(artifact) {
  const imageFile = `${artifact.code}.png`;
  const legacyImageFile = `${artifact.code.replaceAll('-', '_')}.png`;
  const sourceImage = await publicAssetIfExists(artifactOutputDir, imageFile, `/library/artifacts/${imageFile}`);
  const legacyImage = await publicAssetIfExists(legacyArtifactImageDir, legacyImageFile, `/assets/artifacts/${legacyImageFile}`);
  const artwork = await publicAssetIfExists(artifactArtworkOutputDir, imageFile, `/library/artifact-artworks/${imageFile}`);
  return {
    code: artifact.code,
    name: artifact.name,
    nameEn: artifact.name_en || null,
    nameZht: artifact.name_zht || null,
    description: cleanText(artifact.description),
    skillDescription: cleanText(artifact.skill_display_desc || artifact.skill_desc),
    rarity: Number(artifact.rarity || 3),
    role: roleMap[artifact.role] || artifact.role || 'common',
    limited: Boolean(artifact.limited),
    stats: {
      atk: artifactMaxStat(artifact.stat_att),
      hp: artifactMaxStat(artifact.stat_max_hp),
      def: artifactMaxStat(artifact.stat_def),
    },
    image: sourceImage || legacyImage,
    artwork,
    publishDate: artifact.publish_dt || null,
  };
}

function artifactMaxStat(value) {
  return Math.round(numberOrZero(value) * 13);
}

function mergeRecord(record, override) {
  if (!override) return record;
  return {
    ...record,
    ...override,
    stats: record.stats && override.stats ? { ...record.stats, ...override.stats } : override.stats || record.stats,
    baseStats: record.baseStats && override.baseStats ? { ...record.baseStats, ...override.baseStats } : override.baseStats || record.baseStats,
    targetStats: record.targetStats && override.targetStats ? { ...record.targetStats, ...override.targetStats } : override.targetStats || record.targetStats,
  };
}

function applyHeroPatch(hero, patch) {
  if (!patch) return hero;
  const { skills, devotion, exclusives, ...heroFields } = patch;
  const result = mergeRecord(hero, heroFields);
  result.skills = mergeKeyedRecords(hero.skills, skills, 'id', mergeSkillPatch, (id) => ({
    id, name: '', description: '', icon: null, cooldown: '', soulGain: 0, soulBurn: null,
    isAoe: false, dealsDamage: false, enhancements: [], multipliers: [], effects: [],
  }));
  result.devotion = mergeFirstRecord(hero.devotion, devotion);
  result.exclusives = mergeKeyedRecords(hero.exclusives, exclusives, 'id', mergeExclusivePatch, (id) => ({
    id, name: '', description: '', iconKey: null, mainStat: null, skillOptions: [],
  }));
  return result;
}

function mergeSkillPatch(skill, patch) {
  const { soulBurn, enhancements, multipliers, effects, ...fields } = patch;
  const result = { ...skill, ...fields };
  if (Object.hasOwn(patch, 'soulBurn')) {
    result.soulBurn = soulBurn === null ? null : { ...(skill.soulBurn || {}), ...soulBurn };
  }
  result.enhancements = mergeKeyedRecords(skill.enhancements, enhancements, 'level', (record, change) => ({ ...record, ...change }), (level) => ({ level: Number(level), text: '' }));
  result.multipliers = mergeKeyedRecords(skill.multipliers, multipliers, 'id', mergeMultiplierPatch, (id) => ({ id, name: '技能倍率', items: [] }));
  result.effects = mergeKeyedRecords(skill.effects, effects, 'id', (record, change) => ({ ...record, ...change }), (id) => ({ id, name: '', type: 'common', description: '', icon: null }));
  return result;
}

function mergeMultiplierPatch(multiplier, patch) {
  const { items, ...fields } = patch;
  return {
    ...multiplier,
    ...fields,
    items: mergeKeyedRecords(multiplier.items, items, 'key', (record, change) => ({ ...record, ...change }), (key) => ({ key, label: key, value: '', displayValue: '' })),
  };
}

function mergeExclusivePatch(equipment, patch) {
  const { mainStat, skillOptions, ...fields } = patch;
  const result = { ...equipment, ...fields };
  if (Object.hasOwn(patch, 'mainStat')) result.mainStat = mainStat === null ? null : { ...(equipment.mainStat || {}), ...mainStat };
  if (Object.hasOwn(patch, 'skillOptions')) result.skillOptions = Array.isArray(skillOptions) ? skillOptions : equipment.skillOptions;
  return result;
}

function mergeFirstRecord(records, patch) {
  if (patch === undefined) return records;
  if (Array.isArray(patch)) return patch;
  if (!patch || typeof patch !== 'object') return records;
  if (!records.length) return [patch];
  return [{ ...records[0], ...patch }, ...records.slice(1)];
}

function mergeKeyedRecords(records, patches, keyField, merger, createRecord) {
  if (patches === undefined) return records || [];
  if (Array.isArray(patches)) return patches;
  if (!patches || typeof patches !== 'object') return records || [];

  const source = records || [];
  const seen = new Set();
  const merged = [];
  for (const record of source) {
    const key = String(record[keyField]);
    const patch = patches[key];
    seen.add(key);
    if (patch?._delete === true) continue;
    merged.push(patch ? merger(record, omitControlFields(patch)) : record);
  }
  for (const [key, patch] of Object.entries(patches)) {
    if (seen.has(String(key)) || patch?._delete === true) continue;
    merged.push(merger(createRecord(key), omitControlFields(patch)));
  }
  return merged;
}

function omitControlFields(record) {
  if (!record || typeof record !== 'object') return {};
  const { _delete, ...fields } = record;
  return fields;
}

function applyPresetOverrides(presets, overrides) {
  const byHero = new Map(presets.map((preset) => [preset.heroCode, preset]));
  for (const [heroCode, override] of Object.entries(overrides)) {
    if (override === null) byHero.delete(heroCode);
    else byHero.set(heroCode, mergeRecord(byHero.get(heroCode) || {
      id: `community:${heroCode}`, heroCode, name: '人工推荐', source: 'community', sets: [], artifactCode: null,
      artifactName: null, targetStats: normalizeTargetStats({}), selection: { source: 'manual maintenance override' },
    }, override));
  }
  return [...byHero.values()].sort((a, b) => a.heroCode.localeCompare(b.heroCode));
}

async function normalizePresets(directory, artifactCodeByName) {
  let files = [];
  try { files = (await readdir(directory)).filter((file) => file.endsWith('.json')); } catch { return []; }
  const presets = [];
  for (const file of files) {
    const source = await readJson(path.join(directory, file));
    if (source.status !== 'ok' || !source.preset || !source.hero?.id) continue;
    const sourceArtifactName = source.preset.artifact?.name || '';
    presets.push({
      id: `community:${source.hero.id}`,
      heroCode: source.hero.id,
      name: source.preset.name || '社区主流高配',
      source: 'community',
      sets: (source.preset.sets || []).flatMap((set) => Array(Math.max(1, Math.round(Number(set.pieces || 2) / setPieces(set.code)))).fill(set.code)),
      artifactCode: artifactCodeByName.get(String(sourceArtifactName).toLocaleLowerCase()) || null,
      artifactName: sourceArtifactName || null,
      targetStats: normalizeTargetStats(source.preset.target_stats || {}),
      selection: source.selection || null,
    });
  }
  return presets.sort((a, b) => a.heroCode.localeCompare(b.heroCode));
}

function normalizeTargetStats(stats) {
  return Object.fromEntries(['atk', 'hp', 'def', 'spd', 'chc', 'chd', 'eff', 'efr', 'gs'].map((key) => [key, numberOrZero(stats[key])]));
}

function setPieces(code) {
  return ['set_att', 'set_counter', 'set_cri_dmg', 'set_rage', 'set_revenge', 'set_scar', 'set_speed', 'set_vampire', 'set_shield', 'set_revenant', 'set_riposte'].includes(code) ? 4 : 2;
}

function cleanText(value) {
  if (!value) return '';
  return String(value)
    .replace(/<#[^>]+>/g, '')
    .replace(/<\/>/g, '')
    .replace(/%n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function richText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return cleanText(value);
  if (Array.isArray(value)) {
    const nestedBlocks = value.some((item) => Array.isArray(item));
    return value.map((item) => richText(item)).filter(Boolean).join(nestedBlocks ? '\n' : '');
  }
  if (typeof value === 'object') return cleanText(value.text || value.value || '');
  return '';
}

function splitNicknames(value) {
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function parseJsonObject(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}

async function normalizeExclusiveEquipment(records) {
  const items = await Promise.all((Array.isArray(records) ? records : []).map(async (record) => {
    const attribute = parseJsonObject(record.attribute);
    const mainStat = attribute.main_stat;
    const iconKey = attribute.icon
      ? await publicAssetIfExists(exclusiveOutputDir, `${attribute.icon}.png`, `/library/exclusives/${attribute.icon}.png`)
        || await publicAssetIfExists(exclusiveOutputDir, `${attribute.icon}.webp`, `/library/exclusives/${attribute.icon}.webp`)
      : null;
    return {
      id: String(record.id || record.name || 'exclusive-equipment'),
      name: cleanText(record.name),
      description: cleanText(record.description),
      iconKey,
      mainStat: mainStat ? {
        type: String(mainStat.type || ''),
        min: numberOrZero(mainStat.min),
        max: numberOrZero(mainStat.max),
      } : null,
      skillOptions: (attribute.exclusive_skill || []).map((option) => ({
        skillNumber: numberOrZero(option.exc_number),
        description: cleanText(option.exc_desc),
      })),
    };
  }));
  return items.filter((record) => record.name || record.skillOptions.length);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function copyAvailableImages(source, target) {
  try {
    await access(source);
    await cp(source, target, { recursive: true, force: true, errorOnExist: false });
  } catch {
    // Images are optional; records retain null paths when a file is absent.
  }
}

async function publicAssetIfExists(directory, fileName, publicPath) {
  try {
    await access(path.join(directory, fileName));
    return publicPath;
  } catch {
    return null;
  }
}

async function readJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

async function readJsonIfExists(filePath) {
  try { return await readJson(filePath); } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJsonDirectory(directory) {
  let files = [];
  try { files = (await readdir(directory)).filter((file) => file.endsWith('.json')); } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
  const records = {};
  for (const file of files) records[path.basename(file, '.json')] = await readJson(path.join(directory, file));
  return records;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
