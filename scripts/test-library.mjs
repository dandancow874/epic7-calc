import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const port = 4175;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
let browser;

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (attempt === 79) throw new Error('Vite test server did not start');
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Hero advanced filter -> detail -> editable build.
  await page.getByRole('button', { name: '角色图鉴' }).click();
  await page.getByRole('button', { name: /里安娜路西艾拉/ }).waitFor();
  await page.getByRole('button', { name: /高级筛选/ }).click();
  const tagSearch = page.getByPlaceholder('搜索技能效果词条');
  const advancedFooter = page.locator('.advanced-filter-dialog > footer');
  if (!await advancedFooter.locator('input[placeholder="搜索技能效果词条"]').count()) throw new Error('Advanced tag search is not in the footer');
  await tagSearch.fill('穿透');
  await page.getByRole('button', { name: /百穿/ }).waitFor();
  await page.getByRole('button', { name: /防御穿透/ }).waitFor();
  await tagSearch.fill('减伤');
  await page.getByRole('button', { name: /伤害降低/ }).waitFor();
  const resetBox = await page.getByRole('button', { name: '重置筛选' }).boundingBox();
  const applyBox = await page.getByRole('button', { name: /应用筛选/ }).boundingBox();
  if (!resetBox || !applyBox || resetBox.x >= applyBox.x) throw new Error('Reset action is not left of apply action');
  await tagSearch.fill('群攻');
  await page.locator('.tag-options button').first().click();
  await tagSearch.press('Enter');
  await page.getByRole('dialog', { name: '角色高级筛选' }).waitFor({ state: 'detached' });
  const heroCard = page.locator('.hero-card').first();
  await heroCard.waitFor();
  await heroCard.click();
  await page.getByRole('button', { name: /查看.+完整立绘/ }).click();
  await page.getByRole('dialog', { name: /立绘大图/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: /立绘大图/ }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '编辑角色数据' }).click();
  const heroEditor = page.getByRole('dialog', { name: /角色数据编辑器/ });
  await heroEditor.waitFor();
  const firstStat = heroEditor.locator('.hero-editor-stat-grid input').first();
  await firstStat.fill(String(Number(await firstStat.inputValue()) + 1));
  await heroEditor.getByText(/检测到 1 项修改/).waitFor();
  await page.keyboard.press('Escape');
  await heroEditor.waitFor({ state: 'detached' });
  const firstEffect = page.locator('.effect-tags button').first();
  await firstEffect.waitFor();
  await firstEffect.click();
  const effectDialog = page.getByRole('dialog', { name: /效果说明/ });
  await effectDialog.waitFor();
  await page.keyboard.press('Escape');
  await effectDialog.waitFor({ state: 'detached' });
  await firstEffect.click();
  await effectDialog.waitFor();
  await page.locator('.library-modal-backdrop').click({ position: { x: 5, y: 5 } });
  await effectDialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '查看角色装备' }).click();
  await page.getByText('角色最终面板').waitFor();
  await page.locator('.build-hero-picker-trigger').click();
  await page.locator('.build-hero-search input').fill('Saria');
  if (await page.locator('.build-hero-picker-list > button').count() !== 1) throw new Error('Build hero picker did not search the English hero name');
  await page.getByRole('button', { name: '关闭' }).click();
  if (await page.locator('.build-calculator-actions button').count() !== 2) throw new Error('Build page did not expose attacker and defender apply actions');
  const presetName = page.getByLabel('预设名称');
  await presetName.fill('端到端测试配置');
  await page.locator('.equipment-summary').filter({ hasText: '装备套装' }).click();
  await page.locator('.modal-set-picker button:not([disabled])').first().click();
  await page.getByRole('button', { name: '关闭' }).click();
  await page.locator('.selected-artifact').click();
  await page.locator('.modal-artifact-list button').first().click();
  await page.locator('.build-score-strip').waitFor();
  if (await page.locator('.preset-rail__actions .danger').count() !== 1) throw new Error('Build preset delete action is missing');
  await page.getByText('已保存到本机').waitFor();

  // Artifact filter -> detail.
  await page.getByRole('button', { name: '神器图鉴' }).click();
  await page.getByPlaceholder('搜索神器名称或英文名').fill('蝶之洗礼');
  await page.locator('.artifact-card').first().click();
  await page.getByRole('button', { name: '返回图鉴' }).waitFor();
  await page.getByText('神器技能').waitFor();

  // Existing calculator modes remain reachable.
  await page.getByRole('button', { name: '战斗计算' }).click();
  const buildSelectors = page.locator('.calculator-build-select');
  await buildSelectors.first().waitFor();
  if (await buildSelectors.count() !== 2) throw new Error('Calculator did not expose equipment presets for both combat sides');
  if (!await buildSelectors.first().getAttribute('class').then((value) => value?.includes('linked'))) throw new Error('Calculator did not automatically select the hero equipment preset');
  if (await page.getByText(/^状态 /).count()) throw new Error('Legacy state profile entry is still visible');
  if (await page.locator('.build-use-toggle').count() !== 2) throw new Error('Both combat sides must expose the equipment preset toggle');
  if (await page.locator('.combat-panel.defense .stat-field').filter({ hasText: /^攻击/ }).count()) throw new Error('Defender attack should not be displayed');
  const attackerArtifactBox = await page.getByRole('button', { name: '选择神器' }).boundingBox();
  const defenderArtifactBox = await page.getByRole('button', { name: '选择防守神器' }).boundingBox();
  const attackerHeadBox = await page.locator('.combat-panel.attack .panel-head').boundingBox();
  const defenderHeadBox = await page.locator('.combat-panel.defense .panel-head').boundingBox();
  if (!attackerArtifactBox || !defenderArtifactBox || !attackerHeadBox || !defenderHeadBox
    || attackerArtifactBox.x < attackerHeadBox.x + attackerHeadBox.width * 0.7
    || defenderArtifactBox.x < defenderHeadBox.x + defenderHeadBox.width * 0.7) {
    throw new Error('Artifact controls are not aligned at the right side of both headers');
  }
  await buildSelectors.first().click();
  await page.getByRole('heading', { name: /装备预设/ }).waitFor();
  await page.getByRole('button', { name: /复制为新预设/ }).waitFor();
  await page.getByRole('button', { name: '关闭' }).click();
  const attackerBuildToggle = page.locator('.combat-panel.attack .build-use-toggle input');
  const lockedAttackSlider = page.locator('.combat-panel.attack .stat-field input[type="range"]').first();
  if (!await lockedAttackSlider.isDisabled()) throw new Error('Preset-owned attack must be locked while the preset is enabled');
  const originalSavedAttack = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('epic7.tools.buildPresets.v1') || '{}');
    return db.communityOverrides?.abigail?.targetStats?.atk;
  });
  await attackerBuildToggle.uncheck();
  await lockedAttackSlider.fill('2345');
  await page.waitForTimeout(600);
  const savedAttack = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('epic7.tools.buildPresets.v1') || '{}');
    return db.communityOverrides?.abigail?.targetStats?.atk;
  });
  if (savedAttack !== originalSavedAttack) throw new Error('Manual override unexpectedly changed the shared equipment preset');
  await attackerBuildToggle.check();
  if (!await lockedAttackSlider.isDisabled()) throw new Error('Re-enabling the preset did not lock its attack value');
  await page.locator('.combat-panel.defense .stat-field').filter({ hasText: '防护罩' }).waitFor();
  if (await page.locator('.combat-panel.defense .stat-field').filter({ hasText: '生命增加(%)' }).count()
    || await page.locator('.combat-panel.defense .stat-field').filter({ hasText: '防御增加(%)' }).count()) {
    throw new Error('Hidden artifact HP/Defense increase fields still occupy defender panel space');
  }
  await page.getByRole('button', { name: '选择防守神器' }).click();
  await page.getByText('不使用神器').waitFor();
  if (await page.locator('.picker-row').count() < 2) throw new Error('Defender artifact picker did not load compatible artifacts');
  await page.locator('.modal-scrim').click({ position: { x: 5, y: 5 } });
  if (!/\(\d+\.\d%\)/.test(await page.locator('.damage-percent').first().innerText())) throw new Error('Damage result did not show target HP percentage');

  // Notos + Bastion of Perlutia derives a 30% max-HP battle barrier.
  await page.locator('.combat-panel.defense .portrait-button').click();
  await page.locator('.searchbox input').fill('诺托斯');
  await page.locator('.picker-row').first().click();
  await page.getByRole('button', { name: '选择防守神器' }).click();
  await page.locator('.searchbox input').fill('波鲁迪亚的堡垒');
  await page.locator('.picker-row').filter({ hasText: '波鲁迪亚的堡垒' }).click();
  await page.waitForTimeout(500);
  const readDefenderField = async (label) => {
    const field = page.locator('.combat-panel.defense .stat-field').filter({ has: page.locator('span').filter({ hasText: new RegExp(`^${label}$`) }) });
    return Number(await field.locator('output, input.number-box').last().evaluate((element) => element instanceof HTMLInputElement ? element.value : element.textContent));
  };
  const notosHp = await readDefenderField('生命');
  const notosBarrier = await readDefenderField('防护罩');
  if (!notosHp || notosBarrier !== Math.round(notosHp * 0.3)) throw new Error(`Bastion barrier mismatch: HP=${notosHp}, barrier=${notosBarrier}`);
  const lingering = page.locator('.combat-panel.defense .chip').filter({ hasText: '余香' });
  for (let stack = 1; stack <= 5; stack += 1) {
    await lingering.click();
    if (!(await lingering.innerText()).includes(`余香 ${stack}`)) throw new Error(`Lingering Fragrance did not cycle to stack ${stack}`);
  }
  const boostedBarrier = await readDefenderField('防护罩');
  if (boostedBarrier !== Math.round(notosHp * 1.25 * 0.3)) throw new Error(`Lingering Fragrance did not increase Bastion barrier: ${boostedBarrier}`);

  await page.locator('.combat-panel.attack .portrait-button').click();
  await page.locator('.searchbox input').fill('智武');
  await page.locator('.picker-row').first().click();
  const zioCurrentHp = page.locator('.combat-panel.attack .special-input').filter({ hasText: '目标的当前生命' });
  const linkedCurrentHp = Number(await zioCurrentHp.locator('output, input').last().evaluate((element) => element instanceof HTMLInputElement ? element.value : element.textContent));
  if (linkedCurrentHp !== Math.round(notosHp * 1.25)) throw new Error(`Zio target current HP did not use defender battle HP: ${linkedCurrentHp}`);
  await page.getByText('套用防守对象数值', { exact: true }).waitFor();
  await page.getByRole('button', { name: '速度推算' }).click();
  await page.getByRole('heading', { name: '速度推算' }).waitFor();
  await page.getByRole('button', { name: '速攻值推算' }).click();
  await page.getByRole('heading', { name: '速攻值推算' }).waitFor();

  // Corrupt detail navigation state falls back safely.
  await page.evaluate(() => localStorage.setItem('epic7.tools.heroDetail.v1', 'missing-hero-code'));
  await page.getByRole('button', { name: '角色图鉴' }).click();
  await page.getByText('未找到角色，已返回角色图鉴。').waitFor();

  // New static-data heroes include full stats, skills and images.
  for (const heroName of ['波涛裂痕艾碧拉', '奥芙']) {
    const search = page.getByPlaceholder('搜索角色名称、英文名或昵称');
    await search.fill(heroName);
    await page.locator('.hero-card').first().click();
    if (await page.locator('.skill-card').count() !== 3) throw new Error(`${heroName} did not load three skills from the new static data source`);
    if (await page.locator('.hero-dossier__art img').count() < 1) throw new Error(`${heroName} artwork is missing`);
    const enhancementDetails = page.locator('.skill-enhancements').first();
    await enhancementDetails.waitFor();
    if (await enhancementDetails.evaluate((element) => element.hasAttribute('open'))) throw new Error(`${heroName} skill enhancements should be collapsed by default`);
    await enhancementDetails.locator('summary').click();
    if (!await enhancementDetails.locator('li').first().isVisible()) throw new Error(`${heroName} skill enhancements did not expand`);
    await page.getByRole('button', { name: '返回图鉴' }).click();
  }

  // Library search shares calculator English names and aliases.
  const librarySearch = page.getByPlaceholder('搜索角色名称、英文名或昵称');
  await librarySearch.fill('Rhianna and Luciella');
  await page.locator('.hero-card').first().click();
  await page.locator('.library-hero-title-button').click();
  const aliasDialog = page.getByRole('dialog', { name: /别名设置/ });
  await aliasDialog.waitFor();
  await aliasDialog.locator('input').fill('里安娜路西艾拉,端到端别名');
  await aliasDialog.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: '返回图鉴' }).click();
  await librarySearch.fill('端到端别名');
  await page.getByRole('button', { name: /里安娜路西艾拉/ }).waitFor();

  console.log('E2E passed: hero advanced filter -> detail -> build picker; shared aliases and English search; artifact filter -> detail; calculator defender artifact and damage percentage; calculator modes; new static heroes; invalid hero fallback.');
} finally {
  await browser?.close();
  server.kill();
}
