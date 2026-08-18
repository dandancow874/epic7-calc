export type LibraryDataStatus = 'complete' | 'summary-only';
export type LibraryAttribute = 'fire' | 'ice' | 'wind' | 'light' | 'dark';
export type LibraryRole = 'warrior' | 'knight' | 'thief' | 'ranger' | 'mage' | 'soul_weaver' | 'common';
export type LibraryZodiac = 'ram' | 'bull' | 'twins' | 'crab' | 'lion' | 'maiden' | 'scales' | 'scorpion' | 'archer' | 'goat' | 'waterbearer' | 'fish';

export type LibrarySkillEffect = {
  id: string;
  name: string;
  type: 'buff' | 'debuff' | 'common' | string;
  description: string;
  icon: string | null;
};

export type LibrarySkillMultiplier = {
  id: string;
  name: string;
  items: Array<{
    key: string;
    label: string;
    value: string;
    displayValue: string;
  }>;
};

export type LibrarySkill = {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  cooldown: string;
  soulGain: number;
  soulBurn: { cost: number; description: string } | null;
  isAoe: boolean;
  dealsDamage: boolean;
  enhancements: Array<{ level: number; text: string }>;
  multipliers?: LibrarySkillMultiplier[];
  effects: LibrarySkillEffect[];
};

export type LibraryExclusiveEquipment = {
  id: string;
  name: string;
  description: string;
  iconKey: string | null;
  mainStat: {
    type: string;
    min: number;
    max: number;
  } | null;
  skillOptions: Array<{
    skillNumber: number;
    description: string;
  }>;
};

export type LibraryHero = {
  code: string;
  gameId: string | null;
  name: string;
  nameEn: string | null;
  nameZht: string | null;
  nicknames: string[];
  attribute: LibraryAttribute;
  role: LibraryRole;
  rarity: number;
  zodiac: LibraryZodiac | null;
  publishDate: string | null;
  descriptionLine: string;
  story: string;
  profile: Record<string, unknown> | null;
  baseStats: Record<'atk' | 'hp' | 'def' | 'spd' | 'chc' | 'chd' | 'eff' | 'efr', number> | null;
  gearScoreAdjustments?: {
    finalMultipliers: Partial<Record<'atk' | 'hp' | 'def' | 'spd' | 'chc' | 'chd' | 'eff' | 'efr', number>>;
    additivePercentPoints: Partial<Record<'atk' | 'hp' | 'def' | 'spd' | 'chc' | 'chd' | 'eff' | 'efr', number>>;
    libraryBaseStatsIncludes: Array<'atk' | 'hp' | 'def' | 'spd' | 'chc' | 'chd' | 'eff' | 'efr'>;
  };
  artwork: string | null;
  avatar: string | null;
  skills: LibrarySkill[];
  devotion: unknown[];
  exclusives: LibraryExclusiveEquipment[];
  tags: string[];
  dataStatus: LibraryDataStatus;
};

export type LibraryArtifact = {
  code: string;
  name: string;
  nameEn: string | null;
  nameZht: string | null;
  description: string;
  skillDescription: string;
  rarity: number;
  role: LibraryRole;
  limited: boolean;
  stats: { atk: number; hp: number; def: number };
  image: string | null;
  artwork: string | null;
  publishDate: string | null;
};
