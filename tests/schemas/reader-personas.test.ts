import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ReaderPersonasSchema } from '../../src/schemas/reader-personas.js';

describe('ReaderPersonasSchema', () => {
  it('should validate the actual reader-personas.json file', () => {
    const json = JSON.parse(readFileSync('soul/reader-personas.json', 'utf-8'));
    const result = ReaderPersonasSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personas).toHaveLength(5);
    }
  });

  it('should have valid evaluation weights summing to 1.0', () => {
    const json = JSON.parse(readFileSync('soul/reader-personas.json', 'utf-8'));
    const result = ReaderPersonasSchema.safeParse(json);

    if (result.success) {
      for (const persona of result.data.personas) {
        const weights = persona.evaluation_weights;
        const sum =
          weights.style +
          weights.plot +
          weights.character +
          weights.worldbuilding +
          weights.readability;
        expect(sum).toBeCloseTo(1.0, 1);
      }
    }
  });

  it('should have expected persona IDs', () => {
    const json = JSON.parse(readFileSync('soul/reader-personas.json', 'utf-8'));
    const result = ReaderPersonasSchema.safeParse(json);

    if (result.success) {
      const ids = result.data.personas.map((p) => p.id);
      expect(ids).toContain('sf-enthusiast');
      expect(ids).toContain('literary-reader');
      expect(ids).toContain('editor');
      expect(ids).toContain('bradbury-enthusiast');
      expect(ids).toContain('structure-critic');
    }
  });
});
