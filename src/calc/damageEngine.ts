import * as _ from 'lodash-es';
import { Artifacts } from 'src/assets/data/artifacts';
import { BattleConstants } from 'src/assets/data/constants';
import { Heroes } from 'src/assets/data/heroes';
import { Target } from 'src/app/models/target';
import { Artifact, ArtifactDamageType } from 'src/app/models/artifact';
import { DamageFormData } from 'src/app/models/forms';
import { AftermathSkill, DoT, DoTSkill, HitType, Skill } from 'src/app/models/skill';

export interface DamageRow {
  skill: string;
  crit: number | null;
  crush: number | null;
  normal: number | null;
  miss: number | null;
  breakdown?: DamageBreakdown;
}

export interface DamageValues {
  crit: number | null;
  crush: number | null;
  normal: number | null;
  miss: number | null;
}

export interface DamageBreakdown {
  direct: DamageValues;
  detonate: DamageValues;
  other: DamageValues;
  total: DamageValues;
}

export interface DotDamage {
  type: DoT;
  value: number;
}

export interface BarrierValue {
  label: string;
  value: number;
}

const attackModifiers = [
  'decreasedAttack', 'attackUp', 'attackUpGreat', 'casterVigor', 'casterEnraged',
  'casterHasStarsBlessing', 'casterHasPossession', 'casterHasArchdemonsMight',
  'casterPromotionStack', 'casterSpoilsStack', 'casterPilfered', 'casterHasDemonBladeUnleashed',
  'casterOverload', 'casterEnergyDepletion', 'casterHasGodOfBattle',
];

const damageMultSets = ['rageSet', 'fervorSet', 'torrentSet'];

export class DamageEngine {
  form: DamageFormData;
  target = new Target();
  heroConstants: Record<string, number> = {
    beehooBurnMult: 1.3,
  };

  constructor(
    public heroId: string,
    public artifactId: string,
    values: Record<string, unknown>,
  ) {
    this.form = new DamageFormData({
      ...values,
      attackIncreasePercent: ((values.attackIncreasePercent as number | undefined) ?? 0) + ((values.attackIncrease as number | undefined) ?? 0),
      molagoraS1: values.molagoras1 ?? values.molagoraS1,
      molagoraS2: values.molagoras2 ?? values.molagoraS2,
      molagoraS3: values.molagoras3 ?? values.molagoraS3,
      heroID: heroId,
      artifactLevel: values.artifactLevel ?? 30,
    });
  }

  get currentHero() {
    return Heroes[this.heroId] ?? Heroes.abigail;
  }

  get currentArtifact(): Artifact {
    return Artifacts[this.artifactId] ?? Artifacts.noProc;
  }

  getGlobalDefenseMult(isAftermath = false): number {
    let mult = 1.0;

    for (const defenseModifier of ['targetDefenseUp', 'targetDefenseDown', 'targetVigor', 'targetHasTrauma', 'targetPilfered']) {
      mult += this.form[defenseModifier] ? BattleConstants[defenseModifier] : 0.0;
    }

    if (isAftermath && this.form.targetDefenseDownAftermath && !this.form.targetDefenseDown) {
      mult += BattleConstants.targetDefenseDown;
    }

    if (this.form.targetFractured) {
      mult -= Math.min(this.form.targetFractureStack, 10) * BattleConstants.fractureDefense;
    }

    if (this.form.targetHasTrauma && this.form.targetDefenseDown) {
      mult -= BattleConstants.trauma;
      mult *= 1 + BattleConstants.trauma;
    }
    return mult;
  }

  getGlobalAttackMult(): number {
    let mult = 0.0;

    attackModifiers.forEach((mod) => {
      if (!mod.endsWith('Stack')) {
        mult += this.form[mod] ? BattleConstants[mod] - 1 : 0.0;
      } else {
        const stack = this.form[mod];
        mult += stack ? BattleConstants[mod] * (stack as number) : 0.0;
      }
    });
    return mult + this.form.attackIncreasePercent / 100;
  }

