import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AntiSoulSchema } from '../../src/schemas/anti-soul.js';

describe('AntiSoulSchema', () => {
  it('should validate the actual anti-soul.json file', () => {
    const json = JSON.parse(readFileSync('soul/anti-soul.json', 'utf-8'));
    const result = AntiSoulSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toBeDefined();
    }
  });

  it('should have expected anti-soul categories', () => {
    const json = JSON.parse(readFileSync('soul/anti-soul.json', 'utf-8'));
    const result = AntiSoulSchema.safeParse(json);

    if (result.success) {
      const categories = Object.keys(result.data.categories);
      expect(categories).toContain('excessive_sentiment');
      expect(categories).toContain('cliche_simile');
    }
  });

  it('should reject anti-soul without categories', () => {
    const invalid = {};
    const result = AntiSoulSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});
