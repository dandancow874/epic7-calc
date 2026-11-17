import { Artifacts } from '../../assets/data/artifacts';
import { DamageEngine, type DamageRow, type DamageValues } from '../../calc/damageEngine';
import type { ProfileValues } from '../../data/profiles';
import type { LibraryArtifact } from '../../library/types';
import type { BuildPreset } from '../build-presets/types';
import { withCalculatorArtifact } from '../build-presets/calculatorBuildBridge';
import { mergeCalculatorValues } from './mergeCalculatorValues';

export type ArtifactComparisonContext = {
  heroId: string;
  defenderId: string;
  attacker: ProfileValues;
  defender: ProfileValues;
  preset?: BuildPreset;
  artifacts: LibraryArtifact[];
};

export type ArtifactComparison = {
  artifactId: string;
  rows: DamageRow[];
  supported: boolean;
};

export type ComparisonHit = keyof DamageValues;

export function isArtifactAutoComparisonAllowed(artifactId: string) {
  // Monster-only artifacts are manually selectable but excluded from hero comparisons.
  return !['special_strawberry_cake', 'our_beautiful_seasons', 'radiant_forever'].includes(artifactId);
}

/** Pure preview of the same +30 artifact change used by the actual picker. */
export function attackerWithArtifact(context: Pick<ArtifactComparisonContext, 'attacker' | 'preset' | 'artifacts'>, artifactId: string): ProfileValues {
  const { attacker, preset, artifacts } = context;
  const updated = attacker.useBuildPreset !== false && preset
    ? withCalculatorArtifact(preset, artifactId, 30, artifacts) : null;
  return {
    ...attacker, artifactId, artifactLevel: 30,
    ...(updated ? {
      attack: updated.targetStats.atk,
      casterMaxHP: updated.targetStats.hp,
      casterDefense: updated.targetStats.def,
    } : {}),
  };
}

export function compareArtifact(context: ArtifactComparisonContext, artifactId: string): ArtifactComparison {
  // Library-only artifacts have no calculator implementation; never present them as 0%.
  if (!Artifacts[artifactId] || !isArtifactAutoComparisonAllowed(artifactId)) return { artifactId, rows: [], supported: false };
  const attacker = attackerWithArtifact(context, artifactId);
  const values = mergeCalculatorValues(attacker, context.defender, attacker.useDefenderPresetValues !== false, context.defenderId);
  return { artifactId, rows: new DamageEngine(context.heroId, artifactId, values).updateDamages(), supported: true };
}

export function comparisonRowKey(row: DamageRow) {
  return `${row.skill}:${row.variant || ''}`;
}

export function comparisonDamage(result: ArtifactComparison | undefined, rowKey: string, hit: ComparisonHit) {
  const value = result?.rows.find((row) => comparisonRowKey(row) === rowKey)?.[hit];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function artifactDamageIncrease(result: ArtifactComparison | undefined, baseline: ArtifactComparison | undefined, rowKey: string, hit: ComparisonHit) {
  const damage = comparisonDamage(result, rowKey, hit);
  const base = comparisonDamage(baseline, rowKey, hit);
  return damage !== null && base !== null && base > 0 ? (damage / base - 1) * 100 : null;
}

export function formatArtifactIncrease(value: number | null) {
  if (value === null) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}
