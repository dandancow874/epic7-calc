import type { LibraryArtifact } from '../../library/types';

export type DefenderArtifactEffects = {
  hpIncrease: number;
  defenseIncrease: number;
  damageReduction: number;
  damageTransfer: number;
  barrierPercent: number;
};

const emptyEffects: DefenderArtifactEffects = {
  hpIncrease: 0,
  defenseIncrease: 0,
  damageReduction: 0,
  damageTransfer: 0,
  barrierPercent: 0,
};

export function resolveDefenderArtifactEffects(artifact: LibraryArtifact | null | undefined, level = 30): DefenderArtifactEffects {
  if (!artifact?.skillDescription) return { ...emptyEffects };
  const text = artifact.skillDescription;
  return {
    hpIncrease: scaledPercent(text, /最大生命值提升\s*(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?%/, level),
    defenseIncrease: scaledPercent(text, /防御力提升\s*(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?%/, level),
    damageReduction: damageReduction(text, level),
    damageTransfer: scaledPercent(text, /所受伤害的\s*(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?%进行伤害分配/, level),
    barrierPercent: scaledPercent(text, /相当于自身最大生命值\s*(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?%的防护罩/, level),
  };
}

function damageReduction(text: string, level: number) {
  const relevant = text.split('\n').find((line) => /伤害降低/.test(line) && !/因伤害分配而代替承受/.test(line));
  if (!relevant) return 0;
  return scaledPercent(relevant, /(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?%的伤害降低/, level)
    || scaledPercent(relevant, /所受伤害降低\s*(\d+(?:\.\d+)?)(?:\((\d+(?:\.\d+)?)\))?%/, level);
}

function scaledPercent(text: string, pattern: RegExp, level: number) {
  const match = text.match(pattern);
  if (!match) return 0;
  const minimum = Number(match[1]);
  const maximum = Number(match[2] ?? match[1]);
  const step = Math.floor(Math.min(30, Math.max(0, level)) / 3);
  return roundPercent(minimum + ((maximum - minimum) * step) / 10);
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}
