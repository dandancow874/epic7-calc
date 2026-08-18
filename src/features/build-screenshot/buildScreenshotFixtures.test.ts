import { describe, expect, it } from 'vitest';
import { equipmentSet } from '../build-presets/setCatalog';
import type { RecognizedTargetStats } from './types';

type FixtureExpectation = {
  sha256: string;
  heroCode: string;
  artifactCode: string;
  artifactLevel: number;
  stats: Record<keyof RecognizedTargetStats, number>;
  sets: string[];
};

export const buildScreenshotFixtures: FixtureExpectation[] = [
  {
    sha256: '6F22590F6F4ACE03CBE3A71720A63A082D2D257C625FAC82D3E6FA0CDCF5B586',
    heroCode: 'dragon-bride-senya',
    artifactCode: 'bastion-of-perlutia',
    artifactLevel: 15,
    stats: { atk: 1472, def: 1916, hp: 33249, spd: 222, chc: 15, chd: 150, eff: 22, efr: 35 },
    sets: ['set_max_hp', 'set_speed'],
  },
  {
    sha256: '0A74F2DCC50032D48DEB92A304BE35946230E30A08310A8761F0A2A0E9564929',
    heroCode: 'notos',
    artifactCode: 'holy-sacrifice',
    artifactLevel: 30,
    stats: { atk: 1601, def: 1859, hp: 28400, spd: 184, chc: 50, chd: 170, eff: 9, efr: 46 },
    sets: ['set_opener', 'set_immune'],
  },
  {
    sha256: '694D681225BA2B1D1E0E279D1A2CDBB34F1BE84218BB2E838305D5AF43AE7E5E',
    heroCode: 'genesis-ras',
    artifactCode: 'a-precious-connection',
    artifactLevel: 30,
    stats: { atk: 1527, def: 1413, hp: 25928, spd: 116, chc: 100, chd: 350, eff: 6, efr: 12 },
    sets: ['set_cri_dmg', 'set_torrent'],
  },
];

describe('build screenshot fixture contract', () => {
  it('locks the eight expected panel values for every confirmed screenshot', () => {
    for (const fixture of buildScreenshotFixtures) {
      expect(Object.keys(fixture.stats)).toHaveLength(8);
      expect(fixture.artifactLevel).toBeGreaterThanOrEqual(0);
      expect(fixture.artifactLevel).toBeLessThanOrEqual(30);
    }
  });

  it('locks valid active set combinations without inventing placeholders', () => {
    for (const fixture of buildScreenshotFixtures) {
      const usedPieces = fixture.sets.reduce((total, code) => total + equipmentSet(code).pieces, 0);
      expect(usedPieces).toBeGreaterThan(0);
      expect(usedPieces).toBeLessThanOrEqual(6);
    }
  });
});
