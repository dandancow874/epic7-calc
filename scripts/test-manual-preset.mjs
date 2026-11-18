import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { leaveCalculator, expandCalculatorPanel } from './calculator-test-navigation.mjs';

export async function verifyManualPreset(page, output, prefix = 'browser') {
  await mkdir(output, { recursive: true });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await leaveCalculator(page);
  const original = await page.evaluate(async () => {
    const community = await (await fetch('/library/presets.json')).json();
    const template = { id: 'test-original', heroCode: 'genesis-ras', name: '参考配置', source: 'manual', sets: ['set_cri_dmg', 'set_penetrate'], artifactCode: null,
      targetStats: { atk: 3000, hp: 26000, def: 1400, spd: 210, chc: 100, chd: 280, eff: 40, efr: 80, gs: 0 }, updatedAt: '2026-11-18T00:00:00Z' };
    const presets = { manual: { 'genesis-ras': [template] }, communityOverrides: {}, hiddenCommunity: community.map(preset => preset.heroCode) };
    const profiles = { attacker: { genesis_ras: [{ useBuildPreset: false, attack: 2961, critDamage: 346, casterMaxHP: 27656,
      artifactId: 'daydream_joker', artifactLevel: 24, torrentSetStack: 1, penetrationSet: false, attackIncrease: 8, casterHasSuperhumanization: true }] },
      defender: { lisette: [{ useBuildPreset: false, targetMaxHP: 25000, targetDefense: 1800, defenderArtifactCode: '', targetDivinityStack: 0 }] }, active: { attacker: {}, defender: {} } };
    localStorage.clear();
    localStorage.setItem('epic7.tools.page.v1', 'calculator');
    localStorage.setItem('epic7.tools.calculatorHero.attacker.v1', 'genesis_ras');
    localStorage.setItem('epic7.tools.calculatorHero.defender.v1', 'lisette');
    localStorage.setItem('epic7.tools.buildPresets.v1', JSON.stringify(presets));
    localStorage.setItem('epic7.damageDesk.profiles.v1', JSON.stringify(profiles));
    if (window.__TAURI_INTERNALS__) {
      for (const [name, value] of [['build-presets.json', presets], ['profiles.json', profiles]])
        await window.__TAURI_INTERNALS__.invoke('write_data_file', { name, contents: JSON.stringify(value) });
    }
    return template;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await expandCalculatorPanel(page, 'attack');
  const attack = page.locator('.combat-panel.attack'), defense = page.locator('.combat-panel.defense');
  const field = (panel, label) => panel.locator('.stat-field').filter({ has: page.locator('> span', { hasText: new RegExp(`^${label}$`) }) }).locator('.number-box');
  const enter = async (input, value) => { await input.fill(String(value)); await input.press('Tab'); };
  const chip = (panel, text) => panel.getByRole('button', { name: new RegExp(text) }).filter({ has: page.locator('.checkmark') });
  const table = () => page.locator('.damage-dock tbody').innerText();
  const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('epic7.tools.buildPresets.v1')));
  const waitValue = async (locator, value) => {
    const read = () => locator.evaluate(element => element.tagName === 'INPUT' ? element.value : element.textContent);
    for (let n = 0; n < 60; n++) { if (await read() === String(value)) return; await page.waitForTimeout(50); }
    assert.equal(await read(), String(value));
  };
  await waitValue(field(attack, '攻击'), 2961);
  const before = await table();
  await attack.locator('.calculator-build-select').click();
  await page.getByRole('button', { name: '当前面板存为新预设' }).click();
  const dialog = page.getByRole('form', { name: '保存装备预设' });
  assert.equal(await dialog.getByRole('spinbutton', { name: '攻击', exact: true }).inputValue(), '2961');
  assert.equal(await dialog.getByRole('spinbutton', { name: '生命', exact: true }).inputValue(), '27656');
  assert.equal(await dialog.getByRole('spinbutton', { name: '速度', exact: true }).inputValue(), '210');
  assert((await dialog.innerText()).includes('白日梦小丑'));
  assert((await dialog.innerText()).includes('+24'));
  assert((await dialog.innerText()).includes('激流套'));
  await dialog.getByRole('textbox', { name: '预设名称' }).fill('手动拉斯');
  await page.screenshot({ path: path.join(output, `${prefix}-snapshot.png`) });
  await dialog.getByRole('button', { name: '保存并使用' }).click();
  await dialog.waitFor({ state: 'detached' });
  assert(await attack.locator('.build-use-toggle input').isChecked());
  assert.equal(await table(), before, 'Saving the panel changed its damage');
  let db = await readDb();
  assert.deepEqual(db.manual['genesis-ras'].find(preset => preset.id === original.id), original);
  const saved = db.manual['genesis-ras'].find(preset => preset.name === '手动拉斯');
  assert(saved);
  assert.deepEqual(saved.sets, ['set_cri_dmg', 'set_torrent']);
  assert.equal(saved.artifactCode, 'daydream-joker');
  assert.equal(saved.artifactLevel, 24);
  assert.equal(saved.targetStats.def, 1400);
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' });
  await expandCalculatorPanel(page, 'attack');
  await waitValue(field(attack, '攻击'), 2961);
  assert((await attack.locator('.calculator-build-select').innerText()).includes('手动拉斯'));

  // A defender without any equipment template can save a partial first preset.
  await expandCalculatorPanel(page, 'defense');
  await defense.locator('.calculator-build-select').click();
  await page.getByRole('button', { name: '当前面板存为新预设' }).click();
  assert.equal(await dialog.getByRole('spinbutton', { name: '攻击', exact: true }).inputValue(), '');
  assert.equal(await dialog.getByRole('spinbutton', { name: '速度', exact: true }).inputValue(), '');
  assert.equal(await dialog.getByRole('spinbutton', { name: '生命', exact: true }).inputValue(), '25000');
  await dialog.getByRole('textbox', { name: '预设名称' }).fill('第一份防守预设');
  await dialog.getByRole('button', { name: '保存并使用' }).click();
  await dialog.waitFor({ state: 'detached' });
  await waitValue(field(defense, '生命'), 25000);
  db = await readDb();
  assert(db.manual.lisette[0].missingStats.includes('atk'));
  assert(db.manual.lisette[0].missingStats.includes('spd'));

  await defense.locator('.build-use-toggle input').uncheck();
  await chip(defense, '守护套').click();
  await waitValue(field(defense, '防护罩'), 3000);
  await enter(field(defense, '生命'), 20000);
  await waitValue(field(defense, '防护罩'), 2400);
  const plainDamage = await table();
  await chip(defense, '超人化').click();
  await waitValue(field(defense, '防护罩'), 4800);
  assert.notEqual(await table(), plainDamage, 'Superhumanization did not reach Daydream Joker damage');
  for (let i = 0; i < 4; i++) await chip(defense, '神圣').click();
  await waitValue(field(defense, '防护罩'), 8640);
  await page.screenshot({ path: path.join(output, `${prefix}-defender.png`), fullPage: true });
  await chip(defense, '守护套').click();
  await waitValue(field(defense, '防护罩'), 0);
  const ratio = defense.getByRole('textbox', { name: '防护罩比例', exact: true });
  await enter(ratio, 10);
  await waitValue(field(defense, '防护罩'), 7200);
  await enter(ratio, 12.5);
  await waitValue(field(defense, '防护罩'), 9000);
  await enter(field(defense, '生命'), 25000);
  await waitValue(field(defense, '防护罩'), 11250);
  await enter(field(defense, '防护罩'), 1234);
  await enter(field(defense, '生命'), 20000);
  await waitValue(field(defense, '防护罩'), 1234);
  await page.screenshot({ path: path.join(output, `${prefix}-barrier-ratio.png`), fullPage: true });

  // Over-cap equipment must be reviewed; cancelling creates no preset.
  await expandCalculatorPanel(page, 'attack');
  await attack.locator('.build-use-toggle input').uncheck();
  await chip(attack, '穿透套').click();
  await attack.locator('.calculator-build-select').click();
  await page.getByRole('button', { name: '当前面板存为新预设' }).click();
  await dialog.getByRole('alert').waitFor();
  assert(await dialog.getByRole('button', { name: '保存并使用' }).isDisabled());
  const count = (await readDb()).manual['genesis-ras'].length;
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal((await readDb()).manual['genesis-ras'].length, count);
  await page.locator('.build-preset-modal').getByRole('button', { name: '关闭', exact: true }).click();
  assert.deepEqual(errors, []);
  const report = { passed: true, existingPresetUnchanged: true, savedDamageUnchanged: true, firstPresetKeepsUnknownStats: true,
    shieldValues: [3000, 2400, 4800, 8640, 0], percentageShieldValues: [7200, 9000, 11250], manualFixedShield: 1234, superhumanizationAffectsJoker: true, overfullSetsBlocked: true, errors };
  await writeFile(path.join(output, `${prefix}-verification.json`), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] === import.meta.filename) {
  const output = path.resolve('artifacts/manual-preset-2026-11-18/ui');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1580, height: 1100 } });
  try {
    await page.goto(process.env.E7_TEST_URL || 'http://127.0.0.1:5193', { waitUntil: 'networkidle' });
    console.log(JSON.stringify(await verifyManualPreset(page, output), null, 2));
  } catch (error) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText());
    throw error;
  } finally { await browser.close(); }
}
