import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const port = 4176;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [
  path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { cwd: root, stdio: 'ignore' });
let browser;

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (attempt === 79) throw new Error('Vite test server did not start');
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1580, height: 960 } });
  await page.goto(url, { waitUntil: 'commit' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(url, { waitUntil: 'commit' });
  await page.locator('.app-shell').waitFor({ timeout: 60_000 });

  for (const selector of ['.suite-nav-shell', '.app-shell']) {
    const box = await page.locator(selector).boundingBox();
    if (!box || box.x > 18 || 1580 - box.x - box.width > 18) {
      throw new Error(`${selector} does not use the wide desktop viewport: ${JSON.stringify(box)}`);
    }
  }

  if (await page.locator('.mobile-combatant__summary').first().isVisible()) {
    throw new Error('Mobile combatant summary is visible in the desktop release');
  }
  if (await page.locator('.mobile-combatant__collapse').first().isVisible()) {
    throw new Error('Mobile collapse control is visible in the desktop release');
  }

  const commonBuffBoxes = await Promise.all([
    page.locator('.combat-panel.attack .buff-row .chip').filter({ hasText: /^属性克制$/ }).boundingBox(),
    page.locator('.combat-panel.attack .buff-row .chip').filter({ hasText: /^攻击提升$/ }).boundingBox(),
    page.locator('.combat-panel.attack .buff-row .chip').filter({ hasText: /^爆伤提升$/ }).boundingBox(),
  ]);
  if (commonBuffBoxes.some((box) => !box) || new Set(commonBuffBoxes.map((box) => Math.round(box.y))).size !== 1) {
    throw new Error(`The first three common Buffs do not fit one row: ${JSON.stringify(commonBuffBoxes)}`);
  }

  await page.locator('.combat-panel.attack .portrait-button').click();
  const allHeroesSection = page.locator('.picker-section', { hasText: /^全部角色$/ });
  const firstAllHero = await allHeroesSection.count() > 0
    ? allHeroesSection.locator('xpath=following-sibling::button[contains(concat(" ", normalize-space(@class), " "), " hero-row ")][1]')
    : page.locator('.picker-list .hero-row').first();
  if (!(await firstAllHero.innerText()).includes('蕾诺娅')) {
    throw new Error('The All Heroes list does not start with Renoa');
  }
  await page.locator('.modal-scrim').click({ position: { x: 5, y: 5 } });

  const screenshotDir = path.join(root, 'test-screenshots');
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'desktop-wide-v0.1.17.png'), fullPage: true });
  console.log('Desktop layout passed: mobile summaries are hidden; 1580px viewport uses tight side margins; common Buffs stay on one row; Renoa is first in All Heroes.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
