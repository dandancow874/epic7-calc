import { equipmentSets } from '../build-presets/setCatalog';
import type { OcrLine, RecognitionField } from './types';

const aliases: Record<string, string[]> = {
  set_att: ['攻击力', '攻击'],
  set_cri_dmg: ['破灭', '暴伤'],
  set_max_hp: ['生命值', '生命'],
  set_acc: ['效果命中'],
  set_res: ['效果抗性'],
  set_opener: ['开战', '开幕'],
};

export function matchSetLines(lines: OcrLine[]): RecognitionField<string[]> {
  const results: string[] = [];
  const confidences: number[] = [];
  for (const line of lines) {
    const text = normalizeSetName(line.text);
    if (!text || /没有.*效果/.test(text)) continue;
    const candidates = equipmentSets
      .map((set) => ({
        code: set.code,
        confidence: Math.max(...normalizedNames(set.code, set.name).map((name) => similarity(text, name))),
      }))
      .sort((left, right) => right.confidence - left.confidence);
    if (candidates[0]?.confidence >= 0.45) {
      results.push(candidates[0].code);
      confidences.push(candidates[0].confidence);
    }
  }
  const pieces = results.reduce((total, code) => total + (equipmentSets.find((set) => set.code === code)?.pieces || 0), 0);
  return {
    value: pieces <= 6 ? results : null,
    confidence: results.length ? Math.min(...confidences) : 0,
    source: 'catalog-match',
  };
}

function normalizedNames(code: string, name: string) {
  return [name, ...(aliases[code] || [])].map(normalizeSetName);
}

function normalizeSetName(value: string) {
  return value.replace(/套装|套/g, '').replace(/[^\u3400-\u9fff]/g, '');
}

function similarity(left: string, right: string) {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9 * Math.min(left.length, right.length) / Math.max(left.length, right.length);
  let matches = 0;
  for (const character of new Set(left)) if (right.includes(character)) matches += 1;
  return matches / Math.max(left.length, right.length);
}
