import type { TargetStats } from '../build-presets/types';
import type { ImprintMode, ImprintRank } from '../build-presets/types';

export type RecognitionSource = 'digit-template' | 'windows-ocr' | 'bundled-ocr' | 'icon-match' | 'catalog-match' | 'manual';

export type RecognitionAlternative<T> = {
  value: T;
  confidence: number;
};

export type RecognitionField<T> = {
  value: T | null;
  confidence: number;
  source: RecognitionSource;
  alternatives?: RecognitionAlternative<T>[];
};

export type RecognizedHero = {
  heroCode: string;
  gameId: string | null;
  displayName: string;
};

export type RecognizedArtifact = {
  artifactCode: string;
  displayName: string;
};

export type RecognizedImprint = {
  mode: ImprintMode;
  rank: ImprintRank;
};

export type RecognizedTargetStats = {
  [Key in Exclude<keyof TargetStats, 'gs'>]: RecognitionField<number>;
};

export type BuildScreenshotRecognition = {
  hero: RecognitionField<RecognizedHero>;
  artifact: RecognitionField<RecognizedArtifact>;
  artifactLevel: RecognitionField<number>;
  imprint: RecognitionField<RecognizedImprint>;
  targetStats: RecognizedTargetStats;
  sets: RecognitionField<string[]>;
  warnings: string[];
  layout: 'equipment-cn-pc' | 'unsupported';
};

export type ImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrWord = {
  text: string;
  rect: ImageRect;
};

export type OcrLine = {
  text: string;
  words: OcrWord[];
  rect: ImageRect;
};

export type OcrLayout = {
  width: number;
  height: number;
  text: string;
  lines: OcrLine[];
};

export const recognizedStatKeys: Array<keyof RecognizedTargetStats> = ['atk', 'def', 'hp', 'spd', 'chc', 'chd', 'eff', 'efr'];
