import { gameDigitTemplates, normalizedGlyphHeight, normalizedGlyphWidth } from './gameDigitTemplates';
import { cropImageData, loadScreenshotCanvas } from './imageInput';
import type { EquipmentScreenshotRegions } from './layoutParser';
import type { RecognitionField, RecognizedTargetStats } from './types';

type Component = { x0: number; x1: number; y0: number; y1: number; count: number };
type GlyphResult = { char: string; confidence: number };

const templatePixels = Object.entries(gameDigitTemplates).flatMap(([char, variants]) => variants.map((hex) => ({ char, pixels: decodeHexBitmap(hex) })));
const decimalKeys = new Set<keyof RecognizedTargetStats>(['chc', 'chd', 'eff', 'efr']);

export async function recognizeTargetStats(dataUrl: string, regions: EquipmentScreenshotRegions) {
  const { canvas, context } = await loadScreenshotCanvas(dataUrl);
  const result: Partial<Record<keyof RecognizedTargetStats, RecognitionField<number>>> = {};
  for (const [key, rect] of Object.entries(regions.statValueRects) as Array<[keyof RecognizedTargetStats, NonNullable<typeof regions.statValueRects[keyof RecognizedTargetStats]>]>) {
    const image = cropImageData(context, canvas, rect, 0.16);
    result[key] = recognizeNumberImage(image, decimalKeys.has(key));
  }
  return result;
}

export function recognizeNumberImage(image: ImageData, decimal: boolean): RecognitionField<number> {
  const binary = foregroundMask(image);
  const components = connectedComponents(binary, image.width, image.height)
    .filter((component) => isDigitComponent(component, image.height) || isDecimalPoint(component, image.height))
    .sort((left, right) => left.x0 - right.x0);

  const glyphs = components.map((component) => isDecimalPoint(component, image.height)
    ? { char: '.', confidence: 0.99 }
    : recognizeNormalizedGlyph(normalizeComponent(binary, image.width, component)));

  const selected = decimal ? decimalGlyphs(glyphs) : glyphs.filter((glyph) => glyph.char !== '.');
  const text = selected.map((glyph) => glyph.char).join('');
  const value = Number(text);
  const confidence = selected.length ? selected.reduce((total, glyph) => total + glyph.confidence, 0) / selected.length : 0;
  return {
    value: Number.isFinite(value) && text.length ? value : null,
    confidence,
    source: 'digit-template',
  };
}

export function recognizeNormalizedGlyph(pixels: Uint8Array): GlyphResult {
  let best = { char: '', difference: Number.POSITIVE_INFINITY };
  for (const template of templatePixels) {
    let difference = 0;
    for (let index = 0; index < pixels.length; index += 1) {
      if (pixels[index] !== template.pixels[index]) difference += 1;
    }
    difference /= pixels.length;
    if (difference < best.difference) best = { char: template.char, difference };
  }
  return {
    char: best.char,
    confidence: Math.max(0, Math.min(1, 1 - best.difference / 0.5)),
  };
}

export function decodeHexBitmap(hex: string) {
  const output = new Uint8Array(normalizedGlyphWidth * normalizedGlyphHeight);
  let cursor = 0;
  for (const character of hex) {
    const value = Number.parseInt(character, 16);
    for (let bit = 3; bit >= 0 && cursor < output.length; bit -= 1) output[cursor++] = (value >> bit) & 1;
  }
  return output;
}

function foregroundMask(image: ImageData) {
  const output = new Uint8Array(image.width * image.height);
  for (let index = 0; index < output.length; index += 1) {
    const red = image.data[index * 4];
    const green = image.data[index * 4 + 1];
    const blue = image.data[index * 4 + 2];
    const white = red > 120 && green > 120 && blue > 115 && Math.max(red, green, blue) - Math.min(red, green, blue) < 78;
    const cappedRed = red > 112 && red > green * 1.45 && red > blue * 1.2 && blue >= green * 0.58;
    output[index] = white || cappedRed ? 1 : 0;
  }
  return output;
}

function connectedComponents(binary: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(binary.length);
  const components: Component[] = [];
  for (let start = 0; start < binary.length; start += 1) {
    if (!binary[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let x0 = width; let x1 = 0; let y0 = height; let y1 = 0; let count = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); count += 1;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nextX = x + dx; const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (binary[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
      }
    }
    if (count >= 2) components.push({ x0, x1, y0, y1, count });
  }
  return components;
}

function isDigitComponent(component: Component, height: number) {
  return component.y1 - component.y0 + 1 >= Math.max(8, height * 0.28) && component.y0 < height * 0.82;
}

function isDecimalPoint(component: Component, height: number) {
  const width = component.x1 - component.x0 + 1;
  const componentHeight = component.y1 - component.y0 + 1;
  return width >= 2 && width <= height * 0.16
    && componentHeight >= 2 && componentHeight <= height * 0.16
    && component.y0 > height * 0.48 && component.y0 < height * 0.82;
}

function normalizeComponent(binary: Uint8Array, width: number, component: Component) {
  const output = new Uint8Array(normalizedGlyphWidth * normalizedGlyphHeight);
  const sourceWidth = component.x1 - component.x0 + 1;
  const sourceHeight = component.y1 - component.y0 + 1;
  const scale = Math.min((normalizedGlyphWidth - 2) / sourceWidth, (normalizedGlyphHeight - 2) / sourceHeight);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const offsetX = Math.floor((normalizedGlyphWidth - targetWidth) / 2);
  const offsetY = Math.floor((normalizedGlyphHeight - targetHeight) / 2);
  for (let y = 0; y < targetHeight; y += 1) for (let x = 0; x < targetWidth; x += 1) {
    const sourceX = component.x0 + Math.min(sourceWidth - 1, Math.floor(x / scale));
    const sourceY = component.y0 + Math.min(sourceHeight - 1, Math.floor(y / scale));
    output[(offsetY + y) * normalizedGlyphWidth + offsetX + x] = binary[sourceY * width + sourceX];
  }
  return output;
}

function decimalGlyphs(glyphs: GlyphResult[]) {
  const decimalIndex = glyphs.findIndex((glyph) => glyph.char === '.');
  if (decimalIndex < 0) return glyphs.filter((glyph) => glyph.char !== '.');
  return [...glyphs.slice(0, decimalIndex), glyphs[decimalIndex], ...glyphs.slice(decimalIndex + 1).filter((glyph) => glyph.char !== '.').slice(0, 1)];
}
