import type { LibraryArtifact, LibraryExclusiveEquipment, LibraryHero } from '../../library/types';
import type { BuildPreset, ImprintRank, RightMainStat, TargetStats } from './types';

export type GearSlot = 'necklace' | 'ring' | 'boots';
export type GearScoreResult = {
  total: number;
  average: number;
  averageSpeed: number;
  speedSubstat: number;
  mains: Record<GearSlot, RightMainStat>;
  inferred: boolean;
  valid: boolean;
  residuals: Omit<TargetStats, 'gs'>;
};

export const rightMainStatLabels: Record<RightMainStat, string> = {
  auto: '自动推断', atk: '固定攻击 525', hp: '固定生命 2835', def: '固定防御 310',
  atk_rate: '攻击力 65%', hp_rate: '生命值 65%', def_rate: '防御力 65%',
  chc: '暴击率 60%', chd: '暴击伤害 70%', eff: '效果命中 65%', efr: '效果抗性 65%', spd: '速度 45',
};

export const rightMainStatOptions: Record<GearSlot, RightMainStat[]> = {
  necklace: ['auto', 'atk', 'hp', 'def', 'atk_rate', 'hp_rate', 'def_rate', 'chc', 'chd'],
  ring: ['auto', 'atk', 'hp', 'def', 'atk_rate', 'hp_rate', 'def_rate', 'eff', 'efr'],
  boots: ['auto', 'atk', 'hp', 'def', 'atk_rate', 'hp_rate', 'def_rate', 'spd'],
};

const weights = { atk: 1, hp: 1, def: 1, spd: 2, chc: 1.5, chd: 1.125, eff: 1, efr: 1 } as const;
const averageCaps = { atk: 35, hp: 35, def: 35, spd: 25, chc: 15, chd: 20, eff: 35, efr: 35 } as const;

export function calculateGearScore(hero: LibraryHero, preset: BuildPreset, artifact: LibraryArtifact | null): GearScoreResult | null {
  if (!hero.baseStats) return null;
  const requested = { necklace: 'auto', ring: 'auto', boots: 'auto', ...(preset.rightMainStats || {}) } as Record<GearSlot, RightMainStat>;
  const candidates = combinations(requested).map((mains) => scoreWithMains(hero, preset, artifact, mains));
  candidates.sort((a, b) => candidatePenalty(a, hero, preset) - candidatePenalty(b, hero, preset) || a.total - b.total);
  const result = candidates[0];
  return { ...result, inferred: Object.values(requested).includes('auto') };
}

export function artifactStatsAtLevel(artifact: LibraryArtifact | null, level: number) {
  const safeLevel = Math.max(0, Math.min(30, Math.round(level)));
  const multiplier = 1 + safeLevel * 0.4;
  const atLevel = (maximum: number) => Math.floor((maximum / 13) * multiplier + 1e-6);
  return { atk: atLevel(artifact?.stats.atk || 0), hp: atLevel(artifact?.stats.hp || 0), def: atLevel(artifact?.stats.def || 0) };
}

export function targetStatsAfterArtifactChange(
  targetStats: TargetStats,
  previousArtifact: LibraryArtifact | null,
  previousLevel: number,
  nextArtifact: LibraryArtifact | null,
  nextLevel: number,
): TargetStats {
  const previous = artifactStatsAtLevel(previousArtifact, previousLevel);
  const next = artifactStatsAtLevel(nextArtifact, nextLevel);
  return {
    ...targetStats,
    atk: Math.max(0, targetStats.atk + next.atk - previous.atk),
    hp: Math.max(0, targetStats.hp + next.hp - previous.hp),
    def: Math.max(0, targetStats.def + next.def - previous.def),
  };
}

function scoreWithMains(hero: LibraryHero, preset: BuildPreset, artifact: LibraryArtifact | null, mains: Record<GearSlot, RightMainStat>) {
  const base = hero.baseStats!;
  const artifactStats = artifactStatsAtLevel(artifact, preset.artifactLevel ?? 30);
  const known = { atk: 0, hp: 0, def: 0, spd: 0, chc: 0, chd: 0, eff: 0, efr: 0 };
  const flat = { atk: 525 + artifactStats.atk, hp: 2835 + artifactStats.hp, def: 310 + artifactStats.def, spd: 0 };
  const target = adjustedTargetStats(hero, preset.targetStats);

  for (const main of Object.values(mains)) applyMain(main, known, flat);
  applySetBonuses(preset.sets, known);
  if ((preset.imprintMode || 'self') === 'self') applyDevotion(hero, preset.imprintRank || 'SSS', known);
  const exclusive = preset.exclusiveEquipmentId === 'none' ? null : hero.exclusives.find((item) => item.id === preset.exclusiveEquipmentId) || hero.exclusives[0] || null;
  applyExclusive(exclusive, known, flat);

  const residuals = {
    atk: percentResidual(target.atk, base.atk, flat.atk, known.atk),
    hp: percentResidual(target.hp, base.hp, flat.hp, known.hp),
    def: percentResidual(target.def, base.def, flat.def, known.def),
    spd: round2(target.spd - base.spd - flat.spd - Math.floor(base.spd * known.spd / 100)),
    chc: round2(target.chc - base.chc * 100 - known.chc),
    chd: round2(target.chd - base.chd * 100 - known.chd),
    eff: round2(target.eff - base.eff * 100 - known.eff),
    efr: round2(target.efr - base.efr * 100 - known.efr),
  };
  const total = round2(Object.entries(weights).reduce((sum, [key, weight]) => sum + Math.max(0, residuals[key as keyof typeof residuals]) * weight, 0));
  const speedPieces = mains.boots === 'spd' ? 5 : 6;
  return {
    total, average: round2(total / 6), averageSpeed: round2(Math.max(0, residuals.spd) / speedPieces), speedSubstat: Math.max(0, residuals.spd),
    mains, inferred: false, valid: Object.values(residuals).every((value) => value >= -0.6), residuals,
  };
}

