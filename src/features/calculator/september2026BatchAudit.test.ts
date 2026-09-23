import { describe, expect, it } from 'vitest';
import { Artifacts } from '../../assets/data/artifacts';
import { Heroes } from '../../assets/data/heroes';
import { DamageFormData } from '../../app/models/forms';
import { HitType } from '../../app/models/skill';
import { DamageEngine } from '../../calc/damageEngine';

const form = new DamageFormData({
  casterDefense: 1000,
  casterMaxHP: 20000,
  casterSpeed: 250,
  targetDefense: 1000,
  targetMaxHP: 20000,
  targetSpeed: 250,
  targetInjuries: 5000,
});

function expectBase(heroId: string, skillId: string, rate: number, pow: number, soulburn = false) {
  const skill = Heroes[heroId].skills[skillId];
  expect(skill, `${heroId}.${skillId}`).toBeTruthy();
  expect(skill.rate(soulburn, form, false), `${heroId}.${skillId}.rate`).toBeCloseTo(rate);
  expect(skill.pow(soulburn, form), `${heroId}.${skillId}.pow`).toBeCloseTo(pow);
}

describe('September 2026 changed-hero batch audit', () => {
  it('verifies Haru and Renoa formulas', () => {
    expectBase('haru', 's1', 1, 1);
    expect(Heroes.haru.skills.s1.flatTip()).toEqual({ casterMaxHP: 12 });
    expectBase('haru', 's1_bis', 1, 1);
    expect(Heroes.haru.skills.s1_bis.flatTip()).toEqual({ casterMaxHP: 10 });
    expect(Heroes.haru.skills.s1_bis.penetrate(false, form, Artifacts.noProc, 0, 0)).toBe(1);
    expectBase('haru', 's3', 1, 1);
    expect(Heroes.haru.skills.s3.flatTip()).toEqual({ casterMaxHP: 25 });
    expect(Heroes.haru.skills.s3.mult(false, new DamageFormData({ skill3Stack: 5 }), Artifacts.noProc, 0)).toBeCloseTo(3.25);
    expect(Heroes.haru.skills.s3.penetrate(false, new DamageFormData({ targetHasBarrier: true }), Artifacts.noProc, 0, 0)).toBeCloseTo(0.7);
    expect(Heroes.haru.skills.s3.soulburn).toBe(false);
    expect(new DamageEngine('haru', 'noProc', {}).updateDamages().filter((row) => row.skillId === 's3')).toHaveLength(1);
    expect(Heroes.haru.heroSpecific).toContain('casterMoraleStack');
    expect(Heroes.haru.heroSpecificMaximums?.casterMoraleStack).toBe(3);
    expect(new DamageEngine('haru', 'noProc', { casterMoraleStack: 1 }).getGlobalDamageMult(Heroes.haru.skills.s1, false)).toBeCloseTo(0.1);
    expect(new DamageEngine('haru', 'noProc', { casterMoraleStack: 3 }).getGlobalDamageMult(Heroes.haru.skills.s3, false)).toBeCloseTo(0.3);
    expect(new DamageFormData({ casterMoraleStack: 9 }).casterMoraleStack).toBe(3);
    expect(new DamageEngine('abigail', 'noProc', { casterMoraleStack: 2 }).getGlobalDamageMult(Heroes.abigail.skills.s1, false)).toBeCloseTo(0.2);

    expectBase('renoa', 's1', 0.8, 0.85);
    expect(Heroes.renoa.skills.s1.flatTip()).toEqual({ caster_defense: 150 });
    expectBase('renoa', 's1_bis', 1.5, 1);
    expect(Heroes.renoa.skills.s1_bis.flatTip()).toEqual({ caster_defense: 300 });
    expectBase('renoa', 's2', 0.8, 1);
    expect(Heroes.renoa.skills.s2.flatTip()).toEqual({ caster_defense: 150 });
  });

  it('verifies the current Kawerik formulas and the preserved old version', () => {
    expectBase('kawerik', 's1', 1.2, 1);
    expectBase('kawerik', 's2', 1.4, 1);
    expectBase('kawerik', 's3', 1.1, 0.95);
    expect(Heroes.kawerik.skills.s3.penetrate(false, form, Artifacts.noProc, 0, 0)).toBeCloseTo(0.5);
    expect(Heroes.kawerik.heroSpecific).toEqual(['exclusiveEquipment3']);

    expectBase('kawerik_old', 's1', 0.9, 1);
    expect(Heroes.kawerik_old.skills.s1.mult(false, form, Artifacts.noProc, 0)).toBeCloseTo(1.1875);
    expectBase('kawerik_old', 's2', 1.4, 1);
    expect(Heroes.kawerik_old.skills.s2.mult(false, form, Artifacts.noProc, 0)).toBeCloseTo(1.75);
    expectBase('kawerik_old', 's3', 0.8, 0.95);
    expect(Heroes.kawerik_old.skills.s3.penetrate(false, form, Artifacts.noProc, 0, 0)).toBeCloseTo(0.3);
  });

  it('verifies the remaining damage-formula changes', () => {
    expectBase('desert_jewel_basar', 's1', 1.2, 1);

    expectBase('urban_shadow_choux', 's1', 0.5, 1);
    expectBase('urban_shadow_choux', 's1', 0.65, 1, true);
    expect(Heroes.urban_shadow_choux.skills.s1.flatTip(false)).toEqual({ casterMaxHP: 10 });
    expect(Heroes.urban_shadow_choux.skills.s1.flatTip(true)).toEqual({ casterMaxHP: 13 });
    expectBase('urban_shadow_choux', 's3', 0.5, 1);
    expect(Heroes.urban_shadow_choux.skills.s3.flatTip()).toEqual({ casterMaxHP: 20 });
    expect(Heroes.urban_shadow_choux.skills.s3.penetrate(false, form, Artifacts.noProc, 0, 0)).toBeCloseTo(0.5);
    expect(Heroes.urban_shadow_choux.skills.s1.fixed(HitType.normal, new DamageFormData({ casterHasBzzt: true }), Artifacts.noProc, false)).toBe(2500);
    expect(Heroes.urban_shadow_choux.skills.s3.fixed(HitType.normal, new DamageFormData({ casterHasBzzt: true }), Artifacts.noProc, false)).toBe(2500);

    expectBase('abyssal_yufine', 's1', 0.7, 1);
    expectBase('abyssal_yufine', 's1', 0.9, 1, true);
    expect(Heroes.abyssal_yufine.skills.s1.flatTip(false)).toEqual({ caster_defense: 90 });
    expect(Heroes.abyssal_yufine.skills.s1.flatTip(true)).toEqual({ caster_defense: 110 });
    expectBase('abyssal_yufine', 's1_bis', 0.43, 1);
    expect(Heroes.abyssal_yufine.skills.s1_bis.penetrate(false, form, Artifacts.noProc, 0, 0)).toBe(1);
    expectBase('abyssal_yufine', 's1_bis_soulburn', 0.6, 1);
    expectBase('abyssal_yufine', 's3', 1.1, 1);

    expectBase('monarch_of_the_sword_iseria', 's1', 0.3, 1);
    expectBase('monarch_of_the_sword_iseria', 's1', 0.5, 1, true);
    expectBase('monarch_of_the_sword_iseria', 's2', 0.3, 1);
    expect(Heroes.monarch_of_the_sword_iseria.skills.s2.afterMath(HitType.normal, form, false).attackPercent).toBeCloseTo(1.25);
    expectBase('monarch_of_the_sword_iseria', 's3', 0.3, 1);
    expect(Heroes.monarch_of_the_sword_iseria.skills.s3.afterMath(HitType.normal, form, false).attackPercent).toBeCloseTo(1.55);

    expectBase('elena', 's1', 1, 1);
    expectBase('elena', 's3', 0.9, 1);
    expectBase('frida', 's1', 1, 1);
    expect(Heroes.frida.barrier?.(Heroes.frida, Heroes.frida.skills.s1, Artifacts.noProc, form, 0, false)).toBe(4000);
    expectBase('crimson_armin', 's1', 0.8, 1);
    expect(Heroes.crimson_armin.skills.s1.flatTip()).toEqual({ casterDefense: 60 });

    expectBase('shadow_rose', 's1', 1, 1);
    expectBase('shadow_rose', 's2', 1.5, 0.9);
    expectBase('shadow_rose', 's3', 1, 0.8);
    expect(Heroes.shadow_rose.skills.s3.mult(false, new DamageFormData({ numberOfTargets: 2 }), Artifacts.noProc, 0)).toBe(2);

    expectBase('celestial_mercedes', 's1', 1, 1);
    expect(Heroes.celestial_mercedes.skills.s1.flatTip()).toEqual({ targetMaxHP: 2 });
    expectBase('celestial_mercedes', 's2', 0.9, 0.9);
    expectBase('celestial_mercedes', 's2', 1.05, 0.9, true);
    expect(Heroes.celestial_mercedes.skills.s2.flatTip(false)).toEqual({ targetMaxHP: 4 });
    expect(Heroes.celestial_mercedes.skills.s2.flatTip(true)).toEqual({ targetMaxHP: 5 });
    expectBase('celestial_mercedes', 's3', 1.2, 0.8);

    for (const heroId of ['church_of_ilryos_axe', 'chaos_sect_axe']) {
      expectBase(heroId, 's1', 0.7, 0.95);
      expect(Heroes[heroId].skills.s1.flatTip()).toEqual({ casterMaxHP: 6 });
      expectBase(heroId, 's2', 0.7, 0.95);
      expect(Heroes[heroId].skills.s2.flatTip()).toEqual({ casterMaxHP: 8 });
      expectBase(heroId, 's3', 1, 0.9);
      expect(Heroes[heroId].skills.s3.flatTip(false)).toEqual({ casterMaxHP: 20 });
      expect(Heroes[heroId].skills.s3.flatTip(true)).toEqual({ casterMaxHP: 30 });
    }
    expectBase('chaos_sect_axe', 's3', 1.5, 0.9, true);
    expectBase('chaos_sect_axe', 's3', 1, 0.9);
    expect(Heroes.chaos_sect_axe.skills.s3.flatTip(false)).toEqual({ casterMaxHP: 20 });
    expect(Heroes.chaos_sect_axe.skills.s3.flatTip(true)).toEqual({ casterMaxHP: 30 });

    const bombEngine = new DamageEngine('abigail', 'noProc', {
      attack: 3000,
      targetDefense: 1200,
      casterHasExplosives: true,
    });
    const bomb = bombEngine.getDotDamages().find((item) => item.type === 'bomb');
    expect(bomb?.value).toBe(Math.round(3000 * 1.5 * 1.871 / (1200 * 0.3 / 300 + 1)));

    expectBase('vigilante_leader_glenn', 's1', 1, 1);
    expectBase('vigilante_leader_glenn', 's2', 1.5, 0.9);
    expectBase('vigilante_leader_glenn', 's2', 2.2, 0.9, true);
  });

  it('keeps all eight requested old formula snapshots intact', () => {
    expect(Heroes.abyssal_yufine_old.baseDefense).toBe(713);
    expectBase('abyssal_yufine_old', 's1_bis', 0.8, 0.9);
    expect(Heroes.abyssal_yufine_old.skills.s1_bis.penetrate(false, form, Artifacts.noProc, 0, 0)).toBeCloseTo(0.7);
    expectBase('abyssal_yufine_old', 's1_bis_soulburn', 1.25, 0.9);

    expectBase('celestial_mercedes_old', 's1', 1, 1);
    expect(Heroes.celestial_mercedes_old.skills.s1.flatTip()).toBeNull();
    expectBase('celestial_mercedes_old', 's2', 0.9, 0.9);
    expect(Heroes.celestial_mercedes_old.skills.s2.flatTip()).toEqual({ targetMaxHP: 4 });

    expectBase('chaos_sect_axe_old', 's3', 1, 0.9);
    expect(Heroes.chaos_sect_axe_old.skills.s3.flatTip()).toEqual({ casterMaxHP: 20 });
    expect(Heroes.chaos_sect_axe_old.skills.s3.penetrate(false, new DamageFormData({ elementalAdvantage: true }), Artifacts.noProc, 0, 0)).toBeCloseTo(0.4);

    expectBase('church_of_ilryos_axe_old', 's1', 0.85, 0.95);
    expect(Heroes.church_of_ilryos_axe_old.skills.s1.flatTip()).toEqual({ casterMaxHP: 4 });
    expectBase('church_of_ilryos_axe_old', 's2', 0.75, 0.95);
    expect(Heroes.church_of_ilryos_axe_old.skills.s2.flatTip()).toEqual({ casterMaxHP: 5 });
    expectBase('church_of_ilryos_axe_old', 's3', 1.2, 0.9);
    expect(Heroes.church_of_ilryos_axe_old.skills.s3.flatTip()).toEqual({ casterMaxHP: 10 });

    expectBase('shadow_rose_old', 's3', 1.05, 0.8);
    expect(Heroes.vigilante_leader_glenn_old.baseAttack).toBe(920);
    expect(Heroes.vigilante_leader_glenn_old.skills.s1.mult(false, new DamageFormData({ skillTreeCompleted: true, elementalAdvantage: true }), Artifacts.noProc, 0)).toBeCloseTo(1.35);
    expect(Heroes.vigilante_leader_glenn_old.skills.s2.mult(false, new DamageFormData({ skillTreeCompleted: true, elementalAdvantage: true }), Artifacts.noProc, 0)).toBeCloseTo(1.25);
  });
});
