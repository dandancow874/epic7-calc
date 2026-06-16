import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const target = process.argv[2] || path.resolve('test-screenshots');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

if (!existsSync(target)) {
  console.error(`Folder or image not found: ${target}`);
  process.exit(1);
}

const files = statSync(target).isDirectory()
  ? readdirSync(target)
    .map((name) => path.join(target, name))
    .filter((file) => !path.basename(file).startsWith('_') && imageExtensions.has(path.extname(file).toLowerCase()))
  : [target];

if (!files.length) {
  console.error(`No screenshots found in: ${target}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto('http://127.0.0.1:5174', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '速度推算' }).click();

const results = [];
for (const file of files) {
  await page.locator('.screenshot-actions .ghost-button').click().catch(() => {});
  await page.waitForTimeout(100);
  const fileInput = await page.evaluateHandle(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    return input;
  });
  await fileInput.asElement().setInputFiles(file);
  await page.evaluate(async (input) => {
    const file = input.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    input.remove();
  }, fileInput);
  await page.waitForTimeout(900);
  const state = await page.locator('.ocr-state').innerText().catch(() => '');
  const chips = await page.locator('.ocr-chips span').allInnerTexts().catch(() => []);
  const values = await page.locator('.speed-row input').evaluateAll((nodes) => nodes.map((node) => node.value));
  results.push({
    file: path.basename(file),
    state,
    chips,
    allyCr: values.slice(1, 8).filter((_, index) => index % 2 === 0),
    enemyCr: values.slice(8, 12),
  });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
