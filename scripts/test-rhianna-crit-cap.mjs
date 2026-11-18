import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { leaveCalculator, expandCalculatorPanel } from './calculator-test-navigation.mjs';

export async function verifyRhiannaCritCap(page, output, prefix = 'native') {
  await mkdir(output, { recursive: true });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await leaveCalculator(page);
  await page.evaluate(async () => {
    const profiles = { attacker: { rhianna_and_luciella: [{ useBuildPreset: false, attack: 2500, critDamage: 300,
      casterSpeed: 300, artifactId: 'noProc', artifactLevel: 30 }] }, defender: { abigail: [{
      useBuildPreset: false, targetMaxHP: 30000, targetDefense: 1500, defenderArtifactCode: '',
    }] }, active: { attacker: {}, defender: {} } };
    localStorage.clear();
    localStorage.setItem('epic7.tools.page.v1', 'calculator');
    localStorage.setItem('epic7.tools.calculatorHero.attacker.v1', 'rhianna_and_luciella');
    localStorage.setItem('epic7.tools.calculatorHero.defender.v1', 'abigail');
    localStorage.setItem('epic7.damageDesk.profiles.v1', JSON.stringify(profiles));
    if (window.__TAURI_INTERNALS__) await window.__TAURI_INTERNALS__.invoke('write_data_file', { name: 'profiles.json', contents: JSON.stringify(profiles) });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await expandCalculatorPanel(page, 'attack');
  const attack = page.locator('.combat-panel.attack');
  const critInput = attack.locator('.stat-field').filter({ has: page.locator('> span', { hasText: /^爆伤$/ }) }).locator('input.number-box');
  const speed = attack.locator('.special-input').filter({ has: page.locator('> span', { hasText: /^施法者的?速度$/ }) }).locator('input');
  const enter = async (input, value) => { await input.fill(String(value)); await input.press('Tab'); };
  const readCrit = () => page.locator('.damage-dock tbody tr').filter({ has: page.locator('.skill-cell') }).evaluateAll(rows =>
    rows.map(row => Number(row.querySelector('td:nth-child(2) .damage-value')?.textContent.replaceAll(',', ''))));
  const cappedRows = values => [1, 3, 4, 5].map(index => values[index]);
  await critInput.waitFor();
  assert.equal(await critInput.inputValue(), '300');
  const cap300 = await readCrit();
  assert(cap300.length >= 6);
  await enter(speed, 350);
  assert.deepEqual(await readCrit(), cap300, 'More speed increased damage past the cap');
  await enter(critInput, 250); await enter(speed, 300);
  const below = await readCrit();
  await enter(critInput, 319); await enter(speed, 70);
  assert.deepEqual(cappedRows(await readCrit()), cappedRows(below), '250 + 90 did not equal 319 + 21');
  await enter(critInput, 300); await enter(speed, 300);
  assert.deepEqual(await readCrit(), cap300);
  await attack.locator('.artifact-icon-button').click();
  await page.getByPlaceholder('搜索神器').fill('紧急升空');
  await page.locator('.picker-row').filter({ hasText: '紧急升空' }).click();
  const stacks = attack.locator('.special-input').filter({ has: page.locator('> span', { hasText: /攻击技能.*次数|攻击技能.*叠加|攻击技能使用/ }) }).locator('input');
  await enter(stacks, 6);
  const artifact = await readCrit();
  for (const index of [1, 3, 4, 5]) assert(Math.abs(artifact[index] / cap300[index] - 3.74 / 3.5) < .001, 'Artifact bonus was incorrectly capped');
  await page.screenshot({ path: path.join(output, `${prefix}-crit-cap.png`), fullPage: true });
  assert.deepEqual(errors, []);
  const report = { passed: true, cap300, artifact374: artifact, speedBonusCappedAt350: true, belowCapUnchanged: true, artifactsCanExceed350: true, errors };
  await writeFile(path.join(output, `${prefix}-verification.json`), JSON.stringify(report, null, 2));
  return report;
}
