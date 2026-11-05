import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERO_CACHE = 'https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/herodata.json';
const ARTIFACT_CACHE = 'https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/artifactdata.json';
const BUILDS_URL = 'https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/dev/getBuilds';
const SETS = {
  set_speed: [4, '速度套'], set_att: [4, '攻击套'], set_cri_dmg: [4, '破灭套'],
  set_counter: [4, '反击套'], set_vampire: [4, '吸血套'], set_rage: [4, '愤怒套'],
  set_revenge: [4, '复仇套'], set_scar: [4, '伤口套'], set_shield: [4, '保护套'],
  set_revenant: [4, '逆袭套'], set_riposte: [4, '截击套'], set_weak: [4, '弱化套'],
  set_cri: [2, '暴击套'], set_acc: [2, '命中套'], set_res: [2, '抗性套'],
  set_max_hp: [2, '生命套'], set_def: [2, '防御套'], set_immune: [2, '免疫套'],
  set_penetrate: [2, '穿透套'], set_torrent: [2, '激流套'], set_chase: [2, '追击套'],
  set_coop: [2, '夹攻套'], set_fervor: [2, '全力套装'], set_opener: [2, '开幕套'],
};
const stats = ['atk', 'hp', 'def', 'spd', 'chc', 'chd', 'eff', 'efr', 'gs'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const readJson = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));

export function normalizedSets(input = {}) {
  const active = {};
  for (const [code, pieces] of Object.entries(input)) {
    if (!SETS[code]) return null;
    const completed = Math.floor(Number(pieces) / SETS[code][0]) * SETS[code][0];
    if (completed > 0) active[code] = completed;
  }
  return Object.values(active).reduce((sum, pieces) => sum + pieces, 0) === 6 ? active : null;
}

function mostCommon(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = key(item);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return [...groups.entries()].sort(([a, left], [b, right]) => right.length - left.length || a.localeCompare(b))[0];
}

/** Same method as the existing July preset batch; never invent a fallback panel. */
export function aggregateFribbelsBuilds(builds, artifactByCode, fetchedAt = new Date().toISOString()) {
  const dated = builds.map(build => ({ ...build, timestamp: Date.parse(build.createDate) }))
    .filter(build => Number.isFinite(build.timestamp));
  if (!dated.length) return null;
  const latest = Math.max(...dated.map(build => build.timestamp));
  const cutoff = latest - 120 * 86400000;
  const valid = dated.filter(build => build.timestamp >= cutoff
    && artifactByCode.has(String(build.artifactCode))
    && stats.every(key => Number.isFinite(Number(build[key])) && Number(build[key]) >= 0)
    && ['atk', 'hp', 'def', 'spd'].every(key => Number(build[key]) > 0))
    .map(build => ({ ...build, completedSets: normalizedSets(build.sets),
      adjustedGs: Math.ceil(Number(build.gs) - Math.max(0, Number(build.chc) - 100) * 1.6 - Math.max(0, Number(build.chd) - 350) * 1.14) }))
    .filter(build => build.completedSets);
  if (!valid.length) return null;
  const elite = [...valid].sort((a, b) => b.adjustedGs - a.adjustedGs).slice(0, Math.max(1, Math.ceil(valid.length * 0.25)));
  const [, archetype] = mostCommon(elite, build => Object.entries(build.completedSets).sort(([a], [b]) => a.localeCompare(b)).map(([key, pieces]) => `${key}:${pieces}`).join('+'));
  const [artifactCode] = mostCommon(archetype, build => String(build.artifactCode));
  const median = key => {
    const values = archetype.map(build => Number(build[key])).sort((a, b) => a - b);
    return Math.round(values[Math.floor((values.length - 1) / 2)]);
  };
  return {
    status: 'ok',
    preset: {
      name: '社区主流高配',
      sets: Object.entries(archetype[0].completedSets).sort(([a], [b]) => a.localeCompare(b))
        .map(([code, pieces]) => ({ code, pieces, name_zh: SETS[code][1] })),
      artifact: { code: artifactCode, name: artifactByCode.get(artifactCode) },
      target_stats: { ...Object.fromEntries(stats.map(key => [key, median(key)])),
        chc: Math.min(100, median('chc')), chd: Math.min(350, median('chd')), gs: median('adjustedGs') },
    },
    selection: {
      source: 'Fribbels Hero Library community builds', source_url: 'https://fribbels.github.io/e7/hero-library.html',
      fetched_at: fetchedAt, latest_sample_date: new Date(latest).toISOString().slice(0, 10), recent_days: 120,
      total_samples_seen: builds.length, valid_complete_samples: valid.length, elite_samples: elite.length,
      archetype_samples: archetype.length,
      method: '最近120天有效完整套装 -> 修正装备分前25% -> 最常见流派 -> 属性中位数与最常用神器',
      note: '仅保留每名角色一份聚合预设；社区攻击/生命/防御存在最高2%的匿名扰动。',
    },
  };
}

