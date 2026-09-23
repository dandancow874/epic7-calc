import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { LibraryArtifact, LibraryHero } from './types';

async function readGenerated<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../../public/library/${name}`, import.meta.url), 'utf8')) as T;
}

describe('generated library data', () => {
  it('matches the complete source indexes', async () => {
    const [heroes, artifacts, manifest] = await Promise.all([
      readGenerated<LibraryHero[]>('heroes.json'), readGenerated<LibraryArtifact[]>('artifacts.json'),
      readGenerated<{ heroCount: number; artifactCount: number }>('manifest.json'),
    ]);
    expect(heroes).toHaveLength(manifest.heroCount);
    expect(artifacts).toHaveLength(manifest.artifactCount);
  });

  it('marks only heroes with skills and stats as complete', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    expect(heroes.every((hero) => hero.dataStatus === 'summary-only' || (hero.skills.length > 0 && Boolean(hero.baseStats)))).toBe(true);
    expect(heroes.filter((hero) => hero.dataStatus === 'summary-only').map((hero) => hero.code).sort()).toEqual([]);
    for (const code of ['aube', 'tidal-rift-elvira']) {
      const hero = heroes.find((record) => record.code === code);
      expect(hero?.skills).toHaveLength(3);
      expect(hero?.baseStats).toBeTruthy();
      expect(hero?.artwork).toBeTruthy();
    }
  });

  it('includes maintained gear-score passive adjustments', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const adjustment = (code: string) => heroes.find((hero) => hero.code === code)?.gearScoreAdjustments;
    expect(adjustment('aubade-ludwig')?.finalMultipliers.def).toBe(1.3);
    expect(adjustment('aki')?.finalMultipliers.atk).toBe(1.5);
    expect(adjustment('beehoo')?.finalMultipliers.atk).toBe(1.3);
    expect(adjustment('arunka')?.finalMultipliers.atk).toBe(1.3);
    expect(adjustment('summertime-iseria')?.finalMultipliers.atk).toBe(1.5);
    expect(adjustment('senya')?.finalMultipliers.atk).toBe(1.5);
    expect(adjustment('ram')?.finalMultipliers.atk).toBe(1.3);
    expect(adjustment('gunther')?.finalMultipliers.atk).toBe(1.75);
    expect(adjustment('dragon-bride-senya')?.finalMultipliers.hp).toBe(1.1);
    expect(adjustment('lethe')?.finalMultipliers.hp).toBe(1.1);
    expect(adjustment('eaton')?.finalMultipliers.hp).toBe(1.2);
    expect(adjustment('beehoo')?.additivePercentPoints.eff).toBe(30);
    expect(adjustment('beehoo')?.libraryBaseStatsIncludes).toContain('eff');
    expect(adjustment('westwind-executioner-schuri')?.additivePercentPoints.eff).toBe(30);
    expect(adjustment('westwind-executioner-schuri')?.libraryBaseStatsIncludes).toContain('eff');
    expect(adjustment('claudia')?.additivePercentPoints.eff).toBe(30);
    expect(adjustment('claudia')?.libraryBaseStatsIncludes).toContain('eff');
  });

  it('keeps Dark Corvus updated S3 text, multiplier, and effect', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const hero = heroes.find((record) => record.code === 'dark-corvus');
    const s3 = hero?.skills.find((skill) => skill.id === 'sk_c2012_3');
    const hpMultiplier = s3?.multipliers
      ?.find((multiplier) => multiplier.id === 'skill_multiplier')
      ?.items.find((item) => item.key === 'BF_BONUSATT_UP_STATUS_ADD_max_hp_rate');

    expect(s3?.description).toContain('无视伤害分配效果');
    expect(hpMultiplier?.value).toBe('31.0');
    expect(s3?.effects.some((effect) => effect.id === 'ignore_damage_share')).toBe(true);
  });

  it('keeps Rhianna and Luciella S2 forms and soulburn multipliers separate', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const s2 = heroes.find((record) => record.code === 'rhianna-and-luciella')?.skills
      .find((skill) => skill.id === 'sk_c2185_2');
    const value = (groupId: string, itemKey: string) => s2?.multipliers
      ?.find((group) => group.id === groupId)?.items.find((item) => item.key === itemKey)?.value;

    expect(s2?.multipliers?.map((group) => group.name)).toEqual(['里安娜倍率', '路西艾拉倍率', '灵魂燃烧倍率']);
    expect(value('rhianna', 'att_rate')).toBe('1.0');
    expect(value('rhianna', 'pow')).toBe('1.0');
    expect(value('luciella', 'att_rate')).toBe('1.5');
    expect(value('luciella', 'pow')).toBe('1.0');
    expect(value('soulburn', 'att_rate')).toBe('3.0');
    expect(value('soulburn', 'pow')).toBe('1.0');
    expect(s2?.soulBurn).toEqual({
      cost: 20,
      description: '里安娜：无视效果抗性。路西艾拉：伤害量提升。',
    });
    expect(s2?.multipliers?.flatMap((group) => group.items).some((item) => item.key === 'CSP_STATUS_UP_SELF_STATUS_rate')).toBe(false);
  });

  it('includes Christy specialty-change rune tree', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const christy = heroes.find((hero) => hero.code === 'christy');
    const specialtyChange = christy?.specialtyChange;

    expect(christy?.nicknames).toContain('克里丝媞');
    expect(specialtyChange?.generalEffects.map((effect) => effect.name)).toEqual([
      '繁荣符文', '守护符文', '楔子符文', '疾走符文', '信赖符文',
    ]);
    expect(specialtyChange?.generalEffects[1]?.description).toContain('30%');
    expect(specialtyChange?.skillEffects.map((skill) => skill.name)).toEqual(['守护之剑', '誓约盾牌', '龙骑士助阵']);
    expect(specialtyChange?.skillEffects[0]?.effects.map((effect) => effect.name)).toEqual(['认知符文', '获得符文', '果实符文']);
    expect(specialtyChange?.skillEffects[0]?.icon).toBe('/library/heroes/christy-sk_c3123_1.png');
    expect(specialtyChange?.skillEffects[2]?.effects[0]?.description).toContain('恢复量提升20%');
  });

  it('includes Magic Scholar Doris specialty-change rune tree', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const doris = heroes.find((hero) => hero.code === 'magic-scholar-doris');
    const specialtyChange = doris?.specialtyChange;

    expect(specialtyChange?.generalEffects.map((effect) => effect.name)).toEqual([
      '信仰符文', '繁荣符文', '收获符文', '秩序符文', '孤独符文', '圣物符文', '健康符文',
    ]);
    expect(specialtyChange?.generalEffects[2]?.description).toContain('黑暗属性敌人暴击');
    expect(specialtyChange?.skillEffects.map((skill) => skill.name)).toEqual(['魔力弹', '太初之光']);
    expect(specialtyChange?.skillEffects[0]?.effects.map((effect) => effect.name)).toEqual(['牺牲符文', '守护符文']);
    expect(specialtyChange?.skillEffects[0]?.icon).toBe('/library/heroes/magic-scholar-doris-sk_c4044_1.png');
    expect(specialtyChange?.skillEffects[1]?.effects[0]?.description).toContain('额外解除');
  });

  it('includes Haru, Renoa, current balance data, and the two supplied specialty-change trees', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const byCode = (code: string) => heroes.find((hero) => hero.code === code);

    expect(byCode('haru')?.name).toBe('小春');
    expect(byCode('haru')?.skills.map((skill) => skill.name)).toEqual(['力量之锚', '锚点追踪', '锚之打击']);
    const haruS1 = byCode('haru')?.skills.find((skill) => skill.id === 'sk_c1192_1');
    const haruS3 = byCode('haru')?.skills.find((skill) => skill.id === 'sk_c1192_2');
    expect(haruS1?.isAoe).toBe(false);
    expect(haruS3?.isAoe).toBe(false);
    expect(haruS3?.multipliers?.[0]?.name).toBe('锚之打击详细倍率');
    expect(haruS3?.multipliers?.[0]?.items.map((item) => item.label)).toEqual(expect.arrayContaining([
      '生命值伤害加成', '每次使用后的整段伤害提升', '目标处于防护罩时防御穿透', '生命恢复', '士气效果', '灵魂燃烧',
    ]));
    expect(haruS3?.multipliers?.[0]?.items.find((item) => item.key === 'damage_heal')?.displayValue).toBe('造成伤害的30.0%');
    expect(haruS3?.multipliers?.[0]?.items.find((item) => item.key === 'soulburn_hit')?.displayValue).toContain('伤害倍率不变');
    expect(byCode('renoa')?.name).toBe('蕾诺娅');
    expect(byCode('renoa')?.skills[0]?.enhancements).toHaveLength(8);
    expect(byCode('renoa')?.skills[0]?.enhancements.at(-1)?.text).toBe('伤害量提升10%');
    expect(byCode('renoa')?.skills[2]?.enhancements).toHaveLength(8);
    expect(byCode('renoa')?.skills[2]?.enhancements.at(-1)?.text).toBe('速攻值提升4%');
    expect(byCode('renoa')?.skills[1]?.multipliers?.[0]?.items.filter((item) => item.key === 'BF_DMG_UP_value')).toHaveLength(14);

    const yufineMultipliers = byCode('abyssal-yufine')?.skills[0]?.multipliers;
    expect(yufineMultipliers?.map((group) => group.name)).toEqual([
      '龙之吐息倍率', '龙之吐息灵魂燃烧倍率', '暴走倍率', '暴走灵魂燃烧倍率',
    ]);
    const yufineOutburst = yufineMultipliers?.find((group) => group.id === 'proc_multiplier');
    expect(yufineOutburst?.items.find((item) => item.key === 'att_rate')?.value).toBe('0.43');
    expect(yufineOutburst?.items.find((item) => item.key === 'def_pen')?.value).toBe('100%');
    const yufineSoulburnOutburst = yufineMultipliers?.find((group) => group.id === 'proc_soulburn_multiplier');
    expect(yufineSoulburnOutburst?.items.find((item) => item.key === 'att_rate')?.value).toBe('0.6');
    expect(yufineSoulburnOutburst?.items.find((item) => item.key === 'def_pen')?.value).toBe('100%');

    const axeSoulburn = byCode('chaos-sect-axe')?.skills.find((skill) => skill.id === 'sk_c4025_3')
      ?.multipliers?.find((group) => group.id === 'soulburn_multiplier');
    expect(axeSoulburn?.items.find((item) => item.key === 'att_rate')?.displayValue).toBe('1.5');
    expect(axeSoulburn?.items.find((item) => item.key === 'pow')?.displayValue).toBe('0.9');
    expect(axeSoulburn?.items.find((item) => item.key === 'BF_BONUSATT_UP_STATUS_ADD_max_hp_rate')?.displayValue).toContain('30.0%');

    const chouxBzzt = byCode('urban-shadow-choux')?.skills.find((skill) => skill.id === 'sk_c2101_2')
      ?.effects?.find((effect) => effect.name.includes('酥酥麻麻'));
    expect(chouxBzzt?.description).toContain('2500点额外伤害');

    const axeRunes = byCode('chaos-sect-axe')?.specialtyChange;
    expect(axeRunes?.generalEffects.map((effect) => effect.name)).toEqual([
      '大地符文3', '收获符文3', '楔子符文3', '生命符文3', '健康符文3', '芒刺符文3',
    ]);
    expect(axeRunes?.skillEffects[0]?.effects.map((effect) => effect.name)).toEqual(['勇气符文3', '疾病符文3', '未知符文3']);

    const glennRunes = byCode('vigilante-leader-glenn')?.specialtyChange;
    expect(glennRunes?.generalEffects[3]?.description).toContain('50%以上');
    expect(glennRunes?.skillEffects.map((skill) => skill.name)).toEqual(['神速射击', '精确打击', '解除限制器']);
  });

  it('publishes the updated artifact descriptions', async () => {
    const artifacts = await readGenerated<LibraryArtifact[]>('artifacts.json');
    const byCode = (code: string) => artifacts.find((artifact) => artifact.code === code);
    expect(byCode('sphere-of-sadism')?.skillDescription).toContain('8.0(16.0)%');
    expect(byCode('sphere-of-sadism')?.skillDescription).not.toContain('防护罩状态');
    expect(byCode('spear-of-a-new-dawn')?.skillDescription).toContain('额外伤害');
  });

  it('publishes exact aftermath coefficients and the supplied new artifact artwork', async () => {
    const artifacts = await readGenerated<LibraryArtifact[]>('artifacts.json');
    const byCode = (code: string) => artifacts.find((artifact) => artifact.code === code);
    const expected = new Map([
      ['spear-of-a-new-dawn', '自身攻击力的50%'],
      ['tome-of-lifes-end', '自身攻击力的40%'],
      ['3f', '自身最大生命值的9%'],
      ['rocket-punch-gauntlet', '自身防御力的100%'],
      ['moas', '自身防御力的100%'],
      ['uberiuss-tooth', '自身攻击力的45%'],
      ['reingars-special-drink', '自身攻击力的45%'],
    ]);
    for (const [code, coefficient] of expected) {
      expect(byCode(code)?.skillDescription).toContain(coefficient);
      expect(byCode(code)?.skillDescription).toContain('穿透目标70%的防御力');
    }

    expect(byCode('custom-made-power-anchor')).toMatchObject({
      image: '/library/artifacts/custom-made-power-anchor.png',
      artwork: '/library/artifact-artworks/custom-made-power-anchor.png',
    });
    expect(byCode('sorrow-of-the-rose')).toMatchObject({
      image: '/library/artifacts/sorrow-of-the-rose.png',
      artwork: '/library/artifact-artworks/sorrow-of-the-rose.png',
    });
  });

  it('includes Argent Waves Hwayoung exclusive equipment update', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const hero = heroes.find((record) => record.code === 'argent-waves-hwayoung');
    const exclusive = hero?.exclusives.find((equipment) => equipment.id === 'exc512801');

    expect(exclusive?.name).toBe('勇气的航迹');
    expect(exclusive?.mainStat).toEqual({ type: 'att_rate', min: 0.07, max: 0.14 });
    expect(exclusive?.skillOptions).toEqual([
      { skillNumber: 2, description: '使用飞燕脚时，攻击前使自身在2回合内获得命中提升效果。' },
      { skillNumber: 2, description: '飞燕脚效果所提升的速攻值额外提升10%。' },
      { skillNumber: 3, description: '银色闪光的伤害量提升10%。' },
    ]);
  });

  it('includes Young Senya exclusive equipment update', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const exclusive = heroes.find((record) => record.code === 'young-senya')?.exclusives
      .find((equipment) => equipment.id === 'exc116201');

    expect(exclusive?.mainStat).toEqual({ type: 'max_hp_rate', min: 0.07, max: 0.14 });
    expect(exclusive?.skillOptions[1]?.description).toContain('最大生命值的20%');
    expect(exclusive?.skillOptions[2]?.description).toContain('防护罩');
  });

  it('records Estelle fighting-spirit gains on the skills that grant them', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const skills = heroes.find((hero) => hero.code === 'estelle')?.skills || [];
    expect(skills.find((skill) => skill.id === 'sk_c1183_1')?.description).toContain('获得斗志25点');
    expect(skills.find((skill) => skill.id === 'sk_c1183_3')?.description).toContain('获得斗志50点');
  });

  it('keeps Cermias S2 exclusive barrier multiplier in the library', async () => {
    const heroes = await readGenerated<LibraryHero[]>('heroes.json');
    const exclusive = heroes.find((record) => record.code === 'cermia')?.exclusives[0];
    expect(exclusive?.skillOptions[1]?.description).toContain('自身攻击力120.0%');
  });

  it('represents missing artifact images explicitly', async () => {
    const artifacts = await readGenerated<LibraryArtifact[]>('artifacts.json');
    expect(artifacts.every((artifact) => artifact.image === null || artifact.image.startsWith('/'))).toBe(true);
    expect(artifacts.every((artifact) => artifact.code && artifact.name && artifact.role)).toBe(true);
  });
});
