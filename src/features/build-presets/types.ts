export type TargetStats = {
  atk: number; hp: number; def: number; spd: number; chc: number; chd: number; eff: number; efr: number; gs: number;
};

export type RightMainStat = 'auto' | 'atk' | 'hp' | 'def' | 'atk_rate' | 'hp_rate' | 'def_rate' | 'chc' | 'chd' | 'eff' | 'efr' | 'spd';
export type ImprintMode = 'self' | 'team';
export type ImprintRank = 'B' | 'A' | 'S' | 'SS' | 'SSS';

export type BuildPreset = {
  id: string;
  heroCode: string;
  name: string;
  source: 'community' | 'manual';
  sets: string[];
  artifactCode: string | null;
  artifactName?: string | null;
  artifactLevel?: number;
  imprintMode?: ImprintMode;
  imprintRank?: ImprintRank;
  exclusiveEquipmentId?: string | null;
  rightMainStats?: { necklace: RightMainStat; ring: RightMainStat; boots: RightMainStat };
  targetStats: TargetStats;
  selection?: Record<string, unknown> | null;
  updatedAt?: string;
};

export const emptyTargetStats: TargetStats = { atk: 0, hp: 0, def: 0, spd: 0, chc: 0, chd: 0, eff: 0, efr: 0, gs: 0 };
