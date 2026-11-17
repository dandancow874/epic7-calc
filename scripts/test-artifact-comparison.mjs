import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

export async function verifyArtifactComparison(page, output, prefix = 'browser') {
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const attack = page.locator('.combat-panel.attack');
  const defense = page.locator('.combat-panel.defense');
  const expand = async panel => {
    const summary = page.locator(`.mobile-combatant.${panel === attack ? 'attack' : 'defense'} .mobile-combatant__summary`);
    if (await summary.isVisible()) await summary.click();
  };
  const field = (panel, name) => panel.locator('.stat-field').filter({ has: page.locator('> span', { hasText: new RegExp(`^${name}$`) }) }).locator('input.number-box');
  const enter = async (locator, value) => { await locator.fill(String(value)); await locator.press('Tab'); };
  const disablePreset = async panel => {
    await expand(panel);
    const checkbox = panel.locator('.build-use-toggle input');
    if (await checkbox.isEnabled() && await checkbox.isChecked()) await checkbox.uncheck();
  };
  const selectHero = async name => {
    await expand(attack);
    await attack.locator('.portrait-button').click();
    await page.getByPlaceholder('搜索角色名 / 别名').fill(name);
    await page.locator('.picker .hero-row').filter({ has: page.locator('span', { hasText: new RegExp(`^${name}$`) }) }).first().click();
  };
  const selectNone = async panel => {
    await expand(panel);
    await panel.locator('.artifact-icon-button').click();
    await page.locator('.picker-row').filter({ hasText: '不使用神器' }).click();
  };
  const openAuto = async () => {
    await expand(attack);
    await attack.locator('.artifact-icon-button').click();
    const start = performance.now();
    await page.getByRole('button', { name: '快速筛选' }).click();
    await page.getByRole('status').filter({ hasText: '已按增伤排序' }).waitFor();
    return performance.now() - start;
  };
  const rows = () => page.locator('.damage-dock tbody tr').filter({ has: page.locator('.skill-cell') });
  const tableDamage = async (index, hit) => Number((await rows().nth(index).locator('td').nth(hit + 1).locator('.damage-value').innerText()).replaceAll(',', ''));
  const readPreview = locator => locator.locator('.artifact-increase').getAttribute('title').then(title => {
    const match = title.match(/当前伤害 (\d+) \/ 不带神器 (\d+)/); assert(match, title);
    return { damage: Number(match[1]), baseline: Number(match[2]) };
  });
  const storage = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /profiles|buildPresets/i.test(key))));
  const assertSorted = async () => {
    const texts = await page.locator('.artifact-picker-list .picker-row').allTextContents();
    const percentages = texts.slice(1).map(text => text.match(/（([+-]\d+\.\d+)%/)).filter(Boolean).map(match => Number(match[1]));
    assert(percentages.length > 1);
    for (let i = 1; i < percentages.length; i++) assert(percentages[i - 1] >= percentages[i], 'Artifact order is not descending');
    return texts;
  };

  await expand(attack);
  await attack.waitFor();
  await selectHero('绮世');
  for (const panel of [attack, defense]) { await disablePreset(panel); await selectNone(panel); }
  await expand(attack);
  await enter(field(attack, '攻击'), 2500);
  await enter(field(attack, '爆伤'), 250);
  await expand(defense);
  await enter(field(defense, '防御'), 2000);
  await expand(attack);
  const common = await attack.locator('.buff-row > .chip').allTextContents();
  assert.deepEqual(common.slice(0, 6).map(text => text.replace('✓', '').trim()), ['属性克制', '攻击提升', '爆伤提升', '魄力', '狂气', '穿透提升']);
  const penetration = () => attack.locator('.buff-row').getByRole('button', { name: '穿透提升', exact: false });
  const baseNormal = await tableDamage(0, 2);
  await penetration().click();
  const normalPenetration = await tableDamage(0, 2);
  await penetration().click();
  const greaterButton = attack.locator('.buff-row').getByRole('button', { name: '穿透大幅提升', exact: false });
  const greaterPenetration = await tableDamage(0, 2);
  assert(greaterPenetration > normalPenetration && normalPenetration > baseNormal);
  await greaterButton.click();
  assert.equal(await tableDamage(0, 2), baseNormal);
  await page.waitForTimeout(600);
  const before = await storage();
  const tableLabels = await rows().locator('.skill-cell > span').allTextContents();
  const elapsedMs = await openAuto();
  const skills = page.getByRole('combobox', { name: '技能选择', exact: true });
  const hit = page.getByRole('combobox', { name: '命中状态', exact: true });
  const options = await skills.locator('option').allTextContents();
  assert.equal(options.length, tableLabels.length);
  assert(options.some(name => name.includes('烧魂')));
  await assertSorted();
  const burnIndex = options.findIndex(name => name.includes('烧魂'));
  await skills.selectOption({ index: burnIndex });
  await hit.selectOption('normal');
  await assertSorted();
  const none = page.locator('.artifact-picker-list .picker-row').filter({ hasText: '不使用神器' });
  assert((await none.innerText()).includes('+0.0%'));
  await page.screenshot({ path: path.join(output, `${prefix}-sorted.png`), fullPage: true });
  const supported = page.locator('.artifact-picker-list .picker-row').filter({ hasText: '团结象征' });
  await page.getByPlaceholder('搜索神器', { exact: true }).fill('团结');
  const manualPreview = await readPreview(supported);
  const previewText = await supported.innerText();
  assert(previewText.includes('闪避'));
  assert.deepEqual(await storage(), before, 'Preview changed saved profiles or builds');
  await supported.click();
  assert.equal(await tableDamage(burnIndex, 2), manualPreview.damage, 'Selected artifact differs from its preview');
  await selectNone(attack);
  assert.equal(await tableDamage(burnIndex, 2), manualPreview.baseline, 'No-artifact baseline differs from actual removal');

  // Equipment-enabled previews must include the change in artifact base attack/HP.
  const usePreset = attack.locator('.build-use-toggle input');
  assert(await usePreset.isEnabled()); await usePreset.check();
  await page.waitForTimeout(600);
  const savedPreset = await storage();
  await openAuto();
  await skills.selectOption({ index: 0 });
  await hit.selectOption('normal');
  await page.getByPlaceholder('搜索神器', { exact: true }).fill('团结');
  const presetPreview = await readPreview(supported);
  assert.deepEqual(await storage(), savedPreset, 'Ranking mutated the equipment preset');
  await supported.click();
  assert.equal(await tableDamage(0, 2), presetPreview.damage);
  await selectNone(attack);
  assert.equal(await tableDamage(0, 2), presetPreview.baseline);

  // Current table variants, not hardcoded S1/S2/S3, form the selection menu.
  await selectHero('蕾诺娅');
  await disablePreset(attack);
  const bullets = attack.locator('.special-input').filter({ hasText: '镇魂子弹数量' }).locator('input');
  await enter(bullets, 7);
  const renoaLabels = await rows().locator('.skill-cell > span').allTextContents();
  await openAuto();
  const renoaOptions = await skills.locator('option').allTextContents();
  assert.equal(renoaOptions.length, renoaLabels.length);
  assert(renoaOptions.some(name => name.includes('(a)')) && renoaOptions.some(name => name.includes('(b)')));
  await skills.selectOption({ label: renoaOptions.find(name => name.includes('(b)')) });
  await hit.selectOption('miss');
  await assertSorted();
  await page.screenshot({ path: path.join(output, `${prefix}-renoa.png`), fullPage: true });
  // Closing / cancelling a calculation and re-opening must work without stale results.
  await page.keyboard.press('Escape');
  await attack.locator('.artifact-icon-button').click();
  await page.getByRole('button', { name: '快速筛选' }).click();
  await page.keyboard.press('Escape');
  await openAuto();
  assert.equal(await skills.locator('option').count(), renoaLabels.length);
  await page.getByRole('button', { name: '快速筛选' }).click();
  assert.equal(await page.locator('.artifact-auto-options').count(), 0);
  assert.equal(await page.locator('.artifact-increase').count(), 0);
  await page.keyboard.press('Escape');
  await expand(defense);
  await defense.locator('.artifact-icon-button').click();
  assert.equal(await page.getByRole('button', { name: '快速筛选' }).count(), 0);
  await page.keyboard.press('Escape');
  // Elite-monster artifacts remain manually selectable, but are absent from automatic comparison.
  await expand(attack);
  await attack.locator('.artifact-icon-button').click();
  const search = page.getByPlaceholder('搜索神器', { exact: true });
  await search.fill('特别的草莓蛋糕');
  assert.equal(await page.locator('.artifact-picker-list .picker-row').filter({ hasText: '特别的草莓蛋糕' }).count(), 1);
  await page.getByRole('button', { name: '快速筛选' }).click();
  await page.getByRole('status').filter({ hasText: '已按增伤排序' }).waitFor();
  for (const name of ['特别的草莓蛋糕', '共度的季节']) {
    await search.fill(name);
    assert.equal(await page.locator('.artifact-picker-list .picker-row').filter({ hasText: name }).count(), 0);
  }
  await page.getByRole('button', { name: '快速筛选' }).click();
  assert.equal(await page.locator('.artifact-picker-list .picker-row').filter({ hasText: '共度的季节' }).count(), 1);
  await page.keyboard.press('Escape');
  await selectHero('卡威利');
  await attack.locator('.artifact-icon-button').click();
  await search.fill('灿烂的永恒');
  const radiant = page.locator('.artifact-picker-list .picker-row').filter({ hasText: '灿烂的永恒' });
  assert.equal(await radiant.count(), 1);
  await page.getByRole('button', { name: '快速筛选' }).click();
  await page.getByRole('status').filter({ hasText: '已按增伤排序' }).waitFor();
  assert.equal(await radiant.count(), 0);
  await page.getByRole('button', { name: '快速筛选' }).click();
  assert.equal(await radiant.count(), 1);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  const report = { passed: true, elapsedMs, options, manualPreview, presetPreview, previewText, renoaOptions, monsterArtifactsExcluded: ['special_strawberry_cake', 'our_beautiful_seasons', 'radiant_forever'], penetrationCycle: { baseNormal, normalPenetration, greaterPenetration }, savedSettingsUnchangedByPreview: true, errors };
  await writeFile(path.join(output, `${prefix}-verification.json`), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] === import.meta.filename) {
  const root = path.resolve(import.meta.dirname, '..');
  const output = process.env.E7_ARTIFACT_UI_OUTPUT || path.join(root, 'test-screenshots/artifact-comparison');
  await mkdir(output, { recursive: true });
  const mobile = process.argv.includes('--mobile');
  const port = mobile ? '4273' : '4272';
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
  let browser, page;
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(url)).ok) break; } catch { /* Waiting for local preview. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: mobile ? 390 : 1580, height: mobile ? 900 : 1100 }, isMobile: mobile, hasTouch: mobile });
    await page.goto(url, { waitUntil: 'networkidle' });
    console.log(JSON.stringify(await verifyArtifactComparison(page, output), null, 2));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(output, 'browser-failure.png'), fullPage: true });
      await writeFile(path.join(output, 'browser-failure.txt'), await page.locator('body').innerText());
    }
    throw error;
  } finally {
    await browser?.close(); server.kill();
  }
}
