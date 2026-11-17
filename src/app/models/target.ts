import { BattleConstants } from "src/assets/data/constants";
import { Artifact } from "./artifact";
import { DamageFormData } from "./forms";
import { HitType, Skill } from "./skill";

export class Target {

    getDefense(inputValues: DamageFormData, globalDefMult: number) {
      const defMult = globalDefMult + inputValues.targetDefenseIncrease / 100;
      return inputValues.targetDefense * defMult;
    }
  
    getPenetration(skill: Skill, inputValues: DamageFormData, artifact: Artifact, soulburn: boolean, casterAttack: number, casterSpeed: number, hitType: HitType) {
      const base = skill.penetrate(soulburn, inputValues, artifact, casterAttack, casterSpeed);
      const artifactPenetration = artifact.getDefensePenetration(inputValues.artifactLevel, inputValues, skill, soulburn, hitType);
      const set = (skill.isSingle(inputValues, soulburn)) && inputValues.penetrationSet ? BattleConstants.penetrationSet : 0;
      // These buffs affect attacks, not fixed-penetration aftermath or DoT.
      // Normal/greater are one exclusive buff; single attacks double its value.
      const penetrationBuff = skill.id === 'FixedPenetration' ? 0
        : (inputValues.casterHasIncreasePenetrationGreater ? BattleConstants.casterHasIncreasePenetrationGreater
          : inputValues.casterHasIncreasePenetration ? BattleConstants.casterHasIncreasePenetration : 0)
          * (skill.isSingle(inputValues, soulburn) ? 2 : 1);
      const penResist = skill.id !== 'FixedPenetration' ? inputValues.penetrationResistance / 100 : 0;

      // Each source of penetration is mitigated by pen resist
      const totalPenetration = (1 - (base * (1 - penResist)))
                             * (1 - (set * (1 - penResist)))
                             * (1 - (artifactPenetration * (1 - penResist)))
                             * (1 - (penetrationBuff * (1 - penResist)))

      return Math.min(1, totalPenetration);
    }
  
    defensivePower(skill: Skill, inputValues: DamageFormData, globalDefMult: number, artifact: Artifact, soulburn: boolean, casterAttack: number, casterSpeed: number, hitType: HitType, noReduc = false) {
      const dmgReduc = noReduc || skill.ignoreDamageReduction(inputValues) ? 0 : inputValues.damageReduction / 100;
      const dmgTrans = (skill.ignoreDamageTransfer(inputValues) || artifact.ignoreDamageTransfer(inputValues)) ? 0 : inputValues.damageTransfer / 100;
      return ((1 - dmgReduc) * (1 - dmgTrans)) / (((this.getDefense(inputValues, globalDefMult) / 300) * this.getPenetration(skill, inputValues, artifact, soulburn, casterAttack, casterSpeed, hitType)) + 1);
    }
  }
