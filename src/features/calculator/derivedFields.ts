import { Heroes } from '../../assets/data/heroes';
import { DoT } from '../../app/models/skill';

export function withDerivedCalculatorFields(fields: string[], heroId?: string) {
  const next = [...fields];
  if (next.includes('casterMaxHP') && !next.includes('casterMaxHPIncrease')) {
    next.push('casterMaxHPIncrease');
  }
  if (next.includes('casterMaxHP') && !next.includes('casterLingeringFragranceStack')) {
    next.push('casterLingeringFragranceStack');
  }
  if (next.includes('casterMaxHP') && !next.includes('casterHasSuperhumanization')) {
    next.push('casterHasSuperhumanization');
  }
  if (next.includes('casterDefense')) {
    for (const field of ['casterDefenseUp', 'casterDefenseDown', 'casterVigor', 'casterIndomitable', 'casterHasTrauma']) {
      if (!next.includes(field)) next.push(field);
    }
  }
  if (next.includes('casterSpeed')) {
    for (const field of ['casterSpeedUp', 'casterSpeedDown', 'casterEnraged', 'casterRampage', 'casterHasSuperhumanization']) {
      if (!next.includes(field)) next.push(field);
    }
  }
  if (next.includes('targetSpeed')) {
    for (const field of ['targetSpeedUp', 'targetSpeedDown', 'targetHasRampage']) {
      if (!next.includes(field)) next.push(field);
    }
  }
  if (heroId && Heroes[heroId]?.dot?.includes(DoT.burn) && !next.includes('beehooPassive')) {
    next.push('beehooPassive');
  }
  return next;
}
