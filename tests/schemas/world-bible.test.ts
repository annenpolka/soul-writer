import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WorldBibleSchema } from '../../src/schemas/world-bible.js';

describe('WorldBibleSchema', () => {
  it('should validate the actual world-bible.json file', () => {
    const json = JSON.parse(readFileSync('soul/world-bible.json', 'utf-8'));
    const result = WorldBibleSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.technology).toHaveProperty('ar_contact');
      expect(result.data.characters).toHaveProperty('御鐘透心');
      expect(result.data.characters).toHaveProperty('愛原つるぎ');
    }
  });

  it('should reject world-bible without required sections', () => {
    const invalid = { technology: {} };
    const result = WorldBibleSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });

  it('should validate character with required fields', () => {
    const json = JSON.parse(readFileSync('soul/world-bible.json', 'utf-8'));
    const result = WorldBibleSchema.safeParse(json);

    if (result.success) {
      const touko = result.data.characters['御鐘透心'];
      expect(touko.role).toBeDefined();
      expect(touko.traits).toBeDefined();
    }
  });
});
