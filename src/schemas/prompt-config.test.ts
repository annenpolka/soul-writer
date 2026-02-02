import { describe, it, expect } from 'vitest';
import {
  ToneAxesSchema,
  TONE_AXIS_KEYS,
  PromptConfigSchema,
} from './prompt-config.js';

describe('ToneAxesSchema', () => {
  it('should accept a full 5-axis object', () => {
    const input = {
      emotional_distance: ['directive1'],
      structural_constraint: ['directive2'],
      aesthetic_direction: ['directive3'],
      tempo_rhythm: ['directive4'],
      perspective_operation: ['directive5'],
    };
    const result = ToneAxesSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept partial axes (each axis is optional)', () => {
    const input = { aesthetic_direction: ['only this axis'] };
    const result = ToneAxesSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aesthetic_direction).toEqual(['only this axis']);
      expect(result.data.emotional_distance).toBeUndefined();
    }
  });

  it('should accept empty object', () => {
    const result = ToneAxesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject non-string arrays', () => {
    const input = { emotional_distance: [123] };
    const result = ToneAxesSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('TONE_AXIS_KEYS', () => {
  it('should contain exactly 5 axis keys', () => {
    expect(TONE_AXIS_KEYS).toHaveLength(5);
  });

  it('should contain the expected axis keys', () => {
    expect(TONE_AXIS_KEYS).toContain('emotional_distance');
    expect(TONE_AXIS_KEYS).toContain('structural_constraint');
    expect(TONE_AXIS_KEYS).toContain('aesthetic_direction');
    expect(TONE_AXIS_KEYS).toContain('tempo_rhythm');
    expect(TONE_AXIS_KEYS).toContain('perspective_operation');
  });
});

describe('PromptConfigSchema with tone_axes', () => {
  it('should accept tone_axes field', () => {
    const input = {
      defaults: { protagonist_short: '透心', pronoun: 'わたし' },
      tone_axes: {
        aesthetic_direction: ['custom directive'],
      },
    };
    const result = PromptConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tone_axes?.aesthetic_direction).toEqual(['custom directive']);
    }
  });

  it('should accept both tone_directives and tone_axes simultaneously', () => {
    const input = {
      defaults: { protagonist_short: '透心', pronoun: 'わたし' },
      tone_directives: ['old format directive'],
      tone_axes: {
        emotional_distance: ['new format directive'],
      },
    };
    const result = PromptConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tone_directives).toEqual(['old format directive']);
      expect(result.data.tone_axes?.emotional_distance).toEqual(['new format directive']);
    }
  });
});
