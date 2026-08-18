import type { RecognitionField, RecognizedTargetStats } from './types';

const statRanges: Record<keyof RecognizedTargetStats, [number, number]> = {
  atk: [1, 15000],
  def: [1, 6000],
  hp: [1, 70000],
  spd: [1, 500],
  chc: [0, 100],
  chd: [100, 350],
  eff: [0, 500],
  efr: [0, 500],
};

export function mergeStatRecognition(key: keyof RecognizedTargetStats, visual: RecognitionField<number> | undefined, ocrText: string | undefined) {
  const ocrValue = parseFirstNumber(ocrText);
  const ocrValid = ocrValue != null && validStat(key, ocrValue);
  const visualValid = visual?.value != null && validStat(key, visual.value);
  if (ocrValid && visualValid && ocrValue === visual.value) return { value: ocrValue, confidence: Math.max(0.96, visual.confidence), source: 'windows-ocr' as const };
  if (visualValid && (visual?.confidence || 0) >= 0.65) return visual!;
  if (ocrValid) return { value: ocrValue, confidence: 0.76, source: 'windows-ocr' as const };
  if (visualValid) return visual!;
  return { value: null, confidence: 0, source: 'windows-ocr' as const };
}

export function parseFirstNumber(text: string | undefined) {
  if (!text) return null;
  const normalized = text.replace(/[,，]/g, '').replace(/[OoＯ]/g, '0');
  const match = normalized.match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : null;
}

export function validStat(key: keyof RecognizedTargetStats, value: number) {
  const [minimum, maximum] = statRanges[key];
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validArtifactLevel(value: number | null) {
  return value != null && Number.isInteger(value) && value >= 0 && value <= 30;
}
