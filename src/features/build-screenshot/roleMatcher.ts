import type { LibraryRole } from '../../library/types';
import { loadScreenshotCanvas } from './imageInput';

const roles: LibraryRole[] = ['knight', 'warrior', 'ranger', 'thief', 'mage', 'soul_weaver'];
const roleTemplates = new Map<LibraryRole, Promise<Uint8Array>>();

export async function matchHeroRole(dataUrl: string): Promise<LibraryRole | null> {
  const { canvas, context } = await loadScreenshotCanvas(dataUrl);
  const search = {
    x: Math.round(canvas.width * 0.09),
    y: 0,
    width: Math.round(canvas.width * 0.23),
    height: Math.round(canvas.height * 0.10),
  };
  const pixels = context.getImageData(search.x, search.y, search.width, search.height).data;
  const scored = await Promise.all(roles.map(async (role) => ({
    role,
    confidence: 1 - maskDistance(pixels, search.width, search.height, await loadRoleTemplate(role)),
  })));
  scored.sort((left, right) => right.confidence - left.confidence);
  return scored[0]?.confidence >= 0.62 && scored[0].confidence - (scored[1]?.confidence || 0) >= 0.035
    ? scored[0].role
    : null;
}

function maskDistance(screenshot: Uint8ClampedArray, width: number, height: number, template: Uint8Array) {
  let best = 1;
  for (const size of [24, 28, 32, 36]) {
    for (let y = 8; y <= Math.min(height - size, 60); y += 2) {
      for (let x = 0; x <= width - size; x += 2) {
        let mismatch = 0;
        let union = 0;
        for (let targetY = 0; targetY < size; targetY += 1) {
          for (let targetX = 0; targetX < size; targetX += 1) {
            const templateX = Math.min(31, Math.floor(targetX * 32 / size));
            const templateY = Math.min(31, Math.floor(targetY * 32 / size));
            const expected = template[templateY * 32 + templateX] === 1;
            const index = ((y + targetY) * width + x + targetX) * 4;
            const red = screenshot[index];
            const green = screenshot[index + 1];
            const blue = screenshot[index + 2];
            const observed = Math.min(red, green, blue) > 145 && Math.max(red, green, blue) - Math.min(red, green, blue) < 85;
            if (expected || observed) union += 1;
            if (expected !== observed) mismatch += 1;
          }
        }
        if (union) best = Math.min(best, mismatch / union);
      }
    }
  }
  return best;
}

function loadRoleTemplate(role: LibraryRole) {
  let current = roleTemplates.get(role);
  if (!current) {
    current = loadImage(`/assets/classes/${role}.png`).then((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      const mask = new Uint8Array(32 * 32);
      for (let index = 0; index < mask.length; index += 1) {
        mask[index] = pixels[index * 4 + 3] > 80 && Math.min(pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2]) > 130 ? 1 : 0;
      }
      return mask;
    });
    roleTemplates.set(role, current);
  }
  return current;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`cannot load class icon: ${src}`));
    image.src = src;
  });
}
