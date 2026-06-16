import AdmZip from 'adm-zip';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markerPath = join(root, 'public', 'assets', '.source.json');
const assetsDir = join(root, 'public', 'assets');
const sourceDataDir = join(root, 'src', 'assets', 'data');
const sourceI18nDir = join(root, 'src', 'assets', 'i18n');
const upstreamAssetsPath = 'damage-calc/src/assets';
const commitsUrl = `https://api.github.com/repos/tyopoyt/epic7-damage-calc/commits?path=${upstreamAssetsPath}&per_page=1`;
const zipUrl = 'https://github.com/tyopoyt/epic7-damage-calc/archive/refs/heads/master.zip';

await main().catch((error) => {
  console.error(`assets 更新失败：${error.message || error}`);
  process.exitCode = 1;
});

async function main() {
  const latest = await latestAssetsCommit();
  const current = readMarker();

  if (current.sha === latest.sha) {
    console.log(`assets 已是最新：${formatDate(latest.date)}`);
    return;
  }

  console.log(`发现 assets 更新：${formatDate(current.date) || '未知'} -> ${formatDate(latest.date)}`);
  const zip = new AdmZip(await downloadBuffer(zipUrl, join(root, '.tmp-assets.zip')));
  const entries = zip.getEntries().filter((entry) => entry.entryName.includes(`/${upstreamAssetsPath}/`) && !entry.isDirectory);

  const keepAliases = backupAliases();
  rmSync(assetsDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });

  for (const entry of entries) {
    const assetPath = entry.entryName.slice(entry.entryName.indexOf(`/${upstreamAssetsPath}/`) + `/${upstreamAssetsPath}/`.length);
    if (!assetPath || assetPath.endsWith('/')) continue;
    const target = join(assetsDir, assetPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.getData());
  }

  restoreAliases(keepAliases);
  syncSubdir(join(assetsDir, 'data'), sourceDataDir, entries);
  syncSubdir(join(assetsDir, 'i18n'), sourceI18nDir, entries);
  writeFileSync(markerPath, JSON.stringify(latest, null, 2));
  console.log(`assets 导入完成：${formatDate(latest.date)}`);
}

async function latestAssetsCommit() {
  const data = await fetchJson(commitsUrl);
  const first = Array.isArray(data) ? data[0] : data;
  if (!first?.sha || !first?.commit?.committer?.date) throw new Error('GitHub 返回数据不完整');
  return { sha: first.sha, date: first.commit.committer.date };
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (response.ok) return await response.json();
      if (attempt === 3) throw new Error(`GitHub 检查失败：${response.status}`);
    } catch (error) {
      if (attempt === 3) break;
    }
    await sleep(1000 * attempt);
  }

  const json = execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; (Invoke-RestMethod -Uri '${url}' -Headers @{Accept='application/vnd.github+json'} | ConvertTo-Json -Depth 20)`,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(json);
}

async function downloadBuffer(url, fallbackPath) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    } catch {
      // Fall through to retry, then PowerShell fallback.
    }
    await sleep(1000 * attempt);
  }

  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${url}' -OutFile '${fallbackPath}'`,
  ], { stdio: 'inherit' });
  const buffer = readFileSync(fallbackPath);
  rmSync(fallbackPath, { force: true });
  return buffer;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMarker() {
  try {
    return JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    return {};
  }
}

function backupAliases() {
  const publicAlias = join(assetsDir, 'aliases.json');
  const dataAlias = join(root, 'src', 'data', 'aliases.json');
  return {
    publicAlias: existsSync(publicAlias) ? readFileSync(publicAlias) : null,
    dataAlias: existsSync(dataAlias) ? readFileSync(dataAlias) : null,
  };
}

function restoreAliases(backup) {
  if (backup.publicAlias) {
    const publicAlias = join(assetsDir, 'aliases.json');
    mkdirSync(dirname(publicAlias), { recursive: true });
    writeFileSync(publicAlias, backup.publicAlias);
  }
  if (backup.dataAlias) {
    const dataAlias = join(root, 'src', 'data', 'aliases.json');
    mkdirSync(dirname(dataAlias), { recursive: true });
    writeFileSync(dataAlias, backup.dataAlias);
  }
}

function syncSubdir(from, to, entries) {
  if (!existsSync(from)) return;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  const base = from.replaceAll('\\', '/');
  for (const entry of entries) {
    const assetPath = entry.entryName.slice(entry.entryName.indexOf(`/${upstreamAssetsPath}/`) + `/${upstreamAssetsPath}/`.length);
    const targetInAssets = join(assetsDir, assetPath);
    if (!targetInAssets.replaceAll('\\', '/').startsWith(base + '/')) continue;
    const target = join(to, relative(from, targetInAssets));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.getData());
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
