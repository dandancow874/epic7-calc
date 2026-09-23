export const latestChangedHeroIds = [
  // User-selected featured heroes.
  'renoa',
  'haru',

  // Most recently added calculator/library entries.
  'aube',
  'tidal_rift_elvira',
  'lisette',
  'uncharted_pioneer_politis',

  // Most recent balance-adjustment batch.
  'aki',
  'blooming_lidica',
  'dark_corvus',
  'faithless_lidica',
  'inferno_khawazu',
  'jenua',
  'little_queen_charlotte',
  'schniel',

  // September 2026 additions and balance updates.
  'desert_jewel_basar',
  'urban_shadow_choux',
  'abyssal_yufine',
  'monarch_of_the_sword_iseria',
  'kawerik',
  'elena',
  'frida',
  'shadow_rose',
  'celestial_mercedes',
  'crimson_armin',
  'church_of_ilryos_axe',
  'chaos_sect_axe',
  'vigilante_leader_glenn',
  'christy',
  'magic_scholar_doris',
] as const;

const latestChangedHeroRank = new Map<string, number>(
  latestChangedHeroIds.map((id, index) => [id, index]),
);

export function sortLatestChangedHeroesFirst<T>(entries: Array<[string, T]>): Array<[string, T]> {
  return [...entries].sort(([left], [right]) => (
    (latestChangedHeroRank.get(left) ?? Number.MAX_SAFE_INTEGER)
    - (latestChangedHeroRank.get(right) ?? Number.MAX_SAFE_INTEGER)
  ));
}