  getGlobalDamageMult(skill: Skill, soulburn: boolean): number {
    let mult = 0.0;
    damageMultSets.forEach((set) => {
      const stack = _.get(this.form, `${set}Stack`, 1) as number;
      mult += (this.form[set] || !!this.form[`${set}Stack`]) ? _.get(BattleConstants, set) * stack : 0.0;
    });

    if (this.currentHero.element === this.form.defensePreset?.extraDamageElement) {
      mult += (this.form.defensePreset?.extraDamageMultiplier || 1) - 1;
    }

    if (skill.isSingle(this.form, soulburn) && this.form.defensePreset?.singleAttackMultiplier) {
      mult += this.form.defensePreset.singleAttackMultiplier - 1;
    }
    if (!skill.isSingle(this.form, soulburn) && this.form.defensePreset?.nonSingleAttackMultiplier) {
      mult += this.form.defensePreset.nonSingleAttackMultiplier - 1;
    }

    return mult;
  }

  offensivePower(skill: Skill, hitType: HitType, soulburn = false, isExtra = false) {
    const rate = skill.rate(soulburn, this.form, isExtra);
    const flatMod = skill.flat(soulburn, this.form, this.currentArtifact);
    const flatMod2 = this.currentArtifact.getFlatMult(this.form.artifactLevel, this.form, skill, soulburn, hitType, isExtra)
      + skill.flat2(this.form);
    const pow = typeof skill.pow === 'function' ? skill.pow(soulburn, this.form) : skill.pow;
    const skillEnhance = this.currentHero.getSkillEnhanceMult(skill, this.form);
    const elementalAdvantage = (this.form.elementalAdvantage || skill.elementalAdvantage(this.form))
      ? BattleConstants.elementalAdvantage
      : 1.0;
    const target = this.form.targetTargeted ? BattleConstants.target : 1.0;
    const laceration = this.form.targetLaceration ? BattleConstants.targetLaceration : 1.0;
    const heroAttack = this.currentHero.getAttack(this.currentArtifact, this.form, this.getGlobalAttackMult(), skill, soulburn, hitType, isExtra);
    const dmgMod = 1.0
      + this.getGlobalDamageMult(skill, soulburn)
      + this.form.damageIncrease / 100
      + this.currentArtifact.getDamageMultiplier(this.form.artifactLevel, this.form, skill, soulburn, hitType, isExtra)
      + (skill.mult ? skill.mult(soulburn, this.form, this.currentArtifact, heroAttack) - 1 : 0);

    return ((heroAttack * rate + flatMod) * BattleConstants.damageConstant + flatMod2)
      * pow
      * skillEnhance
      * elementalAdvantage
      * target
      * laceration
      * dmgMod;
  }

  getDotDamage(skill: Skill, type: DoT) {
    const casterAttack = this.currentHero.getAttack(this.currentArtifact, this.form, this.getGlobalAttackMult(), skill, false, HitType.normal);
    const casterSpeed = this.currentHero.getSpeed(this.form, this.currentArtifact);
    switch (type) {
      case DoT.bleed:
        return casterAttack * 0.4 * BattleConstants.damageConstant * this.target.defensivePower(DoTSkill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, false, casterAttack, casterSpeed, HitType.normal, true);
      case DoT.burn:
        return casterAttack * 0.7 * BattleConstants.damageConstant * (this.form.beehooPassive ? this.heroConstants.beehooBurnMult : 1) * this.target.defensivePower(DoTSkill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, false, casterAttack, casterSpeed, HitType.normal, true);
      case DoT.bomb:
        return casterAttack * 1.5 * BattleConstants.damageConstant * this.target.defensivePower(DoTSkill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, false, casterAttack, casterSpeed, HitType.normal, true);
      case DoT.nail:
        return this.currentHero.getAfterMathSkillDamage(this.getMagicNailSkill(), HitType.crit, true, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target);
      case DoT.rupture:
        return this.currentHero.getAfterMathSkillDamage(this.getRuptureSkill(), HitType.crit, true, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target);
      default:
        return 0;
    }
  }

