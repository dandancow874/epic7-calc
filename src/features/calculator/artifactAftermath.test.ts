import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import { HitType } from '../../app/models/skill';

describe('artifact aftermath summary', () => {
  it("shows Tome of Life's End aftermath even though it only triggers on a non-critical hit", () => {
    const engine = new DamageEngine('abigail', 'tome_of_lifes_end', {
      attack: 2500,
      targetDefense: 1000,
      artifactLevel: 30,
    });

    expect(engine.getArtifactDamage(false, HitType.crit)).toBe(0);
    expect(engine.getArtifactDamage(false, HitType.normal)).toBe(936);
    expect(engine.getArtifactDamage()).toBe(936);
  });
});
