import type { ProfileValues, Side } from '../../data/profiles';
import { Heroes } from '../../assets/data/heroes';
import { Artifacts } from '../../assets/data/artifacts';
import { equipmentSet } from './setCatalog';
import { calculatorAttackSets, libraryArtifactForCalculatorId, type CalculatorBuildCatalog } from './calculatorBuildBridge';
import { emptyTargetStats, type BuildPreset, type TargetStats } from './types';

export const snapshotStats: Array<{ key: keyof TargetStats; label: string }> = [
  { key: 'atk', label: '攻击' }, { key: 'hp', label: '生命' }, { key: 'def', label: '防御' },
  { key: 'spd', label: '速度' }, { key: 'chc', label: '暴率 (%)' }, { key: 'chd', label: '爆伤 (%)' },
  { key: 'eff', label: '命中 (%)' }, { key: 'efr', label: '抵抗 (%)' },
];

const attackerStats = { attack: 'atk', critDamage: 'chd', casterMaxHP: 'hp', casterDefense: 'def', casterSpeed: 'spd' } as const;
const defenderStats = { targetMaxHP: 'hp', targetDefense: 'def', targetAttack: 'atk' } as const;

export type CalculatorPresetSnapshot = { preset: BuildPreset; currentStats: Array<keyof TargetStats> };

/** Capture only the user's visible raw panel, never derived battle stats or hidden default values. */
export function calculatorPresetSnapshot(input: {
  side: Side; heroId: string; heroCode: string; values: ProfileValues;
  artifactId: string; base: BuildPreset | null; catalog: CalculatorBuildCatalog;
}): CalculatorPresetSnapshot {
  const { side, heroId, heroCode, values, artifactId, base, catalog } = input;
  const manual = values.useBuildPreset === false || !base;
  const targetStats = { ...emptyTargetStats, ...base?.targetStats };
  const missing = new Set<keyof TargetStats>(base ? base.missingStats || [] : snapshotStats.map(field => field.key));
  const currentStats: Array<keyof TargetStats> = [];
  const artifact = side === 'attacker'
    ? libraryArtifactForCalculatorId(artifactId, catalog.artifacts)
    : catalog.artifacts.find(item => item.code === values.defenderArtifactCode);
  const hero = Heroes[heroId];
  const visible = side === 'attacker'
    ? new Set(['attack', 'critDamage', ...hero?.heroSpecific || [], ...Artifacts[artifactId]?.artifactSpecific || []])
    : new Set(['targetMaxHP', hero?.equalizesAttackDefense ? 'targetAttack' : 'targetDefense']);
  if (manual) {
    for (const [field, stat] of Object.entries(side === 'attacker' ? attackerStats : defenderStats)) {
      if (!visible.has(field) || typeof values[field] !== 'number' || !Number.isFinite(values[field])) continue;
      targetStats[stat] = values[field] as number;
      missing.delete(stat);
      currentStats.push(stat);
    }
  }
  const controlledSets: string[] = side === 'attacker' ? calculatorAttackSets.map(([, code]) => code) : ['set_shield'];
  const sets = manual ? (base?.sets || []).filter(code => !controlledSets.includes(code)) : [...base?.sets || []];
  if (manual && side === 'attacker') {
    for (const [field, code] of calculatorAttackSets) {
      const count = field === 'torrentSetStack' ? Math.min(3, Math.max(0, Number(values[field] || 0))) : values[field] ? 1 : 0;
      for (let i = 0; i < count; i++) sets.push(code);
    }
  }
  if (manual && side === 'defender' && values.targetShieldSet) sets.push('set_shield');
  const selectedArtifactId = side === 'attacker' ? artifactId : String(values.defenderArtifactCode || '');
  return {
    currentStats,
    preset: {
      ...base, id: '', heroCode, source: 'manual', name: '', targetStats, missingStats: [...missing], sets,
      artifactCode: artifact?.code || (selectedArtifactId && selectedArtifactId !== 'noProc' ? selectedArtifactId.replaceAll('_', '-') : null),
      artifactName: artifact?.name || null,
      artifactLevel: Number(values[side === 'attacker' ? 'artifactLevel' : 'defenderArtifactLevel'] ?? 30),
      // Existing presets retain their manual calculator-set behavior; new snapshots restore their captured sets.
      selection: { ...base?.selection, calculatorEquipmentSets: true },
    },
  };
}

export function presetEquipmentPieces(preset: Pick<BuildPreset, 'sets'>) {
  return preset.sets.reduce((total, code) => total + equipmentSet(code).pieces, 0);
}
