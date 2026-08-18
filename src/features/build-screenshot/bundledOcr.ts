import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { ImageRect, OcrLayout, OcrLine } from './types';

let workerPromise: Promise<Worker> | null = null;

export async function readBundledOcrLayout(canvas: HTMLCanvasElement): Promise<OcrLayout> {
  const worker = await getWorker();
  const width = canvas.width;
  const height = canvas.height;
  const leftRegion = { left: 0, top: 0, width: Math.round(width * 0.39), height };
  const leftResult = await worker.recognize(canvas, { rectangle: leftRegion }, { text: true, blocks: true });
  const heroName = await recognizeHeroName(worker, canvas);
  const artifactLevel = await recognizeArtifactLevel(worker, canvas);
  const lines = [...resultLines(leftResult.data.blocks, leftRegion)];
  if (heroName.text) {
    lines.push({
      text: heroName.text,
      words: [{ text: heroName.text, rect: heroName.rect }],
      rect: heroName.rect,
    });
  }
  if (artifactLevel.text) {
    lines.push({
      text: artifactLevel.text,
      words: [{ text: artifactLevel.text, rect: artifactLevel.rect }],
      rect: artifactLevel.rect,
    });
  }
  return {
    width,
    height,
    text: `${leftResult.data.text}\n${heroName.text}\n${artifactLevel.debugText || artifactLevel.text}`,
    lines: lines.filter((line) => line.text),
  };
}

async function recognizeHeroName(worker: Worker, canvas: HTMLCanvasElement) {
  const rect = {
    x: Math.round(canvas.width * 0.012),
    y: Math.round(canvas.height * 0.055),
    width: Math.round(canvas.width * 0.34),
    height: Math.round(canvas.height * 0.105),
  };
  const crop = binaryWhiteTextCrop(canvas, rect, 3);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: '',
  });
  const result = await worker.recognize(crop, {}, { text: true });
  return {
    text: result.data.text.replace(/\s+/g, '').trim(),
    rect,
  };
}

async function recognizeArtifactLevel(worker: Worker, canvas: HTMLCanvasElement) {
  const rect = {
    x: Math.round(canvas.width * 0.91),
    y: Math.round(canvas.height * 0.05),
    width: Math.round(canvas.width * 0.085),
    height: Math.round(canvas.height * 0.13),
  };
  const crop = binaryWhiteTextCrop(canvas, rect, 4);
  if (!crop.width) return { text: '', rect };
  const context = crop.getContext('2d', { willReadFrequently: true });
  if (!context) return { text: '', rect };
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: '+0123456789',
  });
  const result = await worker.recognize(crop, {}, { text: true });
  const tightDigits = result.data.text.replace(/[^\d]/g, '').slice(0, 2);
  let text = tightDigits.length === 2 ? tightDigits : '';
  let debugText = result.data.text;
  if (!text) {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: '',
    });
    const broad = await worker.recognize(canvas, {
      rectangle: {
        left: Math.round(canvas.width * 0.80),
        top: 0,
        width: Math.round(canvas.width * 0.20),
        height: Math.round(canvas.height * 0.24),
      },
    }, { text: true });
    debugText = broad.data.text;
    text = broad.data.text
      .split(/\s+/)
      .map((part) => part.replace(/[^\d]/g, ''))
      .find((part) => /^\d{2}$/.test(part) && Number(part) <= 30) || tightDigits;
  }
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: '',
  });
  return {
    text,
    rect,
    debugText,
  };
}

function binaryWhiteTextCrop(canvas: HTMLCanvasElement, rect: ImageRect, scale: number) {
  const crop = document.createElement('canvas');
  crop.width = rect.width * scale;
  crop.height = rect.height * scale;
  const context = crop.getContext('2d', { willReadFrequently: true });
  if (!context) return crop;
  context.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, crop.width, crop.height);
  const pixels = context.getImageData(0, 0, crop.width, crop.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const nearWhite = Math.min(red, green, blue) > 155 && Math.max(red, green, blue) - Math.min(red, green, blue) < 58;
    const value = nearWhite ? 0 : 255;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return crop;
}

function resultLines(
  blocks: Awaited<ReturnType<Worker['recognize']>>['data']['blocks'],
  region: { left: number; top: number },
) {
  const lines: OcrLine[] = [];
  for (const block of blocks || []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const offsetX = line.bbox.x0 < region.left * 0.5 ? region.left : 0;
        const offsetY = line.bbox.y0 < region.top * 0.5 ? region.top : 0;
        lines.push({
          text: line.text.trim(),
          words: line.words.map((word) => ({
            text: word.text.trim(),
            rect: fromBbox(word.bbox, offsetX, offsetY),
          })),
          rect: fromBbox(line.bbox, offsetX, offsetY),
        });
      }
    }
  }
  return lines;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('chi_sim', OEM.LSTM_ONLY, {
      workerPath: '/assets/ocr/worker.min.js',
      corePath: '/assets/ocr/tesseract-core-simd-lstm.wasm.js',
      langPath: '/assets/ocr',
      gzip: true,
      logger: () => undefined,
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
        user_defined_dpi: '150',
      });
      return worker;
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function fromBbox(bbox: { x0: number; y0: number; x1: number; y1: number }, offsetX = 0, offsetY = 0): ImageRect {
  return {
    x: bbox.x0 + offsetX,
    y: bbox.y0 + offsetY,
    width: bbox.x1 - bbox.x0,
    height: bbox.y1 - bbox.y0,
  };
}
