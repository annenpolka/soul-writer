import { describe, it, expect } from 'vitest';
import { TONE_CATALOG, TONE_DIRECTIVES, pickRandom } from '../../src/factory/diversity-catalog.js';

describe('TONE_CATALOG', () => {
  it('should have at least 10 entries', () => {
    expect(TONE_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('should have unique labels', () => {
    const labels = TONE_CATALOG.map(t => t.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('every entry should have non-empty label and directive', () => {
    for (const entry of TONE_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.directive.length).toBeGreaterThan(0);
    }
  });

  it('should include diverse tones (not all cold/analytical)', () => {
    const labels = TONE_CATALOG.map(t => t.label);
    // Check for warm/humorous/angry tones exist
    expect(labels).toContain('脆い温もり');
    expect(labels).toContain('ドライユーモア');
    expect(labels).toContain('怒りと反逆');
    expect(labels).toContain('好奇心と発見');
    expect(labels).toContain('日常の手触り');
  });
});

describe('TONE_DIRECTIVES (deprecated)', () => {
  it('should have the same length as TONE_CATALOG', () => {
    expect(TONE_DIRECTIVES.length).toBe(TONE_CATALOG.length);
  });

  it('should contain the directive strings from TONE_CATALOG', () => {
    for (let i = 0; i < TONE_CATALOG.length; i++) {
      expect(TONE_DIRECTIVES[i]).toBe(TONE_CATALOG[i].directive);
    }
  });
});

describe('pickRandom', () => {
  it('should return an element from the array', () => {
    const arr = ['a', 'b', 'c'];
    const result = pickRandom(arr);
    expect(arr).toContain(result);
  });

  it('should work with readonly arrays', () => {
    const result = pickRandom(TONE_CATALOG);
    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('directive');
  });
});
