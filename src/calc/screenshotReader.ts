export type ReadinessRow = {
  cr: number;
  side: 'ally' | 'enemy';
  y: number;
};

export type ReadinessReadResult = {
  rows: ReadinessRow[];
  allies: number[];
  enemies: number[];
};

type Band = {
  y0: number;
  y1: number;
};

type Template = {
  value: number;
  width: number;
  height: number;
  pixels: Uint8Array;
};

const TEXT_LEFT_RATIO = 0.22;
const TEXT_RIGHT_RATIO = 0.96;
const TEMPLATE_HEIGHT = 42;
const CR_VALUES = Array.from({ length: 101 }, (_, index) => index);
const TEMPLATE_FONTS = [
  '700 42px Arial',
  '700 42px "Microsoft YaHei UI"',
  '700 42px "Segoe UI"',
  '700 42px Tahoma',
  '600 42px Arial',
  '800 42px Arial',
  '700 44px Arial',
  '700 40px Arial',
];
let templates: Template[] | null = null;

export async function readReadinessFromScreenshot(dataUrl: string): Promise<ReadinessReadResult> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return emptyResult();
  context.drawImage(image, 0, 0);

  const rows = fastReadRows(context, canvas.width, canvas.height)
    .filter((row) => row.cr >= 10 && row.cr <= 100)
    .sort((a, b) => a.y - b.y);

  return {
    rows,
    allies: rows.filter((row) => row.side === 'ally').map((row) => row.cr).sort((a, b) => b - a),
    enemies: rows.filter((row) => row.side === 'enemy').map((row) => row.cr).sort((a, b) => b - a),
  };
}

function fastReadRows(context: CanvasRenderingContext2D, width: number, height: number): ReadinessRow[] {
  const image = context.getImageData(0, 0, width, height);
  const textLeft = Math.round(width * TEXT_LEFT_RATIO);
  const textRight = Math.round(width * TEXT_RIGHT_RATIO);
  const bands = findTextBands(image, width, height, textLeft, textRight);
  return bands
    .map((band) => {
      const crop = cropTextBand(image, width, height, band, textLeft, textRight);
      const cr = crop ? matchCrValue(crop) : null;
      if (cr == null) return null;
      const y = (band.y0 + band.y1) / 2;
      return {
        cr,
        y,
        side: classifySide(context, width, y),
      };
    })
    .filter(Boolean) as ReadinessRow[];
}

function findTextBands(image: ImageData, width: number, height: number, x0: number, x1: number) {
  const rowInk: number[] = [];
  for (let y = 0; y < height; y += 1) {
    let ink = 0;
    for (let x = x0; x < x1; x += 1) {
      if (isTextPixel(image, width, x, y)) ink += 1;
    }
    rowInk.push(ink);
  }

  const threshold = Math.max(3, Math.round((x1 - x0) * 0.012));
  const rawBands: Band[] = [];
  let start = -1;
  for (let y = 0; y < height; y += 1) {
    if (rowInk[y] >= threshold && start === -1) start = y;
    if ((rowInk[y] < threshold || y === height - 1) && start !== -1) {
      const end = y;
      if (end - start >= 10) rawBands.push({ y0: start, y1: end });
      start = -1;
    }
  }

  const merged: Band[] = [];
  for (const band of rawBands) {
    const previous = merged[merged.length - 1];
    if (previous && band.y0 - previous.y1 < 18) previous.y1 = band.y1;
    else merged.push({ ...band });
  }
  return merged
    .filter((band) => band.y1 - band.y0 >= 14)
    .sort((a, b) => a.y0 - b.y0)
    .slice(0, 8);
}

function cropTextBand(image: ImageData, width: number, height: number, band: Band, searchLeft: number, searchRight: number) {
  const y0 = Math.max(0, band.y0 - 6);
  const y1 = Math.min(height - 1, band.y1 + 6);
  const numberBounds = findNumberBounds(image, width, y0, y1, searchLeft, searchRight);
  if (!numberBounds) return null;
  const { xMin, xMax } = numberBounds;

  const cropWidth = xMax - xMin + 9;
  const cropHeight = y1 - y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const output = context.createImageData(cropWidth, cropHeight);
  output.data.fill(255);

  for (let y = 0; y < cropHeight; y += 1) {
    for (let x = 0; x < cropWidth; x += 1) {
      const sourceX = xMin + x - 4;
      const sourceY = y0 + y;
      const target = (y * cropWidth + x) * 4;
      if (sourceX >= 0 && sourceX < width && isTextPixel(image, width, sourceX, sourceY)) {
        output.data[target] = 0;
        output.data[target + 1] = 0;
        output.data[target + 2] = 0;
      }
      output.data[target + 3] = 255;
    }
  }
  context.putImageData(output, 0, 0);
  return trimBinaryCanvas(canvas);
}

