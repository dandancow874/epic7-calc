import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import { Heroes } from '../../assets/data/heroes';
import { Artifacts } from '../../assets/data/artifacts';
import { Skill } from '../../app/models/skill';
import { heroSearchNames, skillIcon } from '../../data/catalog';
import { calculatorSpecialFieldLabel } from './specialFieldLabel';
import type { LibraryHero, LibraryArtifact } from '../../library/types';

const id = 'bunny_girl_maid_cecilia';
const values = { attack: 1500, casterMaxHP: 30000, critDamage: 300, targetDefense: 1500,
  molagoras1: 5, molagoras3: 5, casterFightingSpirit: 0 };
const engine = (extra: Record<string, unknown> = {}, artifact = 'noProc') => new DamageEngine(id, artifact, { ...values, ...extra });
const generated = async <T>(file: string) => JSON.parse(await readFile(new URL(`../../../public/library/${file}.json`, import.meta.url), 'utf8')) as T;

describe('November 27 Bunny Girl Maid Cecilia and maintained library updates', () => {
  it('calculates normal S1 and does not invent a damaging soulburn attack', () => {
    const calc = engine();
    expect(calc.getDamage(Heroes[id].skills.s1).crit).toBe(Math.round(1500 * 1.871 * 1.3 * 3 / 6));
    expect(calc.updateDamages().map(row => row.skill)).toEqual(['s1', 's3']);
    expect(Heroes[id].skills.s1.soulburn).toBe(false);
  });

  it.each([[0, .2], [50, .45], [100, .7], [150, .7], [-20, .2]])('uses %s Fighting Spirit for the HP additional damage', (spirit, hpRate) => {
    const row = engine({ casterFightingSpirit: spirit }).getDamage(Heroes[id].skills.s3);
    const extra = Math.round(30000 * hpRate * 1.871 / 2.5);
    expect(row.breakdown!.other.normal).toBe(extra);
    expect(row.breakdown!.other.crit).toBe(extra);
    expect(row.breakdown!.other.miss).toBe(extra);
    expect(row.breakdown!.direct.normal).toBe(Math.round(1500 * 1.2 * 1.871 * 1.3 / 6));
    expect(row.normal).toBe(row.breakdown!.direct.normal! + extra);
  });

  it('applies Pursuit only to the additional damage; skill enhancements and crit only to the direct part', () => {
    const row = engine({ casterFightingSpirit: 100, pursuitSet: true }).getDamage(Heroes[id].skills.s3);
    const plain = engine({ casterFightingSpirit: 100 }).getDamage(Heroes[id].skills.s3);
    expect(row.breakdown!.direct).toEqual(plain.breakdown!.direct);
    expect(row.breakdown!.other.normal).toBe(Math.round(30000 * .7 * 1.871 / 2.5 * 1.2));
    expect(engine({ casterFightingSpirit: 100, molagoras3: 0 }).getDamage(Heroes[id].skills.s3).breakdown!.other).toEqual(plain.breakdown!.other);
    expect(engine({ casterFightingSpirit: 100, penetrationResistance: 100 }).getDamage(Heroes[id].skills.s3).breakdown!.other).toEqual(plain.breakdown!.other);
  });

  it('includes Covert Service health once, independently of artifact level or soulburn', () => {
    expect(Artifacts.covert_service.exclusive).toBe('soul_weaver');
    expect(engine({}, 'covert_service').form.casterFinalMaxHP(Artifacts.covert_service)).toBe(33000);
    expect(engine({ artifactLevel: 0 }, 'covert_service').form.casterFinalMaxHP(Artifacts.covert_service)).toBe(33000);
    expect(engine({ casterMaxHP: 33000, inBattleHP: true }, 'covert_service').form.casterFinalMaxHP(Artifacts.covert_service)).toBe(33000);
  });

  it('splits Monarch Iseria S3 without changing its previous total or misses', () => {
    const calc = new DamageEngine('monarch_of_the_sword_iseria', 'noProc', values);
    const skill = Heroes.monarch_of_the_sword_iseria.skills.s3;
    const row = calc.getDamage(skill);
    const original = calc.getDamage(new Skill({ ...skill, splitAdditionalDamage: false }));
    expect(row.breakdown).toBeTruthy();
    for (const hit of ['crit', 'crush', 'normal', 'miss'] as const) expect(row[hit]).toBe(original[hit]);
    expect(row.breakdown!.other.miss).toBe(0);
    expect(row.breakdown!.other.normal).toBeGreaterThan(0);
  });

  it('exposes the new hero aliases, icons, resource scaling, artifact and maintained detonation', async () => {
    expect(heroSearchNames(id)).toContain('女仆龙');
    expect(skillIcon(id, 's3')).toBe('/assets/skills/sk_c5002_3.png');
    expect(calculatorSpecialFieldLabel(id, 'casterFightingSpirit', 100)).toContain('70%');
    const heroes = await generated<LibraryHero[]>('heroes');
    const hero = heroes.find(h => h.code === 'bunny-girl-maid-cecilia')!;
    expect(hero.skills).toHaveLength(3);
    expect(hero.baseStats).toMatchObject({ atk: 621, def: 775, hp: 6034, spd: 100 });
    expect(hero.skills[0].pointGain).toBe(20);
    expect(hero.skills[0].isAoe).toBe(false);
    expect(hero.skills[0].soulBurn?.cost).toBe(20);
    const healRate = (slot: number, group: string) => hero.skills[slot].multipliers?.find(item => item.id === group)?.items.find(item => item.key === 'HPUP_CASTER_MAXHP_value')?.displayValue;
    expect(healRate(0, 'skill_multiplier')).toBe('7.0% 自身 最大生命值');
    expect(healRate(0, 'soulburn_multiplier')).toBe('17.0% 自身 最大生命值');
    expect(hero.skills[1].multipliers?.[0].items[0].displayValue).toContain('降低50%最大生命值时，获得25点斗志');
    const spiritRate = hero.skills[2].multipliers?.[0].items.find(item => item.key === 'fighting_spirit_hp_scaling');
    expect(spiritRate?.value).toContain('20% + 消耗斗志 × 0.5%');
    expect(spiritRate?.displayValue).toContain('20%/45%/70%');
    const perfumer = heroes.find(h => h.code === 'perfumer-byblis')!;
    expect(perfumer.skills[2].multipliers?.[0].items.find(item => item.key === 'EXPLOSION_DEBUFF_rate')?.value).toBe('1.0');
    const artifacts = await generated<LibraryArtifact[]>('artifacts');
    expect(artifacts.find(a => a.code === 'covert-service')).toMatchObject({ name: '隐秘服务', stats: { atk: 117, hp: 988 } });
  });

  it('includes the supplied Maid screenshot preset and both previously missing Fribbels presets', async () => {
    const presets = await generated<Array<{ heroCode: string; sets: string[]; artifactCode: string; targetStats: Record<string, number>; selection: Record<string, unknown> }>>('presets');
    const maid = presets.find(p => p.heroCode === 'bunny-girl-maid-cecilia')!;
    expect(maid.sets).toEqual(['set_chase', 'set_immune', 'set_max_hp']);
    expect(maid.artifactCode).toBe('covert-service');
    expect(maid.targetStats).toMatchObject({ atk: 1220, def: 1606, hp: 26748, spd: 174, chc: 15, chd: 150, eff: 39, efr: 59, gs: 419 });
    expect(maid.selection.source).toContain('User-provided screenshot');
    for (const code of ['bunny-girl-mafia-yufine', 'bunny-girl-great-detective-moro']) {
      expect(presets.find(p => p.heroCode === code)?.selection.source).toContain('Fribbels');
    }
  });
});
