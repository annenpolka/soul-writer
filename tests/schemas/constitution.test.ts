import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ConstitutionSchema } from '../../src/schemas/constitution.js';

describe('ConstitutionSchema', () => {
  it('should validate the actual constitution.json file', () => {
    const json = JSON.parse(readFileSync('soul/constitution.json', 'utf-8'));
    const result = ConstitutionSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta.soul_id).toBe('my-lion');
      expect(result.data.meta.soul_name).toBe('わたしのライオン');
    }
  });

  it('should reject invalid constitution without meta', () => {
    const invalid = { sentence_structure: {} };
    const result = ConstitutionSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });

  it('should reject constitution with invalid metaphor_density', () => {
    const invalid = {
      meta: {
        soul_id: 'test',
        soul_name: 'Test',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      sentence_structure: {
        rhythm_pattern: 'test',
        taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
        typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
      },
      vocabulary: {
        bracket_notations: [],
        forbidden_words: [],
        characteristic_expressions: [],
        special_marks: { mark: '×', usage: 'test', forms: [] },
      },
      rhetoric: {
        simile_base: 'test',
        metaphor_density: 'invalid', // Should be 'low', 'medium', or 'high'
        forbidden_similes: [],
        personification_allowed_for: [],
      },
      narrative: {
        default_pov: 'test',
        pov_by_character: {},
        default_tense: 'test',
        tense_shift_allowed: 'test',
        dialogue_ratio: 'test',
        dialogue_style_by_character: {},
      },
      thematic_constraints: {
        must_preserve: [],
        forbidden_resolutions: [],
      },
    };
    const result = ConstitutionSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});