function findNumberBounds(image: ImageData, width: number, y0: number, y1: number, searchLeft: number, searchRight: number) {
  const columnInk: number[] = [];
  for (let x = searchLeft; x < searchRight; x += 1) {
    let ink = 0;
    for (let y = y0; y <= y1; y += 1) {
      if (isTextPixel(image, width, x, y)) ink += 1;
    }
    columnInk.push(ink);
  }

  const threshold = Math.max(2, Math.round((y1 - y0) * 0.08));
  const clusters: Array<{ x0: number; x1: number }> = [];
  let start = -1;
  let lastInk = -1;

  for (let index = 0; index < columnInk.length; index += 1) {
    if (columnInk[index] >= threshold) {
      if (start === -1) start = index;
      lastInk = index;
    }

    const gap = start === -1 ? 0 : index - lastInk;
    if ((start !== -1 && gap > 6) || (index === columnInk.length - 1 && start !== -1)) {
      const end = lastInk;
      if (end - start >= 2) clusters.push({ x0: searchLeft + start, x1: searchLeft + end });
      start = -1;
      lastInk = -1;
    }
  }

  if (!clusters.length) return null;
  let usable = clusters;
  if (clusters.length >= 2) {
    const hourglassIndex = clusters.findIndex((cluster, index) => {
      const next = clusters[index + 1];
      const clusterWidth = cluster.x1 - cluster.x0 + 1;
      const gapToNext = next ? next.x0 - cluster.x1 : Number.POSITIVE_INFINITY;
      return cluster.x0 > width * 0.35 && clusterWidth >= 18 && clusterWidth <= 30 && gapToNext >= 5 && gapToNext <= 24;
    });
    if (hourglassIndex >= 0 && clusters[hourglassIndex + 1]) {
      usable = clusters.slice(hourglassIndex + 1);
    } else {
      const first = clusters[0];
      const second = clusters[1];
      const firstWidth = first.x1 - first.x0 + 1;
      const gap = second.x0 - first.x1;
      if (firstWidth >= 16 && gap >= 8) {
        usable = clusters.slice(1);
      }
    }
  }

  return {
    xMin: Math.max(searchLeft, usable[0].x0 - 2),
    xMax: Math.min(searchRight - 1, usable[usable.length - 1].x1 + 2),
  };
}

function matchCrValue(canvas: HTMLCanvasElement) {
  const normalized = normalizeBinaryCanvas(canvas, TEMPLATE_HEIGHT);
  let best = { value: 0, score: Number.POSITIVE_INFINITY };
  for (const template of getTemplates()) {
    const score = compareCanvases(normalized, template);
    if (score < best.score) best = { value: template.value, score };
  }
  return best.score < 0.42 ? best.value : null;
}

function compareCanvases(canvas: HTMLCanvasElement, template: Template) {
  const resized = resizeBinaryCanvas(canvas, template.width, template.height);
  const context = resized.getContext('2d');
  if (!context) return Number.POSITIVE_INFINITY;
  const data = context.getImageData(0, 0, template.width, template.height).data;
  let diff = 0;
  for (let i = 0; i < template.pixels.length; i += 1) {
    const actual = data[i * 4] < 128 ? 1 : 0;
    if (actual !== template.pixels[i]) diff += 1;
  }
  return diff / template.pixels.length;
}

function getTemplates() {
  if (templates) return templates;
  templates = CR_VALUES.flatMap((value) => TEMPLATE_FONTS.map((font) => createTemplate(value, font)));
  return templates;
}

function createTemplate(value: number, font: string): Template {
  const text = `${value}%`;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return { value, width: 1, height: 1, pixels: new Uint8Array([0]) };
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  context.font = font;
  context.textBaseline = 'middle';
  context.fillText(text, 2, canvas.height / 2 + 1);
  const trimmed = normalizeBinaryCanvas(trimBinaryCanvas(canvas), TEMPLATE_HEIGHT);
  const data = trimmed.getContext('2d')!.getImageData(0, 0, trimmed.width, trimmed.height).data;
  const pixels = new Uint8Array(trimmed.width * trimmed.height);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = data[i * 4] < 128 ? 1 : 0;
  }
  return { value, width: trimmed.width, height: trimmed.height, pixels };
}

function trimBinaryCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  let xMin = canvas.width;
  let xMax = 0;
  let yMin = canvas.height;
  let yMax = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (image.data[offset] >= 128) continue;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  if (xMax <= xMin || yMax <= yMin) return canvas;
  const output = document.createElement('canvas');
  output.width = xMax - xMin + 5;
  output.height = yMax - yMin + 5;
  const out = output.getContext('2d');
  if (!out) return canvas;
  out.fillStyle = '#fff';
  out.fillRect(0, 0, output.width, output.height);
  out.drawImage(canvas, xMin - 2, yMin - 2, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

function normalizeBinaryCanvas(canvas: HTMLCanvasElement, height: number) {
  const width = Math.max(1, Math.round(canvas.width * (height / canvas.height)));
  return resizeBinaryCanvas(canvas, width, height);
}

function resizeBinaryCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) return output;
  context.imageSmoothingEnabled = true;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(canvas, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const ink = image.data[i] < 150 ? 0 : 255;
    image.data[i] = ink;
    image.data[i + 1] = ink;
    image.data[i + 2] = ink;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return output;
}

function isTextPixel(image: ImageData, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  const r = image.data[offset];
  const g = image.data[offset + 1];
  const b = image.data[offset + 2];
  return r > 145 && g > 145 && b > 140 && Math.max(r, g, b) - Math.min(r, g, b) < 75;
}

function classifySide(context: CanvasRenderingContext2D, width: number, y: number): 'ally' | 'enemy' {
  const sampleWidth = Math.min(Math.round(width * 0.34), width);
  const top = Math.max(0, Math.round(y - 42));
  const height = Math.min(84, context.canvas.height - top);
  const image = context.getImageData(0, top, sampleWidth, height);
  let red = 0;

  for (let index = 0; index < image.data.length; index += 4) {
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    if (r > 175 && g < 95 && b < 90 && r - g > 70 && r - b > 70) red += 1;
  }

  return red > 120 ? 'enemy' : 'ally';
}

function emptyResult(): ReadinessReadResult {
  return { rows: [], allies: [], enemies: [] };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
