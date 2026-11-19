import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import { Heroes } from '../../assets/data/heroes';
import { Artifacts } from '../../assets/data/artifacts';
import { DoT, HitType } from '../../app/models/skill';
import { calculatorSpecialFieldLabel } from './specialFieldLabel';
import type { LibraryHero } from '../../library/types';

const hwa = 'bystander_hwayoung';
const ludwig = 'eternal_wanderer_ludwig';
const iseria = 'summertime_iseria';
const calc = (id: string, values: Record<string, unknown> = {}) => new DamageEngine(id, 'noProc', {
  attack: 4000, critDamage: 300, targetDefense: 1800, molagoras1: 5, molagoras2: 5, molagoras3: 5, ...values,
});
const remainingDefense = (engine: DamageEngine, skillId = 's3', burn = false) => engine.target.getPenetration(
  Heroes[engine.heroId].skills[skillId], engine.form, engine.currentArtifact, burn, 4000, 200, HitType.crit,
);
const library = async () => JSON.parse(await readFile(new URL('../../../public/library/heroes.json', import.meta.url), 'utf8')) as LibraryHero[];

describe('November 19 balance changes and exclusive equipment', () => {
  it('combines Hwayoung exclusive 40% with Penetration Set as 49%, including soulburn', () => {
    for (const burn of [false, true]) {
      expect(remainingDefense(calc(hwa, { penetrationSet: true }), 's3', burn)).toBeCloseTo(.85);
      expect(remainingDefense(calc(hwa, { penetrationSet: true, exclusiveEquipment1: true }), 's3', burn)).toBeCloseTo(.51);
    }
    expect(remainingDefense(calc(hwa, { exclusiveEquipment1: true, elementalAdvantage: false }))).toBeCloseTo(.6);
    expect(remainingDefense(calc(hwa, { exclusiveEquipment1: true }), 's1')).toBe(1);
  });

  it('reproduces the confirmed 5000 attack / 350 crit soulburn case without adding EE panel attack twice', () => {
    const values = { attack: 5000, critDamage: 350, targetDefense: 1800, targetDivinityStack: 4, elementalAdvantage: true, penetrationSet: true, molagoras3: 7 };
    const plain = new DamageEngine(hwa, 'sigurd_scythe', values);
    const equipped = new DamageEngine(hwa, 'sigurd_scythe', { ...values, exclusiveEquipment1: true });
    expect(plain.getDamage(Heroes[hwa].skills.s3, true).crit).toBe(27552);
    expect(equipped.getDamage(Heroes[hwa].skills.s3, true).crit).toBe(43097);
    expect(equipped.currentHero.getAttack(Artifacts.sigurd_scythe, equipped.form, 0, Heroes[hwa].skills.s3, true, HitType.crit)).toBe(6000);
  });

  it('uses 0 / 35 / 70% on current Ludwig and retains 0 / 30 / 60% under .old', () => {
    for (const [stack, current, old] of [[0, 1, 1], [1, .65, .7], [2, .3, .4], [9, .3, .4]]) {
      expect(remainingDefense(calc(ludwig, { soulburnStack: stack, penetrationSet: true }))).toBeCloseTo(current);
      expect(remainingDefense(calc(`${ludwig}_old`, { soulburnStack: stack }))).toBeCloseTo(old);
    }
    expect(calc(ludwig, { soulburnStack: 2 }).getDamage(Heroes[ludwig].skills.s3).crit)
      .toBeGreaterThan(calc(`${ludwig}_old`, { soulburnStack: 2 }).getDamage(Heroes[`${ludwig}_old`].skills.s3).crit!);
  });

  it('applies Summer Iseria S3 defense break only to the following bomb detonation', () => {
    const values = { targetBombDetonate: 1, exclusiveEquipment2: true };
    const plain = calc(iseria, values), broken = calc(iseria, { ...values, targetDefenseDownAftermath: true });
    const s3 = Heroes[iseria].skills.s3, s1 = Heroes[iseria].skills.s1;
    const direct = 4000 * 1.2 * 1.871 * 1.3 / (1 + 1800 / 300);
    const bomb = 4000 * 1.5 * 1.871 * 1.1 / (1 + 1800 * .3 * .3 / 300);
    expect(broken.getDamage(s3).breakdown?.direct.normal).toBe(Math.round(direct));
    expect(plain.getDamage(s3).breakdown?.direct.normal).toBe(Math.round(direct));
    expect(broken.getDetonateDamage(false, s3)).toBeCloseTo(bomb);
    expect(broken.getDotDamage(s3, DoT.bomb)).toBe(plain.getDotDamage(s3, DoT.bomb));
    expect(broken.getDetonateDamage(false, s1)).toBe(plain.getDetonateDamage(false, s1));
  });

  it('does not double defense break, and respects defense immunity and existing defense modifiers', () => {
    const s3 = Heroes[iseria].skills.s3;
    for (const extra of [{}, { targetHasTrauma: true }, { targetDivinityStack: 4 }, { targetDefenseUp: true }]) {
      const after = calc(iseria, { ...extra, targetBombDetonate: 1, targetDefenseDownAftermath: true });
      const before = calc(iseria, { ...extra, targetBombDetonate: 1, targetDefenseDown: true });
      const both = calc(iseria, { ...extra, targetBombDetonate: 1, targetDefenseDown: true, targetDefenseDownAftermath: true });
      expect(after.getDetonateDamage(false, s3)).toBeCloseTo(before.getDetonateDamage(false, s3));
      expect(both.getDetonateDamage(false, s3)).toBeCloseTo(before.getDetonateDamage(false, s3));
    }
    const immune = { targetIgnoresDefenseUpDown: true, targetBombDetonate: 1 };
    expect(calc(iseria, { ...immune, targetDefenseDownAftermath: true }).getDetonateDamage(false, s3))
      .toBe(calc(iseria, immune).getDetonateDamage(false, s3));
    expect(calc(iseria, { targetBombDetonate: 1, targetDefenseDownAftermath: true, penetrationResistance: 100 }).getDetonateDamage(false, s3))
      .toBe(calc(iseria, { targetBombDetonate: 1, targetDefenseDownAftermath: true }).getDetonateDamage(false, s3));
  });

  it('updates confirmed utility and constellation data in the generated library', async () => {
    const heroes = await library(), hero = (code: string) => heroes.find(item => item.code === code)!;
    const ray = hero('death-dealer-ray');
    expect(ray.zodiac).toBe('scorpion');
    expect(ray.baseStats).toEqual(hero('dragon-king-sharun').baseStats);
    expect(Heroes.death_dealer_ray.baseAttack).toBe(ray.baseStats!.atk);
    expect(ray.skills[2].description).toContain('1回合内造成2个剧毒、睡眠');
    expect(hero('hellion-lua').skills[1].description).toContain('10(15)%');
    expect(hero('hellion-lua').skills[1].enhancements.map(item => item.text)).toEqual(['速攻值提升1%', '速攻值提升2%', '速攻值提升2%']);
    expect(hero('hellion-lua').skills[2].effects.some(item => item.name === '攻击力降低')).toBe(true);
    expect(hero('summertime-iseria').skills[2].effects.some(item => item.name === '防御力降低')).toBe(true);
    expect(hero('eternal-wanderer-ludwig').skills[2].description).toContain('35%');
  });

  it('adds the two pictured exclusive items, without an irrelevant Roana calculator toggle', async () => {
    const heroes = await library();
    for (const [code, stat, min, max, skill] of [[hwa, 'att_rate', .07, .14, 3], ['requiem_roana', 'acc', .08, .16, 2]] as const) {
      const equipment = heroes.find(item => item.code === code.replaceAll('_', '-'))!.exclusives[0];
      expect(equipment.mainStat).toEqual({ type: stat, min, max });
      expect(equipment.skillOptions).toHaveLength(1);
      expect(equipment.skillOptions[0].skillNumber).toBe(skill);
      expect((await readFile(new URL(`../../../public${equipment.iconKey}`, import.meta.url))).byteLength).toBeGreaterThan(1000);
    }
    expect(Heroes[hwa].heroSpecific).toContain('exclusiveEquipment1');
    expect(Heroes.requiem_roana.heroSpecific).not.toContain('exclusiveEquipment1');
    expect(calculatorSpecialFieldLabel(hwa, 'exclusiveEquipment1', false)).toContain('40%');
    expect(calculatorSpecialFieldLabel(ludwig, 'soulburnStack', 2)).toContain('70%');
  });
});
