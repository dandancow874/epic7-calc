import { heroSearchNames } from '../../data/catalog';
import { calculatorHeroIdForLibraryCode } from '../build-presets/calculatorBuildBridge';
import type { LibraryHero } from '../../library/types';
import type { RecognitionField, RecognizedHero } from './types';

export function matchHeroName(ocrName: string, heroes: LibraryHero[]): RecognitionField<RecognizedHero> {
  const query = normalizeName(ocrName);
  const candidates = heroes
    .map((hero) => ({
      hero,
      confidence: Math.max(...heroNames(hero).map((name) => nameScore(query, normalizeName(name)))),
    }))
    .filter((candidate) => candidate.confidence >= 0.5)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);
  const best = candidates[0];
  const ambiguous = best && candidates[1] && best.confidence - candidates[1].confidence < 0.04;
  return {
    value: best && !ambiguous ? heroValue(best.hero) : null,
    confidence: best?.confidence || 0,
    source: 'catalog-match',
    alternatives: candidates.map((candidate) => ({ value: heroValue(candidate.hero), confidence: candidate.confidence })),
  };
}

export function matchHeroNameWithRoleFallback(ocrName: string, heroes: LibraryHero[], roleHint: LibraryHero['role'] | null) {
  if (!roleHint) return matchHeroName(ocrName, heroes);
  const narrowed = matchHeroName(ocrName, heroes.filter((hero) => hero.role === roleHint));
  if (narrowed.value) return narrowed;
  const unrestricted = matchHeroName(ocrName, heroes);
  return unrestricted.confidence > narrowed.confidence ? unrestricted : narrowed;
}

function heroNames(hero: LibraryHero) {
  const aliasId = calculatorHeroIdForLibraryCode(hero.code) || hero.code.replaceAll('-', '_');
  return [
    hero.name, hero.nameEn || '', hero.nameZht || '', ...hero.nicknames,
    ...heroSearchNames(aliasId).split(/[,，\s]+/),
  ].filter(Boolean);
}

function heroValue(hero: LibraryHero): RecognizedHero {
  return { heroCode: hero.code, gameId: hero.gameId, displayName: hero.name };
}

function nameScore(query: string, candidate: string) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  const chineseQuery = query.replace(/[^\u3400-\u9fff]/g, '');
  const chineseCandidate = candidate.replace(/[^\u3400-\u9fff]/g, '');
  if (chineseQuery.length >= 2 && (
    chineseCandidate.startsWith(chineseQuery)
    || (chineseCandidate.length >= 2 && chineseQuery.startsWith(chineseCandidate))
  )) {
    return 0.8 + 0.18 * Math.min(1, Math.min(chineseQuery.length, chineseCandidate.length) / Math.max(chineseQuery.length, chineseCandidate.length));
  }
  if (query.includes(candidate) || candidate.includes(query)) return 0.92 * Math.min(query.length, candidate.length) / Math.max(query.length, candidate.length);
  const distance = levenshtein(query, candidate);
  return Math.max(0, 1 - distance / Math.max(query.length, candidate.length));
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase().normalize('NFKC').replace(/[\s·・’'“”"_.-]/g, '');
}

function levenshtein(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[right.length];
}