  getDetonateDamage(soulburn: boolean, skill: Skill) {
    let damage = 0;

    if (hasDetonate(skill, DoT.bleed)) damage += this.form.targetBleedDetonate * skill.detonation(soulburn, this.form) * this.getDotDamage(skill, DoT.bleed);
    if (hasDetonate(skill, DoT.burn)) damage += this.form.targetBurnDetonate * skill.detonation(soulburn, this.form) * this.getDotDamage(skill, DoT.burn);
    if (hasDetonate(skill, DoT.bomb)) damage += this.form.targetBombDetonate * skill.detonation(soulburn, this.form) * this.getDotDamage(skill, DoT.bomb);

    return damage;
  }

  getAfterMathDamage(skill: Skill, hitType: HitType, soulburn: boolean) {
    const nailDamage = this.form.targetMagicNailed
      ? this.currentHero.getAfterMathSkillDamage(this.getMagicNailSkill(), hitType, soulburn, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target)
      : 0;
    const ruptureDamage = this.form.targetRuptured
      ? this.currentHero.getAfterMathSkillDamage(this.getRuptureSkill(), hitType, soulburn, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target)
      : 0;
    const buffDamage = this.currentHero.getAfterMathSkillDamage(this.getChallengeAftermathSkill(skill), hitType, soulburn, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target)
      + this.currentHero.getAfterMathSkillDamage(this.getSpecialFriendshipAftermathSkill(), hitType, soulburn, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target);
    const artiDamage = this.currentHero.getAfterMathArtifactDamage(skill, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target, soulburn, hitType) || 0;
    const skillDamage = this.currentHero.getAfterMathSkillDamage(skill, hitType, soulburn, this.currentArtifact, this.form, this.getGlobalAttackMult(), this.getGlobalDefenseMult(true), this.target);

    return this.getDetonateDamage(soulburn, skill)
      + nailDamage
      + ruptureDamage
      + buffDamage
      + artiDamage
      + skillDamage
      + (this.form.casterHasCascade ? 4000 : 0)
      + (this.form.casterHasAbundance ? 2000 : 0)
      + (this.form.casterHasOathOfPunishment ? 4000 : 0);
  }

  getOtherAfterMathDamage(skill: Skill, hitType: HitType, soulburn: boolean) {
    return this.getAfterMathDamage(skill, hitType, soulburn) - this.getDetonateDamage(soulburn, skill);
  }

