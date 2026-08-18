import { describe, expect, it } from 'vitest';
import { gameDigitTemplates } from './gameDigitTemplates';
import { decodeHexBitmap, recognizeNormalizedGlyph } from './digitRecognizer';

describe('game panel digit recognizer', () => {
  it('recognizes every packaged game digit template', () => {
    for (const [digit, variants] of Object.entries(gameDigitTemplates)) {
      for (const hex of variants) {
        const result = recognizeNormalizedGlyph(decodeHexBitmap(hex));
        expect(result.char).toBe(digit);
        expect(result.confidence).toBe(1);
      }
    }
  });
});