async function atomicJson(file, data) {
  await writeFile(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
  await rename(file + '.tmp', file);
}

export async function fillMissingFribbelsPresets({ sourceRoot, log = console.log, fetcher = fetch, delayMs = 1700 }) {
  const heroes = await readJson(path.join(sourceRoot, 'indexes/heroes-index.json'));
  const directory = path.join(sourceRoot, 'presets/fribbels/recommended');
  await mkdir(directory, { recursive: true });
  const records = new Map();
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.json'))) {
    const record = await readJson(path.join(directory, file));
    if (record.status === 'ok' && record.preset && record.hero?.id) records.set(record.hero.id, record);
  }
  const missing = heroes.filter(hero => !records.has(hero.code));
  const report = { checked_at: new Date().toISOString(), missing_before: missing.length, added: [], pending: [] };
  if (!missing.length) { log('Fribbels: 内置装备预设无缺项，不请求网络。'); return report; }
  const request = async (url, init = {}) => {
    const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  let heroCache, artifactByCode;
  try {
    heroCache = Object.values(await request(HERO_CACHE));
    await pause(delayMs);
    artifactByCode = new Map(Object.values(await request(ARTIFACT_CACHE)).map(artifact => [String(artifact.code), artifact.name]));
  } catch (error) {
    report.pending = missing.map(hero => ({ code: hero.code, name: hero.name, reason: `Fribbels目录暂不可用：${error.message}` }));
  }
  if (heroCache && artifactByCode) for (const hero of missing) {
    try {
      const detail = await readJson(path.join(sourceRoot, `heroes/${hero.code}.json`));
      const cacheHero = heroCache.find(entry => entry._id === hero.code || entry.code === (detail.face_id || detail.id || hero.face_id));
      const name = cacheHero?.name || detail.nameEn || detail.name_en;
      if (!name) throw new Error('缺少可验证的英文角色名，暂不查询');
      await pause(delayMs);
      const response = await request(BUILDS_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: name });
      if (!Array.isArray(response.data)) throw new Error('构筑接口响应结构异常');
      const aggregated = aggregateFribbelsBuilds(response.data, artifactByCode);
      if (!aggregated) {
        report.pending.push({ code: hero.code, name: hero.name, nameEn: name,
          reason: response.data.length ? '暂无可用的完整构筑' : 'Fribbels暂未提供该角色构筑', samples: response.data.length });
        log(`Fribbels: 待补 ${hero.name}（无可用数据）`); continue;
      }
      const record = { hero: { code: cacheHero?.code || detail.face_id || detail.id || hero.face_id,
        id: hero.code, name, role: cacheHero?.role || hero.role, attribute: cacheHero?.attribute || hero.attribute }, ...aggregated };
      // Existing successful records are never replaced, including when scripts are rerun.
      const target = path.join(directory, `${hero.code}.json`);
      let existing;
      try { existing = await readJson(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing?.status === 'ok' && existing.preset) continue;
      await atomicJson(target, record);
      report.added.push({ code: hero.code, name: hero.name, samples: aggregated.selection.total_samples_seen,
        targetStats: record.preset.target_stats, artifact: record.preset.artifact, sets: record.preset.sets });
      log(`Fribbels: 已补 ${hero.name}（${response.data.length}条样本，保留1份聚合预设）`);
    } catch (error) {
      report.pending.push({ code: hero.code, name: hero.name, reason: error.message });
      log(`Fribbels: 待补 ${hero.name}（${error.message}）`);
    }
    await atomicJson(path.join(sourceRoot, 'presets/fribbels/missing-presets-report.json'), report);
  }
  await atomicJson(path.join(sourceRoot, 'presets/fribbels/missing-presets-report.json'), report);
  log(`Fribbels: 新增${report.added.length}份，待补${report.pending.length}名；已有预设保留。`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceRoot = path.resolve(process.argv[2] || process.env.E7_WIKI_DATA_DIR || path.resolve(import.meta.dirname, '../../epic7-wiki-data'));
  await fillMissingFribbelsPresets({ sourceRoot });
}