function adjustedTargetStats(hero: LibraryHero, targetStats: TargetStats): TargetStats {
  const result = { ...targetStats };
  const adjustment = hero.gearScoreAdjustments;
  if (!adjustment) return result;

  for (const [key, multiplier] of Object.entries(adjustment.finalMultipliers)) {
    const stat = key as keyof Omit<TargetStats, 'gs'>;
    if (multiplier && multiplier > 0) result[stat] /= multiplier;
  }
  for (const [key, points] of Object.entries(adjustment.additivePercentPoints)) {
    const stat = key as keyof Omit<TargetStats, 'gs'>;
    if (!adjustment.libraryBaseStatsIncludes.includes(stat)) result[stat] -= points || 0;
  }
  return result;
}

function combinations(requested: Record<GearSlot, RightMainStat>) {
  const slots: GearSlot[] = ['necklace', 'ring', 'boots'];
  const choices = slots.map((slot) => requested[slot] === 'auto' ? rightMainStatOptions[slot].filter((item) => item !== 'auto') : [requested[slot]]);
  return choices[0].flatMap((necklace) => choices[1].flatMap((ring) => choices[2].map((boots) => ({ necklace, ring, boots }))));
}

function candidatePenalty(result: ReturnType<typeof scoreWithMains>, hero: LibraryHero, preset: BuildPreset) {
  let penalty = result.valid ? 0 : 100000;
  const eligible = eligiblePieces(result.mains);
  for (const [key, value] of Object.entries(result.residuals) as Array<[keyof typeof result.residuals, number]>) {
    if (value < -0.6) penalty += Math.abs(value) * 10000;
    const average = Math.max(0, value) / eligible[key];
    if (average > averageCaps[key]) penalty += (average - averageCaps[key]) ** 2 * 50;
  }
  if (result.mains.boots !== 'spd' && preset.targetStats.spd - (hero.baseStats?.spd || 0) >= 45) penalty += 500;
  return penalty;
}

function eligiblePieces(mains: Record<GearSlot, RightMainStat>) {
  const count = (main: RightMainStat) => Object.values(mains).filter((value) => value === main).length;
  return { atk: 5 - count('atk_rate'), hp: 6 - count('hp_rate'), def: 5 - count('def_rate'), spd: 6 - count('spd'), chc: 6 - count('chc'), chd: 6 - count('chd'), eff: 6 - count('eff'), efr: 6 - count('efr') };
}

function applyMain(main: RightMainStat, known: Record<string, number>, flat: Record<string, number>) {
  if (main === 'atk') flat.atk += 525;
  else if (main === 'hp') flat.hp += 2835;
  else if (main === 'def') flat.def += 310;
  else if (main === 'spd') flat.spd += 45;
  else if (main === 'atk_rate') known.atk += 65;
  else if (main === 'hp_rate') known.hp += 65;
  else if (main === 'def_rate') known.def += 65;
  else if (main === 'chc') known.chc += 60;
  else if (main === 'chd') known.chd += 70;
  else if (main === 'eff') known.eff += 65;
  else if (main === 'efr') known.efr += 65;
}

function applySetBonuses(sets: string[], known: Record<string, number>) {
  for (const set of sets) {
    if (set === 'set_speed') known.spd += 25;
    else if (set === 'set_att') known.atk += 45;
    else if (set === 'set_cri_dmg') known.chd += 60;
    else if (set === 'set_cri') known.chc += 12;
    else if (set === 'set_acc') known.eff += 20;
    else if (set === 'set_res') known.efr += 20;
    else if (set === 'set_max_hp') known.hp += 20;
    else if (set === 'set_def') known.def += 20;
  }
}

const selfImprintRankRatios: Record<ImprintRank, number> = {
  B: 1 / 3, A: 1 / 2, S: 2 / 3, SS: 5 / 6, SSS: 1,
};

function applyDevotion(hero: LibraryHero, rank: ImprintRank, known: Record<string, number>) {
  const devotion = (hero.devotion as Array<Record<string, unknown>>)[0];
  if (!devotion) return;
  applyTypedBonus(String(devotion.self_type || ''), Number(devotion.self_effect_max || 0) * selfImprintRankRatios[rank], known);
}

function applyExclusive(exclusive: LibraryExclusiveEquipment | null, known: Record<string, number>, flat: Record<string, number>) {
  if (!exclusive?.mainStat) return;
  const { type, max } = exclusive.mainStat;
  if (['att', 'max_hp', 'def', 'speed'].includes(type)) flat[type === 'att' ? 'atk' : type === 'max_hp' ? 'hp' : type === 'speed' ? 'spd' : 'def'] += max;
  else applyTypedBonus(type, max, known);
}

function applyTypedBonus(type: string, value: number, known: Record<string, number>) {
  const percent = Math.abs(value) <= 2 ? value * 100 : value;
  const key = ({ att_rate: 'atk', max_hp_rate: 'hp', def_rate: 'def', cri: 'chc', cri_dmg: 'chd', acc: 'eff', res: 'efr', speed: 'spd' } as Record<string, string>)[type];
  if (key) known[key] += percent;
}

function percentResidual(final: number, base: number, flat: number, knownPercent: number) {
  return base ? round2(((final - base - flat) / base) * 100 - knownPercent) : 0;
}

function round2(value: number) { return Math.round(value * 100) / 100; }
