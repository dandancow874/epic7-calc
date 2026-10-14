import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const project = path.resolve(import.meta.dirname, '..');
const root = path.join(project, 'test-screenshots/native-zoom');
await mkdir(path.join(root, 'windows-smoke/data'), { recursive: true });
await copyFile(path.join(project, 'release/Epic7 Damage Calc Portable.exe'), path.join(root, 'windows-smoke/Epic7 Damage Calc Portable.exe'));
await copyFile(path.join(project, 'src/data/aliases.json'), path.join(root, 'windows-smoke/data/aliases.json'));
for (const helper of ['launch-native-smoke.ps1', 'stop-native-smoke.ps1']) await copyFile(path.join(project, 'scripts', helper), path.join(root, helper));
const executable = path.join(root, 'windows-smoke', 'Epic7 Damage Calc Portable.exe');
const port = 9237;
const endpoint = `http://127.0.0.1:${port}`;
const fixed = true;
let browser;
let appId;
const observations = [];
const errors = [];
try {
  const { stdout } = await run('pwsh', ['-NoProfile', '-File', path.join(root, 'launch-native-smoke.ps1'), '-Executable', executable, '-DataFolder', path.join(root, 'windows-smoke', 'profile'), '-DebugPort', String(port)], { windowsHide: true });
  appId = Number(stdout.trim());
  for (let index = 0; index < 120; index++) {
    try { if ((await fetch(`${endpoint}/json/version`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (index === 119) throw new Error('Native test endpoint not ready');
  }
  browser = await chromium.connectOverCDP(endpoint);
  let page;
  for (let index = 0; index < 80; index++) {
    page = browser.contexts().flatMap((context) => context.pages()).find((item) => item.url().includes('tauri.localhost'));
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(page);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.primary-nav').getByRole('button', { name: '伤害计算', exact: true }).click();
  await page.locator('.combat-panel.attack .portrait-button').click();
  await page.getByPlaceholder('搜索角色名 / 别名').fill('梅玲');
  await page.locator('.picker .hero-row').filter({ hasText: '梅铃' }).first().click();

  for (const width of [1200, 1580]) {
    await page.evaluate(async (value) => {
      await window.__TAURI_INTERNALS__.invoke('plugin:window|set_size', { label: 'main', value: { Physical: { width: value, height: 900 } } });
    }, width);
    for (const percent of [50, 67, 80, 100, 125, 150]) {
      await page.getByRole('button', { name: '打开界面设置与更新' }).click();
      await page.getByRole('spinbutton', { name: 'UI 缩放百分比' }).fill(String(percent));
      await page.getByRole('spinbutton', { name: 'UI 缩放百分比' }).press('Enter');
      await page.getByRole('button', { name: '关闭界面设置' }).click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(() => {
        const selectors = ['.suite-nav-shell', '.app-shell', '.top-actions', '.mode-switch', '.duel-grid', '.combat-panel.attack', '.combat-panel.defense', '.damage-dock', '.damage-dock table'];
        return {
          viewport: document.documentElement.clientWidth,
          innerWidth: window.innerWidth,
          compensation: document.documentElement.style.getPropertyValue('--workspace-viewport-width'),
          rootZoom: document.documentElement.style.zoom,
          bodyZoom: document.body.style.zoom,
          bounds: selectors.map((selector) => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { selector, x: rect.x, width: rect.width, right: rect.right };
          }),
        };
      });
      observations.push({ width, percent, ...metrics });
      if (fixed) {
        assert.equal(metrics.compensation, '', 'Native WebView still received CSS-zoom width compensation');
        assert.equal(metrics.rootZoom, '');
        assert.equal(metrics.bodyZoom, '');
        for (const box of metrics.bounds) {
          assert(box.x >= -1 && box.right <= metrics.viewport + 1, `${width}px/${percent}% clips ${box.selector}: ${JSON.stringify(metrics)}`);
        }
      }
      if (width === 1200 && [50, 80, 150].includes(percent)) await page.screenshot({ path: path.join(root, `${fixed ? 'after' : 'before'}-${percent}.png`) });
    }
  }
  if (!fixed) assert(observations.some((item) => item.bounds.some((box) => box.right > item.viewport + 2)), 'The old EXE did not reproduce clipping');
  else {
    await page.locator('.primary-nav').getByRole('button', { name: '角色装备', exact: true }).click();
    await page.locator('.build-hero-strip').waitFor();
    await page.getByRole('button', { name: '打开界面设置与更新' }).click();
    await page.getByRole('spinbutton', { name: 'UI 缩放百分比' }).fill('50');
    await page.getByRole('button', { name: '关闭界面设置' }).click();
    const box = await page.locator('.library-shell').boundingBox();
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    assert(box.x >= -1 && box.x + box.width <= viewport + 1, 'Build page still clips at 50%');
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(root, `${fixed ? 'after' : 'before'}-metrics.json`), JSON.stringify({ fixed, observations, errors }, null, 2));
  console.log(JSON.stringify({ fixed, checkedCases: observations.length, first: observations[0], errors }, null, 2));
} finally {
  await browser?.close().catch(() => {});
  if (appId) await run('pwsh', ['-NoProfile', '-File', path.join(root, 'stop-native-smoke.ps1'), '-TaskAppProcessId', String(appId), '-Executable', executable], { windowsHide: true });
}
