import { invoke } from '@tauri-apps/api/core';
import { readBundledOcrLayout } from './bundledOcr';
import type { LibraryArtifact, LibraryHero } from '../../library/types';
import { matchArtifactIcon } from './artifactMatcher';
import { recognizeNumberImage, recognizeTargetStats } from './digitRecognizer';
import { matchHeroNameWithRoleFallback } from './heroMatcher';
import { matchHeroRole } from './roleMatcher';
import { cropImageData, loadScreenshotCanvas } from './imageInput';
import { parseEquipmentScreenshotLayout, type EquipmentScreenshotRegions } from './layoutParser';
import { matchSetLines } from './setMatcher';
import type { BuildScreenshotRecognition, OcrLayout, RecognitionField, RecognizedImprint, RecognizedTargetStats } from './types';
import type { ImprintRank } from '../build-presets/types';
import { recognizedStatKeys } from './types';
import { mergeStatRecognition, parseFirstNumber, validArtifactLevel } from './validateRecognition';

export async function recognizeBuildScreenshot(dataUrl: string, heroes: LibraryHero[], artifacts: LibraryArtifact[]): Promise<BuildScreenshotRecognition> {
  const { canvas } = await loadScreenshotCanvas(dataUrl);
  const warnings: string[] = [];
  const ocrLayout = await readOcrLayout(dataUrl, canvas.width, canvas.height)
    .catch(async (windowsError) => {
      console.warn('build-import: Windows OCR unavailable, using bundled OCR', windowsError);
      return readBundledOcrLayout(canvas);
    })
    .catch((error) => {
      console.warn('build-import: bundled OCR unavailable', error);
      warnings.push(`离线文字识别不可用，请手动确认角色和套装。${String(error)}`);
      return fallbackOcrLayout(canvas.width, canvas.height);
    });
  const regions = parseEquipmentScreenshotLayout(ocrLayout);
  const roleHint = await matchHeroRole(dataUrl).catch(() => null);
  const hero = matchHeroNameWithRoleFallback(regions.heroNameLine?.text || '', heroes, roleHint);
  const matchedHero = heroes.find((candidate) => candidate.code === hero.value?.heroCode) || null;
  const heroRole = matchedHero?.role;
  const [visualStats, artifact, artifactLevel] = await Promise.all([
    recognizeTargetStats(dataUrl, regions),
    matchArtifactIcon(dataUrl, regions.artifactIconRect, artifacts, heroRole),
    recognizeArtifactLevel(dataUrl, regions),
  ]);
  const targetStats = {} as BuildScreenshotRecognition['targetStats'];
  for (const key of recognizedStatKeys) {
    targetStats[key] = mergeStatRecognition(key, visualStats[key], regions.statLines[key]?.text);
    if (targetStats[key].value == null) warnings.push(`${statName(key)}识别失败，请手动填写。`);
  }
  const sets = matchSetLines(regions.setLines);
  const imprint = recognizeImprint(regions.imprintLine?.text || '', matchedHero);
  if (!hero.value) warnings.push('角色识别不确定，请从候选角色中确认。');
  if (!artifact.value) warnings.push('神器识别不确定，请从候选神器中确认。');
  if (!sets.value?.length) warnings.push('未识别到已激活套装，可手动选择或保持为空。');
  return { hero, artifact, artifactLevel, imprint, targetStats, sets, warnings, layout: ocrLayout.lines.length ? 'equipment-cn-pc' : 'unsupported' };
}

async function recognizeArtifactLevel(dataUrl: string, regions: EquipmentScreenshotRegions): Promise<RecognitionField<number>> {
  const ocrValue = parseFirstNumber(regions.artifactLevelLine?.text);
  if (validArtifactLevel(ocrValue) && ocrValue! >= 10) return { value: ocrValue, confidence: 0.95, source: 'windows-ocr' };
  const { canvas, context } = await loadScreenshotCanvas(dataUrl);
  const visual = recognizeNumberImage(cropImageData(context, canvas, regions.artifactLevelRect, 0.1), false);
  if (validArtifactLevel(visual.value) && (visual.value! >= 10 || ocrValue == null)) return visual;
  // The badge often touches the screenshot's right edge. A clipped 15/30 is safer
  // as a low-confidence common level than silently accepting it as +1/+3.
  if (ocrValue === 1) return { value: 15, confidence: 0.58, source: 'bundled-ocr' };
  if (ocrValue === 3) return { value: 30, confidence: 0.58, source: 'bundled-ocr' };
  return validArtifactLevel(visual.value) ? visual : { value: null, confidence: 0, source: 'digit-template' };
}

const imprintRanks: ImprintRank[] = ['B', 'A', 'S', 'SS', 'SSS'];
const selfRankRatios = [1 / 3, 1 / 2, 2 / 3, 5 / 6, 1];

function recognizeImprint(text: string, hero: LibraryHero | null): RecognitionField<RecognizedImprint> {
  const devotion = (hero?.devotion as Array<Record<string, unknown>> | undefined)?.[0];
  const maximum = Number(devotion?.self_effect_max || 0);
  const value = parseFirstNumber(text);
  if (!hero || !maximum || value == null) return { value: null, confidence: 0, source: 'catalog-match' };
  const normalizedMaximum = Math.abs(maximum) <= 2 ? maximum * 100 : maximum;
  const candidates = imprintRanks.map((rank, index) => ({
    rank,
    difference: Math.abs(value - normalizedMaximum * selfRankRatios[index]),
  })).sort((left, right) => left.difference - right.difference);
  const best = candidates[0];
  const tolerance = Math.max(0.7, normalizedMaximum * 0.045);
  return best.difference <= tolerance
    ? { value: { mode: 'self', rank: best.rank }, confidence: Math.max(0.72, 1 - best.difference / Math.max(1, normalizedMaximum)), source: 'catalog-match' }
    : { value: null, confidence: 0, source: 'catalog-match' };
}

async function readOcrLayout(dataUrl: string, width: number, height: number) {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) throw new Error('Tauri OCR is not available');
  const layout = await invoke<OcrLayout>('ocr_image_layout', { dataUrl });
  if (layout.width !== width || layout.height !== height) throw new Error('OCR image dimensions do not match');
  return layout;
}

function fallbackOcrLayout(width: number, height: number): OcrLayout {
  const labels = ['攻击力', '防御力', '生命值', '速度', '暴击率', '暴击伤害', '效果命中', '效果抗性'];
  const start = height * (height / width > 0.69 ? 0.57 : 0.58);
  const gap = height * 0.0365;
  const lines = labels.map((label, index) => ({
    text: label,
    words: [{ text: label, rect: { x: width * 0.02, y: start + gap * index, width: width * 0.12, height: gap * 0.7 } }],
    rect: { x: width * 0.02, y: start + gap * index, width: width * 0.12, height: gap * 0.7 },
  }));
  return { width, height, text: labels.join('\n'), lines };
}

function statName(key: keyof RecognizedTargetStats) {
  return ({ atk: '攻击力', def: '防御力', hp: '生命值', spd: '速度', chc: '暴击率', chd: '暴击伤害', eff: '效果命中', efr: '效果抗性' })[key];
}

export function recognitionToValues(stats: BuildScreenshotRecognition['targetStats']) {
  return Object.fromEntries(recognizedStatKeys.map((key) => [key, stats[key].value])) as Record<keyof RecognizedTargetStats, number | null>;
}
