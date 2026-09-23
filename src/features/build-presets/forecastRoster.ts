import type { BuildPreset, TargetStats } from './types';

export type ForecastRosterEntry = {
  heroCode: string;
  sets: string[];
  artifactCode: string;
  artifactLevel: number;
  exclusiveEquipmentId?: string | null;
  targetStats: TargetStats;
};

/**
 * The eight cards from the roster screenshot supplied for the forecast match.
 * Values are the displayed final panels; keeping them as a preset snapshot
 * means artifact stats are not added a second time by battlePanel().
 */
export const forecastRoster: ForecastRosterEntry[] = [
  {
    heroCode: 'abigail', sets: ['set_speed', 'set_max_hp'], artifactCode: 'proof-of-valor', artifactLevel: 30,
    exclusiveEquipmentId: '192',
    targetStats: { atk: 1509, def: 1138, hp: 23450, spd: 256, chc: 100, chd: 211, eff: 0, efr: 0, gs: 0 },
  },
  {
    heroCode: 'christy', sets: ['set_protection', 'set_res'], artifactCode: 'aurius', artifactLevel: 30,
    targetStats: { atk: 1298, def: 1403, hp: 18042, spd: 188, chc: 15, chd: 150, eff: 43, efr: 270, gs: 0 },
  },
  {
    heroCode: 'afternoon-soak-flan', sets: ['set_speed', 'set_penetrate'], artifactCode: 'dreamlike-holiday', artifactLevel: 30,
    targetStats: { atk: 4201, def: 1160, hp: 12214, spd: 188, chc: 15, chd: 338, eff: 18, efr: 0, gs: 0 },
  },
  {
    heroCode: 'magic-scholar-doris', sets: ['set_speed', 'set_res'], artifactCode: 'waters-origin', artifactLevel: 30,
    targetStats: { atk: 1065, def: 1614, hp: 21757, spd: 241, chc: 15, chd: 150, eff: 0, efr: 145, gs: 0 },
  },
  {
    heroCode: 'apocalypse-ravi', sets: ['set_cri_dmg', 'set_penetrate'], artifactCode: 'abyssal-crown', artifactLevel: 30,
    exclusiveEquipmentId: '177',
    targetStats: { atk: 1500, def: 1288, hp: 24561, spd: 163, chc: 100, chd: 331, eff: 0, efr: 0, gs: 0 },
  },
  {
    heroCode: 'angel-of-light-angelica', sets: ['set_speed', 'set_acc'], artifactCode: 'spirits-breath', artifactLevel: 30,
    targetStats: { atk: 1667, def: 1200, hp: 16960, spd: 240, chc: 15, chd: 150, eff: 130, efr: 130, gs: 0 },
  },
  {
    heroCode: 'sea-phantom-politis', sets: ['set_speed', 'set_acc'], artifactCode: 'awakened-leaf', artifactLevel: 30,
    targetStats: { atk: 1597, def: 1269, hp: 19340, spd: 280, chc: 15, chd: 150, eff: 171, efr: 0, gs: 0 },
  },
  {
    heroCode: 'rhianna-and-luciella', sets: ['set_speed', 'set_cri'], artifactCode: 'violet-talisman', artifactLevel: 30,
    targetStats: { atk: 2801, def: 821, hp: 7892, spd: 327, chc: 100, chd: 218, eff: 0, efr: 0, gs: 0 },
  },
];

export const forecastBattleScenario = {
  red: forecastRoster.slice(0, 4).map((entry) => entry.heroCode),
  blue: forecastRoster.slice(4).map((entry) => entry.heroCode),
} as const;

export function forecastPreset(entry: ForecastRosterEntry): BuildPreset {
  return {
    id: `forecast:${entry.heroCode}`,
    heroCode: entry.heroCode,
    name: '预测',
    source: 'manual',
    sets: [...entry.sets],
    artifactCode: entry.artifactCode,
    artifactLevel: entry.artifactLevel,
    exclusiveEquipmentId: entry.exclusiveEquipmentId || null,
    imprintMode: 'self',
    imprintRank: 'SSS',
    rightMainStats: { necklace: 'auto', ring: 'auto', boots: 'auto' },
    targetStats: { ...entry.targetStats },
    updatedAt: '2026-09-13T00:00:00.000Z',
  };
}
