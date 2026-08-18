import { describe, expect, it } from 'vitest';
import { mergeStatRecognition, parseFirstNumber } from './validateRecognition';

describe('build screenshot recognition validation', () => {
  it('uses OCR to correct a low-confidence visual digit result', () => {
    expect(mergeStatRecognition('hp', { value: 26400, confidence: 0.59, source: 'digit-template' }, '生命值 28400 21068')).toMatchObject({
      value: 28400,
      source: 'windows-ocr',
    });
  });

  it('keeps a high-confidence game template result when OCR disagrees', () => {
    expect(mergeStatRecognition('atk', { value: 1527, confidence: 0.95, source: 'digit-template' }, '攻击力 157')).toMatchObject({
      value: 1527,
      source: 'digit-template',
    });
  });

  it('parses the first displayed number and normalizes OCR letter O', () => {
    expect(parseFirstNumber('暴击率 1OO.O% 85.0%')).toBe(100);
  });
});