  getDamage(skill: Skill, soulburn = false, isExtra = false, isCounter = false): DamageRow {
    const additionalDamageReduction = 1 - this.form.additionalDamageReduction / 100;
    const additionalDamageIncrease = this.form.pursuitSet ? 1.2 : 1;
    const casterAttack = this.currentHero.getAttack(this.currentArtifact, this.form, this.getGlobalAttackMult(), skill, soulburn, HitType.normal);
    const casterSpeed = this.currentHero.getSpeed(this.form, this.currentArtifact);
    let critDmgBuff = this.form.increasedCritDamage ? BattleConstants.increasedCritDamage : 0.0;
    critDmgBuff += this.form.casterHasStarsBlessing ? BattleConstants.casterHasStarsBlessing - 1 : 0;
    critDmgBuff += this.form.casterHasGodOfBattle ? this.form.critDamage / 100 : 0;
    const fixed = (skill.fixed(HitType.crit, this.form, this.currentArtifact, soulburn) + skill.fixed2(HitType.crit, this.form, this.currentArtifact, soulburn))
      * additionalDamageIncrease
      * additionalDamageReduction;
    const miss = 0.75 * this.offensivePower(skill, HitType.miss, soulburn, isExtra) * this.target.defensivePower(skill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, soulburn, casterAttack, casterSpeed, HitType.normal);
    const hit = this.offensivePower(skill, HitType.normal, soulburn, isExtra) * this.target.defensivePower(skill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, soulburn, casterAttack, casterSpeed, HitType.normal);
    const crush = 1.3 * this.offensivePower(skill, HitType.crush, soulburn, isExtra) * this.target.defensivePower(skill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, soulburn, casterAttack, casterSpeed, HitType.normal);
    const critHit = this.offensivePower(skill, HitType.crit, soulburn, isExtra) * this.target.defensivePower(skill, this.form, this.getGlobalDefenseMult(), this.currentArtifact, soulburn, casterAttack, casterSpeed, HitType.crit);
    const critDmg = Math.min(this.form.casterFinalCritDamage / 100 + critDmgBuff, 3.5)
      + (skill.critDmgBoost ? skill.critDmgBoost(soulburn, this.form) : 0)
      + (this.currentArtifact.getCritDmgBoost(this.form.artifactLevel, this.form, skill, soulburn, HitType.crit, isExtra) || 0)
      + (this.form.casterPerception ? BattleConstants.perception : 0);
    const detonate = this.getDetonateDamage(soulburn, skill);
    const otherCrit = this.getOtherAfterMathDamage(skill, HitType.crit, soulburn);
    const otherCrush = this.getOtherAfterMathDamage(skill, HitType.crush, soulburn);
    const otherNormal = this.getOtherAfterMathDamage(skill, HitType.normal, soulburn);
    const otherMiss = this.getOtherAfterMathDamage(skill, HitType.miss, soulburn);
    const direct: DamageValues = {
      crit: skill.noCrit || skill.onlyMiss ? null : Math.round(critHit * critDmg + fixed),
      crush: skill.noCrit || skill.onlyCrit(soulburn) || skill.onlyMiss ? null : Math.round(crush + fixed),
      normal: skill.onlyCrit(soulburn) || skill.onlyMiss ? null : Math.round(hit + fixed),
      miss: skill.noMiss ? null : Math.round(miss + fixed),
    };
    const detonateValues: DamageValues = {
      crit: direct.crit == null ? null : Math.round(detonate),
      crush: direct.crush == null ? null : Math.round(detonate),
      normal: direct.normal == null ? null : Math.round(detonate),
      miss: direct.miss == null ? null : Math.round(detonate),
    };
    const other: DamageValues = {
      crit: direct.crit == null ? null : Math.round(otherCrit),
      crush: direct.crush == null ? null : Math.round(otherCrush),
      normal: direct.normal == null ? null : Math.round(otherNormal),
      miss: direct.miss == null ? null : Math.round(otherMiss),
    };
    const total: DamageValues = {
      crit: addDamageParts(direct.crit, detonateValues.crit, other.crit),
      crush: addDamageParts(direct.crush, detonateValues.crush, other.crush),
      normal: addDamageParts(direct.normal, detonateValues.normal, other.normal),
      miss: addDamageParts(direct.miss, detonateValues.miss, other.miss),
    };

    return {
      skill: (skill.name || skill.id) + (soulburn ? '_soulburn' : (isExtra ? '_extra' : (isCounter && !skill.isCounter ? '_counter' : ''))),
      ...total,
      breakdown: detonate > 0 ? { direct, detonate: detonateValues, other, total } : undefined,
    };
  }

  getArtifactDamage(soulburn = false, hitType: HitType = HitType.crit): number {
    return Math.round(this.currentHero.getAfterMathArtifactDamage(
      new Skill({ id: 's1', isAOE: () => true, isSingle: () => true }),
      this.currentArtifact,
      this.form,
      this.getGlobalAttackMult(),
      this.getGlobalDefenseMult(true),
      this.target,
      soulburn,
      hitType,
    ) || 0);
  }

  getDotDamages(): DotDamage[] {
    return Array.from(new Set(this.currentHero.getDoT(this.currentArtifact)))
      .map((type) => ({ type, value: Math.round(this.getDotDamage(DoTSkill, type)) }))
      .filter((item) => item.value > 0);
  }

