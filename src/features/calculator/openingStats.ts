import { Heroes } from '../../assets/data/heroes';

/** Mei Lin's supported builds use equipment-panel Attack as the Defense reference. */
export function openingAttackDefense(heroId: string, attack: number, defense: number) {
  if (!Heroes[heroId]?.equalizesAttackDefense) return { attack, defense };
  return { attack, defense: attack };
}
