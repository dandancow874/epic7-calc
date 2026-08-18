import type { LibraryAttribute, LibraryHero, LibraryRole, LibraryZodiac } from '../../library/types';

export type HeroFilters = {
  query: string;
  roles: LibraryRole[];
  attributes: LibraryAttribute[];
  rarities: number[];
  zodiacs: LibraryZodiac[];
  advancedTags: string[];
};

export function filterHeroes(heroes: LibraryHero[], filters: HeroFilters) {
  const needle = filters.query.trim().toLocaleLowerCase();
  return heroes.filter((hero) => {
    const text = [hero.name, hero.nameEn, hero.nameZht, ...hero.nicknames].filter(Boolean).join(' ').toLocaleLowerCase();
    return (!needle || text.includes(needle))
      && (!filters.roles.length || filters.roles.includes(hero.role))
      && (!filters.attributes.length || filters.attributes.includes(hero.attribute))
      && (!filters.rarities.length || filters.rarities.includes(hero.rarity))
      && (!filters.zodiacs.length || (hero.zodiac !== null && filters.zodiacs.includes(hero.zodiac)))
      && filters.advancedTags.every((tag) => hero.tags.includes(tag));
  });
}
