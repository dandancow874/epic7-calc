export type HeroTagOverride = { add?: string[]; remove?: string[] };

// Special skills that cannot be classified reliably from structured effects or text
// can be corrected here without changing the generic tag extractor.
export const heroTagOverrides: Record<string, HeroTagOverride> = {};
