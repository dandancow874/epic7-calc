import type { LibraryArtifact, LibraryRole } from '../../library/types';
import { loadScreenshotCanvas } from './imageInput';
import type { ImageRect, RecognitionField, RecognizedArtifact } from './types';

type TemplatePixels = { rgb: Uint8ClampedArray; alpha: Uint8ClampedArray };
const templateCache = new Map<string, Promise<TemplatePixels>>();

export async function matchArtifactIcon(dataUrl: string, searchRect: ImageRect, artifacts: LibraryArtifact[], role?: LibraryRole): Promise<RecognitionField<RecognizedArtifact>> {
  const { canvas, context } = await loadScreenshotCanvas(dataUrl);
  const screenshot = screenshotSearchPixels(context, searchRect);
  const candidates = artifacts.filter((artifact) => artifact.image && (!role || artifact.role === 'common' || artifact.role === role));
  const scored = (await Promise.all(candidates.map(async (artifact) => ({
    artifact,
    confidence: 1 - await templateDistance(screenshot, artifact.image!),
  }))))
    .filter((candidate) => Number.isFinite(candidate.confidence))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);
  const best = scored[0];
  const certain = best && best.confidence >= 0.72 && (!scored[1] || best.confidence - scored[1].confidence >= 0.015);
  return {
    value: certain ? artifactValue(best.artifact) : null,
    confidence: best?.confidence || 0,
    source: 'icon-match',
    alternatives: scored.map((candidate) => ({ value: artifactValue(candidate.artifact), confidence: candidate.confidence })),
  };
}

function artifactValue(artifact: LibraryArtifact): RecognizedArtifact {
  return { artifactCode: artifact.code, displayName: artifact.name };
}

function screenshotSearchPixels(context: CanvasRenderingContext2D, rect: ImageRect) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const output = canvas.getContext('2d', { willReadFrequently: true })!;
  output.drawImage(context.canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, size, size);
  return output.getImageData(0, 0, size, size).data;
}

async function templateDistance(screenshot: Uint8ClampedArray, path: string) {
  const template = await artifactTemplate(path);
  let best = Number.POSITIVE_INFINITY;
  for (const targetSize of [34, 38, 42, 46]) {
    for (let offsetY = 7; offsetY <= Math.min(28, 64 - targetSize); offsetY += 3) {
      for (let offsetX = 14; offsetX <= 64 - targetSize; offsetX += 3) {
        let difference = 0;
        let samples = 0;
        for (let y = Math.floor(targetSize * 0.26); y < targetSize; y += 1) for (let x = 0; x < targetSize; x += 1) {
          const templateX = Math.min(31, Math.floor(x * 32 / targetSize));
          const templateY = Math.min(31, Math.floor(y * 32 / targetSize));
          const templateIndex = templateY * 32 + templateX;
          if (template.alpha[templateIndex] < 90) continue;
          const screenshotIndex = ((offsetY + y) * 64 + offsetX + x) * 4;
          const templateRgb = templateIndex * 3;
          difference += Math.abs(screenshot[screenshotIndex] - template.rgb[templateRgb]);
          difference += Math.abs(screenshot[screenshotIndex + 1] - template.rgb[templateRgb + 1]);
          difference += Math.abs(screenshot[screenshotIndex + 2] - template.rgb[templateRgb + 2]);
          samples += 3;
        }
        if (samples) best = Math.min(best, difference / samples / 255);
      }
    }
  }
  return Math.min(1, best);
}

function artifactTemplate(path: string) {
  let current = templateCache.get(path);
  if (!current) {
    current = loadImage(path).then((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      const rgb = new Uint8ClampedArray(32 * 32 * 3);
      const alpha = new Uint8ClampedArray(32 * 32);
      for (let index = 0; index < 32 * 32; index += 1) {
        rgb[index * 3] = pixels[index * 4];
        rgb[index * 3 + 1] = pixels[index * 4 + 1];
        rgb[index * 3 + 2] = pixels[index * 4 + 2];
        alpha[index] = pixels[index * 4 + 3];
      }
      return { rgb, alpha };
    });
    templateCache.set(path, current);
  }
  return current;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`cannot load artifact icon: ${src}`));
    image.src = src;
  });
}