  getBarriers(soulburn = false): BarrierValue[] {
    const barriers: BarrierValue[] = [];
    const emptySkill = new Skill({});

    if (this.currentHero.barrier) {
      barriers.push({
        label: this.currentHero.barrierSkills?.[0] || 'S1',
        value: Math.round(this.currentHero.barrier(
          this.currentHero,
          emptySkill,
          this.currentArtifact,
          this.form,
          this.getGlobalAttackMult(),
          soulburn,
        ) * this.getBarrierEnhanceMultiplier(this.currentHero.barrierEnhance)),
      });
    }

    if (this.currentHero.barrier2) {
      barriers.push({
        label: this.currentHero.barrierSkills?.[1] || 'S2',
        value: Math.round(this.currentHero.barrier2(
          this.currentHero,
          emptySkill,
          this.currentArtifact,
          this.form,
          this.getGlobalAttackMult(),
          soulburn,
        ) * this.getBarrierEnhanceMultiplier(this.currentHero.barrier2Enhance)),
      });
    }

    if (
      this.currentArtifact.barrier
      && this.currentArtifact.type === ArtifactDamageType.barrier_only
      && this.currentArtifact.applies(emptySkill, this.form, soulburn, HitType.normal)
    ) {
      barriers.push({
        label: this.currentArtifact.id,
        value: Math.round(this.currentArtifact.barrier(
          this.currentHero,
          emptySkill,
          this.currentArtifact,
          this.form,
          this.getGlobalAttackMult(),
          soulburn,
          this.currentArtifact.getScale(this.form.artifactLevel),
        )),
      });
    }

    return barriers.filter((item) => item.value > 0);
  }

  private getBarrierEnhanceMultiplier(enhanceKey?: string): number {
    if (!enhanceKey) return 1;
    const skill = this.currentHero.skills[enhanceKey];
    if (!skill?.enhance?.length) return 1;
    const enhanceLevel = Number(this.form[`molagora${enhanceKey}`] ?? this.form[`molagoras${enhanceKey.replace(/\D/g, '')}`] ?? 0);
    return skill.enhance.slice(0, enhanceLevel).reduce((total, value) => total + value, 1);
  }

  updateDamages(): DamageRow[] {
    const rows: DamageRow[] = [];
    for (const skill of Object.values(this.currentHero.skills)) {
      if (skill.rate(false, this.form, false) || skill.pow(false, this.form) || skill.afterMath(HitType.crit, this.form, false) || skill.detonation(true, this.form)) {
        rows.push(this.getDamage(skill, false, false, skill.isCounter));
        if (skill.soulburn) rows.push(this.getDamage(skill, true, false));
        if (skill.canExtra && (this.currentArtifact.extraAttackBonus || skill.extraModifier)) rows.push(this.getDamage(skill, false, true));
      }
    }
    return rows;
  }

  getChallengeAftermathSkill(skill: Skill) {
    return this.form.casterHasChallenge && skill.id === 's1'
      ? new Skill({ afterMath: (hitType: HitType) => (hitType !== HitType.miss) ? new AftermathSkill({ targetMaxHPPercent: 0.1 }) : null })
      : new Skill({});
  }

  getSpecialFriendshipAftermathSkill() {
    return this.form.casterHasSpecialFriendship
      ? new Skill({ afterMath: (hitType: HitType) => (hitType === HitType.crit) ? new AftermathSkill({ hpPercent: 0.08 }) : null })
      : new Skill({});
  }

  getMagicNailSkill() {
    return this.form.targetMagicNailed
      ? new Skill({ afterMath: () => new AftermathSkill({ attackPercent: 0.8 }) })
      : new Skill({});
  }

  getRuptureSkill() {
    return this.form.targetRuptured
      ? new Skill({ afterMath: () => new AftermathSkill({ targetMaxHPPercent: 0.12 }) })
      : new Skill({});
  }
}

function addDamageParts(base: number | null, ...parts: Array<number | null>) {
  if (base == null) return null;
  let total = base;
  for (const value of parts) total += value ?? 0;
  return total;
}

function hasDetonate(skill: Skill, type: DoT) {
  const detonates = skill.detonate as DoT[] | DoT;
  return Array.isArray(detonates) ? detonates.includes(type) : detonates === type;
}
