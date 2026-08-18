import type { ImageRect } from './types';

const maxImagePixels = 3840 * 2160 * 2;

export async function loadScreenshotCanvas(dataUrl: string) {
  if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(dataUrl)) throw new Error('unsupported image format');
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height || width * height > maxImagePixels) throw new Error('image dimensions are invalid or too large');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('canvas is unavailable');
  context.drawImage(image, 0, 0);
  return { canvas, context };
}

export function cropImageData(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rect: ImageRect, padding = 0.18) {
  const padX = rect.width * padding;
  const padY = rect.height * padding;
  const x = Math.max(0, Math.floor(rect.x - padX));
  const y = Math.max(0, Math.floor(rect.y - padY));
  const right = Math.min(canvas.width, Math.ceil(rect.x + rect.width + padX));
  const bottom = Math.min(canvas.height, Math.ceil(rect.y + rect.height + padY));
  return context.getImageData(x, y, Math.max(1, right - x), Math.max(1, bottom - y));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('cannot decode image'));
    image.src = src;
  });
}

