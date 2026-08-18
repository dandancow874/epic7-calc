import type { ImageRect, OcrLayout, OcrLine, RecognizedTargetStats } from './types';

export type EquipmentScreenshotRegions = {
  heroNameLine: OcrLine | null;
  statLines: Partial<Record<keyof RecognizedTargetStats, OcrLine>>;
  statValueRects: Partial<Record<keyof RecognizedTargetStats, ImageRect>>;
  setLines: OcrLine[];
  artifactIconRect: ImageRect;
  artifactLevelLine: OcrLine | null;
  artifactLevelRect: ImageRect;
  imprintLine: OcrLine | null;
};

const statLabels: Array<{ key: keyof RecognizedTargetStats; labels: string[] }> = [
  { key: 'atk', labels: ['攻击力', '攻击'] },
  { key: 'def', labels: ['防御力', '防御'] },
  { key: 'hp', labels: ['生命值', '生命'] },
  { key: 'spd', labels: ['速度'] },
  { key: 'chc', labels: ['暴击率', '暴率'] },
  { key: 'chd', labels: ['暴击伤害', '爆伤'] },
  { key: 'eff', labels: ['效果命中', '命中'] },
  { key: 'efr', labels: ['效果抗性', '抗性'] },
];

const ignoredHeroTerms = ['属性', '骑士', '战士', '射手', '潜行者', '法师', '精灵师', '星座', 'Lv', 'Max'];

export function parseEquipmentScreenshotLayout(layout: OcrLayout): EquipmentScreenshotRegions {
  const statValueRects: EquipmentScreenshotRegions['statValueRects'] = {};
  const statLines: EquipmentScreenshotRegions['statLines'] = {};
  for (const definition of statLabels) {
    const line = layout.lines
      .filter((candidate) => candidate.rect.x < layout.width * 0.18)
      .filter((candidate) => candidate.rect.y > layout.height * 0.48 && candidate.rect.y < layout.height * 0.84)
      .map((candidate) => ({
        candidate,
        score: Math.max(...definition.labels.map((label) => labelScore(candidate.text, label))),
      }))
      .filter((candidate) => candidate.score >= 0.64)
      .sort((left, right) => right.score - left.score)[0]?.candidate;
    if (!line) continue;
    statLines[definition.key] = mergeHorizontalLine(layout, line);
    statValueRects[definition.key] = fallbackValueRect(layout.width, line.rect);
  }

  const heroNameLine = layout.lines
    .filter((line) => line.rect.x < layout.width * 0.38 && line.rect.y < layout.height * 0.2)
    .filter((line) => /[\u3400-\u9fffA-Za-z]{2,}/.test(line.text))
    .filter((line) => !ignoredHeroTerms.some((term) => line.text.includes(term)))
    .sort((left, right) => (right.rect.height * right.rect.width) - (left.rect.height * left.rect.width))[0] || null;

  const setLines = layout.lines
    .filter((line) => line.rect.x < layout.width * 0.36 && line.rect.y > layout.height * 0.72)
    .filter((line) => /套装|套/.test(line.text) && !/没有套装效果/.test(line.text))
    .sort((left, right) => left.rect.y - right.rect.y);

  const artifactLevelLine = layout.lines
    .filter((line) => line.rect.x > layout.width * 0.72 && line.rect.y < layout.height * 0.24)
    .filter((line) => /^\s*\+?\s*(?:[0-9O]{1,2})\s*$/.test(line.text))
    .sort((left, right) => {
      const leftScore = left.rect.x / layout.width - Math.abs(left.rect.y / layout.height - 0.11);
      const rightScore = right.rect.x / layout.width - Math.abs(right.rect.y / layout.height - 0.11);
      return rightScore - leftScore;
    })[0];

  const imprintLine = layout.lines
    .filter((line) => line.rect.x < layout.width * 0.4)
    .filter((line) => line.rect.y > layout.height * 0.2 && line.rect.y < layout.height * 0.48)
    .filter((line) => /(?:攻击力|防御力|生命值|速度|暴击率|效果命中|效果抗性).*(?:\+|＋)?\s*\d+(?:\.\d+)?\s*%/.test(line.text))
    .sort((left, right) => left.rect.y - right.rect.y)[0] || null;

  return {
    heroNameLine,
    statLines,
    statValueRects,
    setLines,
    artifactIconRect: {
      x: layout.width * 0.79,
      y: layout.height * 0.035,
      width: layout.width * 0.21,
      height: layout.height * 0.30,
    },
    artifactLevelLine: artifactLevelLine || null,
    artifactLevelRect: {
      x: Math.max(layout.width * 0.89, (artifactLevelLine?.rect.x || layout.width * 0.925) - layout.width * 0.018),
      y: Math.max(0, (artifactLevelLine?.rect.y || layout.height * 0.045) - layout.height * 0.012),
      width: Math.max(layout.width * 0.1, (artifactLevelLine?.rect.width || 0) + layout.width * 0.045),
      height: Math.max(layout.height * 0.09, (artifactLevelLine?.rect.height || 0) + layout.height * 0.025),
    },
    imprintLine,
  };
}

function fallbackValueRect(width: number, line: ImageRect): ImageRect {
  return {
    x: width * 0.175,
    y: Math.max(0, line.y - line.height * 0.2),
    width: width * 0.093,
    height: line.height * 1.4,
  };
}

function normalize(value: string) {
  return value.replace(/[\s:：]/g, '').toLocaleLowerCase();
}

function labelScore(value: string, label: string) {
  const normalizedValue = normalize(value).replace(/[^\u3400-\u9fff]/g, '');
  const normalizedLabel = normalize(label);
  if (normalizedValue.includes(normalizedLabel)) return 1;
  return 1 - levenshtein(normalizedValue, normalizedLabel) / Math.max(normalizedValue.length, normalizedLabel.length);
}

function mergeHorizontalLine(layout: OcrLayout, labelLine: OcrLine): OcrLine {
  const nearby = layout.lines
    .filter((line) => line !== labelLine)
    .filter((line) => line.rect.x > labelLine.rect.x)
    .filter((line) => line.rect.x < layout.width * 0.36)
    .filter((line) => Math.abs(line.rect.y - labelLine.rect.y) < layout.height * 0.018)
    .sort((left, right) => left.rect.x - right.rect.x);
  return {
    text: [labelLine.text, ...nearby.map((line) => line.text)].join(' '),
    words: [...labelLine.words, ...nearby.flatMap((line) => line.words)],
    rect: labelLine.rect,
  };
}

function levenshtein(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[right.length];
}
