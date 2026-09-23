import { readFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The desktop calculator/build release has no encyclopedia detail routes. Keep
// every avatar, icon, skill and effect reference, while moving full artworks
// out of the packaged public tree. Three legacy release artworks stay bundled.
const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = resolve(root, 'public');
const backupRoot = resolve(root, 'artwork-backup.local');
const legacyKeep = new Set([
  '/library/artifact-artworks/light-and-darkness.png',
  '/library/artifact-artworks/land-of-lingering-light.png',
  '/library/artifact-artworks/intoxicating-indulgence.png',
  '/library/heroes/lisette.webp',
  '/library/heroes/uncharted-pioneer-politis.webp',
]);
const artworks = new Set();
const required = new Set();

function scan(value, key = '') {
  if (typeof value === 'string' && value.startsWith('/library/')) {
    (key === 'artwork' ? artworks : required).add(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => scan(item, key));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => scan(childValue, childKey));
  }
}

for (const file of ['heroes', 'artifacts', 'presets']) {
  scan(JSON.parse(readFileSync(resolve(publicRoot, `library/${file}.json`), 'utf8')));
}

let bytes = 0;
let count = 0;
for (const url of artworks) {
  if (required.has(url) || legacyKeep.has(url)) continue;
  const relative = url.slice(1);
  const source = resolve(publicRoot, relative);
  const backup = resolve(backupRoot, relative);
  if (!source.startsWith(publicRoot + sep) || !backup.startsWith(backupRoot + sep)) {
    throw new Error(`Unsafe artwork path: ${url}`);
  }
  if (!existsSync(source)) continue;
  if (!statSync(source).isFile()) throw new Error(`Not a file: ${source}`);
  bytes += statSync(source).size;
  mkdirSync(dirname(backup), { recursive: true });
  renameSync(source, existsSync(backup) ? `${backup}.${Date.now()}` : backup);
  count += 1;
}

console.log(`Calculator artwork pruning: ${count} files, ${(bytes / 1048576).toFixed(2)} MiB moved to artwork-backup.local.`);
