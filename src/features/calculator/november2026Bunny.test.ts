import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DamageEngine } from '../../calc/damageEngine';
import { Heroes } from '../../assets/data/heroes';
import { Artifacts } from '../../assets/data/artifacts';
import { DamageFormData } from '../../app/models/forms';
import { DoT } from '../../app/models/skill';
import { defenderBattleMaxHP, defenderOpeningBarrier, mergeCalculatorValues } from './mergeCalculatorValues';
import { heroSearchNames, skillIcon, skillName } from '../../data/catalog';
import type { LibraryHero, LibraryArtifact } from '../../library/types';

const base = { attack: 1000, casterMaxHP: 20000, critDamage: 300, targetDefense: 1200, targetMaxHP: 30000, targetBurnDetonate: 4,
  molagoras1: 0, molagoras2: 0, molagoras3: 0 };
const engine = (heroId: string, values: Record<string, unknown> = {}) => new DamageEngine(heroId, 'noProc', { ...base, ...values });
const yufine = 'bunny_girl_mafia_yufine';
const moro = 'bunny_girl_great_detective_moro';
const library = async <T>(file: string) => JSON.parse(await readFile(new URL(`../../../public/library/${file}.json`, import.meta.url), 'utf8')) as T;

describe('November 2026 additions and exclusive equipment', () => {
  it('calculates Yufine S1 and separate AOE Settlement as penetrating direct damage, without crit or crush', () => {
    const calc = engine(yufine);
    const s1 = calc.getDamage(Heroes[yufine].skills.s1);
    const proc = calc.getDamage(Heroes[yufine].skills.s1_extra);
    expect(s1.normal).toBe(2807);
    expect(proc.normal).toBe(6549);
    expect(s1.crit).toBeNull(); expect(s1.crush).toBeNull();
    expect(proc.crit).toBeNull(); expect(proc.crush).toBeNull();
    expect(engine(yufine, { targetDefense: 10000 }).getDamage(Heroes[yufine].skills.s1_extra).normal).toBe(proc.normal);
    expect(engine(yufine, { pursuitSet: true }).getDamage(Heroes[yufine].skills.s1_extra).normal).toBe(proc.normal);
  });

  it('uses Determination max HP for both Yufine attacks, without applying it again to in-battle HP', () => {
    const calc = engine(yufine, { casterDetermination: true });
    expect(calc.form.casterFinalMaxHP(Artifacts.noProc)).toBe(26000);
    expect(calc.getDamage(Heroes[yufine].skills.s1).normal).toBe(3368);
    expect(calc.getDamage(Heroes[yufine].skills.s1_extra).normal).toBe(8232);
    expect(engine(yufine, { casterMaxHP: 26000, casterDetermination: true, inBattleHP: true }).form.casterFinalMaxHP(Artifacts.noProc)).toBe(26000);
  });

  it('inherits S1 enhancement on Settlement and uses single/AOE artifact and set eligibility correctly', () => {
    const full = engine(yufine, { molagoras1: 5 });
    expect(Heroes[yufine].getSkillEnhanceMult(Heroes[yufine].skills.s1_extra, full.form)).toBeCloseTo(1.3);
    expect(Heroes[yufine].skills.s1.isSingle(full.form, false)).toBe(true);
    expect(Heroes[yufine].skills.s1_extra.isAOE(full.form, false)).toBe(true);
    expect(full.updateDamages().some(row => row.skillId === 's3')).toBe(false);
    expect(full.updateDamages().map(row => row.skill)).toEqual(['s1', 'bunny_girl_mafia_yufine_settlement']);
  });

  it('keeps defender Determination HP, current HP and opening shield calculations consistent', () => {
    const values = { targetMaxHP: 20000, targetDetermination: true };
    expect(defenderBattleMaxHP(values, yufine)).toBe(26000);
    expect(defenderOpeningBarrier(values, 0, true, yufine)).toBe(3120);
    const merged = mergeCalculatorValues({}, values, true, yufine);
    expect(new DamageFormData(merged).targetFinalMaxHP()).toBe(26000);
    expect(merged.targetCurrentHP).toBe(26000);
  });

  it('adds Moro S1/S3 damage with their own enhancements and no fictitious S2 attack', () => {
    const hero = Heroes[moro];
    const calc = engine(moro);
    expect(calc.getDamage(hero.skills.s1).normal).toBe(374);
    expect(calc.getDamage(hero.skills.s3).normal).toBe(561);
    expect(hero.getSkillEnhanceMult(hero.skills.s1, engine(moro, { molagoras1: 5 }).form)).toBeCloseTo(1.3);
    expect(hero.getSkillEnhanceMult(hero.skills.s3, engine(moro, { molagoras3: 5 }).form)).toBeCloseTo(1.3);
    expect(hero.skills.s2).toBeUndefined();
  });

  it('raises Aki S1 detonation from 1.4 to 1.5 with exclusive 1; S3 is unchanged', () => {
    const plain=engine('aki');const ee=engine('aki',{exclusiveEquipment1:true});
    const s1=Heroes.aki.skills.s1;const s3=Heroes.aki.skills.s3;
    const tick=plain.getDotDamage(s1,DoT.burn);
    expect(plain.getDetonateDamage(false,s1)).toBeCloseTo(tick*4*1.4);
    expect(ee.getDetonateDamage(false,s1)).toBeCloseTo(tick*4*1.5);
    expect(ee.getDetonateDamage(true,s1)).toBeCloseTo(tick*4*1.5);
    expect(ee.getDetonateDamage(false,s3)).toBeCloseTo(plain.getDetonateDamage(false,s3));
  });

  it('uses manually entered burn turns even when an old profile still has exclusive 2 enabled', () => {
    const calc=engine('aki',{exclusiveEquipment2:true});const s1=Heroes.aki.skills.s1;
    const tick=calc.getDotDamage(s1,DoT.burn);
    expect(calc.getDetonateDamage(true,s1)).toBeCloseTo(tick*4*1.4);
    expect(calc.getDetonateDamage(false,s1)).toBeCloseTo(tick*4*1.4);
    expect(calc.getDetonateDamage(true,Heroes.aki.skills.s3)).toBeCloseTo(tick*4*1.4);
    expect(calc.form.targetBurnDetonate).toBe(4);
    expect(engine('aki',{exclusiveEquipment1:true,exclusiveEquipment2:true}).getDetonateDamage(false,s1)).toBeCloseTo(tick*4*1.5);
    expect(engine('aki',{targetBurnDetonate:0,exclusiveEquipment2:true}).getDetonateDamage(false,s1)).toBe(0);
  });

  it('removes Aki exclusive 2 and soulburn S1 without changing the single-target attack', () => {
    const s1=Heroes.aki.skills.s1;const calc=engine('aki',{exclusiveEquipment2:true});
    expect(Heroes.aki.heroSpecific).toEqual(['targetBurnDetonate','exclusiveEquipment1']);
    expect(s1.isAOE(calc.form,false)).toBe(false);expect(s1.isSingle(calc.form,false)).toBe(true);
    expect(calc.updateDamages().map(row=>row.skill)).toEqual(['s1','s3']);
    const withPen=engine('aki',{exclusiveEquipment2:true,penetrationSet:true});
    expect(withPen.getDamage(s1,false).normal!).toBeGreaterThan(calc.getDamage(s1,false).normal!);
  });

  it('adds Lilias exclusive 2 to the S1 enhancement bucket, including soulburn, without boosting S3', () => {
    const plain=engine('midnight_gala_lilias',{molagoras1:5});
    const ee=engine('midnight_gala_lilias',{molagoras1:5,exclusiveEquipment2:true});
    const hero=Heroes.midnight_gala_lilias;
    expect(hero.getSkillEnhanceMult(hero.skills.s1,plain.form)).toBeCloseTo(1.3);
    expect(hero.getSkillEnhanceMult(hero.skills.s1,ee.form)).toBeCloseTo(1.4);
    expect(ee.getDamage(hero.skills.s1,false).crit).toBe(1729);
    expect(ee.getDamage(hero.skills.s1,true).crit).toBe(2829);
    expect(ee.getDamage(hero.skills.s3).crit).toBe(plain.getDamage(hero.skills.s3).crit);
  });

  it('provides new hero search names and skill icons', () => {
    expect(heroSearchNames(yufine)).toContain('水玉玉');expect(heroSearchNames(moro)).toContain('名侦探');
    expect(skillIcon(yufine,'s1_extra')).toBe('/assets/skills/sk_c7016_1.png');
    expect(skillIcon(moro,'s3')).toBe('/assets/skills/sk_c2187_3.png');
    expect(skillName('bunny_girl_mafia_yufine_settlement')).toBe('决算');
  });

  it('ships full new library heroes, resource gains, all EE options and the artifact text/images', async () => {
    const heroes=await library<LibraryHero[]>('heroes');const artifacts=await library<LibraryArtifact[]>('artifacts');
    for(const code of ['bunny-girl-mafia-yufine','bunny-girl-great-detective-moro']){
      const hero=heroes.find(h=>h.code===code)!;
      expect(hero.dataStatus).toBe('complete');expect(hero.skills).toHaveLength(3);
      expect(hero.artwork).toBeTruthy();expect(hero.avatar).toBeTruthy();
      expect(hero.skills.every(s=>s.icon)).toBe(true);
    }
    const yf=heroes.find(h=>h.code==='bunny-girl-mafia-yufine')!;
    expect(yf.skills[0].isAoe).toBe(false);expect(yf.skills[0].pointGain).toBe(10);expect(yf.skills[2].pointGain).toBe(50);
    for(const code of ['aki','midnight-gala-lilias']){
      const ee=heroes.find(h=>h.code===code)!.exclusives[0];
      expect(ee.skillOptions).toHaveLength(3);expect(ee.iconKey).toBeTruthy();
    }
    expect(heroes.find(h=>h.code==='aki')!.exclusives[0].skillOptions[1].description).toContain('减少1回合');
    const artifact=artifacts.find(a=>a.code==='a-bosss-dignity')!;
    expect(artifact.name).toBe('老大的威严');expect(artifact.skillDescription).toContain('25.0(50.0)%');
    expect(artifact.skillDescription).toContain('速攻值提升15%');expect(artifact.image).toBeTruthy();expect(artifact.artwork).toBeTruthy();
  });
});
