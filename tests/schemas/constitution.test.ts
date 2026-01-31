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
    const invalid = { universal: {}, protagonist_specific: {} };
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
      universal: {
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
        thematic_constraints: {
          must_preserve: [],
          forbidden_resolutions: [],
        },
        new_character_guide: {
          description: 'test',
          rules: [],
        },
      },
      protagonist_specific: {
        sentence_structure: {
          rhythm_pattern: 'test',
          taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
          typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
        },
        narrative: {
          default_pov: 'test',
          pov_by_character: {},
          default_tense: 'test',
          tense_shift_allowed: 'test',
          dialogue_ratio: 'test',
          dialogue_style_by_character: {},
        },
        scene_modes: {
          mundane: { description: 'test', style: 'test' },
          tension: { description: 'test', style: 'test' },
        },
        dry_humor: {
          description: 'test',
          techniques: [],
          frequency: 'test',
        },
      },
    };
    const result = ConstitutionSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});
