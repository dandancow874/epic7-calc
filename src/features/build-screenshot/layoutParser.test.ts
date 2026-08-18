import { describe, expect, it } from 'vitest';
import { parseEquipmentScreenshotLayout } from './layoutParser';
import type { OcrLayout, OcrLine } from './types';

function line(text: string, x: number, y: number, width: number, height = 28): OcrLine {
  const parts = text.split(' ');
  return {
    text,
    rect: { x, y, width, height },
    words: parts.map((part, index) => ({
      text: part,
      rect: { x: x + index * width / parts.length, y, width: width / parts.length - 2, height },
    })),
  };
}

function fixtureLayout(scale = 1): OcrLayout {
  const rows = [
    ['攻击力', '1527'], ['防御力', '1413'], ['生命值', '25928'], ['速度', '116'],
    ['暴击率', '100.0%'], ['暴击伤害', '350.0%'], ['效果命中', '6.0%'], ['效果抗性', '12.0%'],
  ];
  const lines = [
    line('光明属性 骑士 天秤座', 35, 45, 340),
    line('起源拉斯', 40, 90, 230, 46),
    ...rows.map(([label, value], index) => line(`${label} ${value} 0`, 35, 540 + index * 38, 380)),
    line('破灭套装', 45, 870, 150),
    line('激流套装', 45, 910, 150),
    line('+30', 1280, 85, 70),
  ];
  return {
    width: 1388 * scale,
    height: 971 * scale,
    text: lines.map((item) => item.text).join('\n'),
    lines: lines.map((item) => ({
      ...item,
      rect: { ...item.rect, x: item.rect.x * scale, y: item.rect.y * scale, width: item.rect.width * scale, height: item.rect.height * scale },
      words: item.words.map((word) => ({ ...word, rect: { ...word.rect, x: word.rect.x * scale, y: word.rect.y * scale, width: word.rect.width * scale, height: word.rect.height * scale } })),
    })),
  };
}

describe('equipment screenshot layout parser', () => {
  it('locates hero, eight stat rows, sets and artifact level', () => {
    const regions = parseEquipmentScreenshotLayout(fixtureLayout());
    expect(regions.heroNameLine?.text).toBe('起源拉斯');
    expect(Object.keys(regions.statValueRects)).toHaveLength(8);
    expect(regions.setLines.map((item) => item.text)).toEqual(['破灭套装', '激流套装']);
    expect(regions.artifactLevelRect.x).toBeGreaterThan(1200);
  });

  it('preserves region ratios after resolution scaling', () => {
    const normal = parseEquipmentScreenshotLayout(fixtureLayout());
    const scaled = parseEquipmentScreenshotLayout(fixtureLayout(0.5));
    expect(scaled.statValueRects.hp!.y).toBeCloseTo(normal.statValueRects.hp!.y / 2);
    expect(scaled.artifactIconRect.width).toBeCloseTo(normal.artifactIconRect.width / 2);
  });

  it('ignores imprint text above the panel and tolerates a one-character label error', () => {
    const layout = fixtureLayout();
    layout.lines.unshift(line('生命值 +21%', 40, 300, 240));
    const defense = layout.lines.find((item) => item.text.startsWith('防御力'))!;
    defense.text = defense.text.replace('防御力', '防箱力');
    defense.words[0].text = '防箱力';
    const regions = parseEquipmentScreenshotLayout(layout);
    expect(regions.statLines.hp?.text).toContain('25928');
    expect(regions.statLines.def?.text).toContain('1413');
    expect(regions.imprintLine?.text).toBe('生命值 +21%');
  });

  it('widens a clipped one-digit artifact level region', () => {
    const layout = fixtureLayout();
    const level = layout.lines.find((item) => item.text === '+30')!;
    level.text = '+3';
    level.rect.width = 24;
    const regions = parseEquipmentScreenshotLayout(layout);
    expect(regions.artifactLevelRect.width).toBeGreaterThan(level.rect.width);
    expect(regions.artifactLevelRect.x).toBeLessThan(level.rect.x);
  });
});
