export async function leaveCalculator(page) {
  const heroes = page.getByRole('button', { name: '角色图鉴', exact: true });
  if (await heroes.count()) await heroes.click();
  else {
    const menu = page.getByRole('button', { name: '打开工具导航', exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('button', { name: /^角色装备/ }).click();
  }
  await page.locator('.combat-panel').waitFor({ state: 'detached' });
}

export async function expandCalculatorPanel(page, side) {
  const summary = page.locator(`.mobile-combatant.${side} .mobile-combatant__summary`);
  if (await summary.isVisible()) await summary.click();
}
