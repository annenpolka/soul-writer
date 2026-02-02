import { describe, it, expect } from 'vitest';
import {
  TONE_AXES,
  TONE_DIRECTIVES,
  pickToneAxes,
} from './diversity-catalog.js';
import { TONE_AXIS_KEYS } from '../schemas/prompt-config.js';

describe('TONE_AXES', () => {
  it('should have exactly 5 axis keys', () => {
    const keys = Object.keys(TONE_AXES);
    expect(keys).toHaveLength(5);
  });

  it('should have all expected axis keys', () => {
    for (const key of TONE_AXIS_KEYS) {
      expect(TONE_AXES).toHaveProperty(key);
    }
  });

  it('should have 5-7 directives per axis', () => {
    for (const key of TONE_AXIS_KEYS) {
      const directives = TONE_AXES[key];
      expect(directives.length).toBeGreaterThanOrEqual(5);
      expect(directives.length).toBeLessThanOrEqual(7);
    }
  });

  it('should contain reclassified old directives in aesthetic_direction', () => {
    // Old directives #1, #2, #3 → aesthetic_direction
    expect(TONE_AXES.aesthetic_direction).toContainEqual(
      expect.stringContaining('予想外で挑発的')
    );
    expect(TONE_AXES.aesthetic_direction).toContainEqual(
      expect.stringContaining('些細な瞬間')
    );
    expect(TONE_AXES.aesthetic_direction).toContainEqual(
      expect.stringContaining('小さな亀裂')
    );
  });

  it('should contain reclassified old directive in tempo_rhythm', () => {
    // Old directive #4 → tempo_rhythm
    expect(TONE_AXES.tempo_rhythm).toContainEqual(
      expect.stringContaining('五感を通じた')
    );
  });
});

describe('pickToneAxes', () => {
  it('should return all 5 tone keys', () => {
    const result = pickToneAxes();
    expect(result).toHaveProperty('tone_emotional');
    expect(result).toHaveProperty('tone_structure');
    expect(result).toHaveProperty('tone_aesthetic');
    expect(result).toHaveProperty('tone_tempo');
    expect(result).toHaveProperty('tone_perspective');
  });

  it('should return values from the corresponding axis arrays', () => {
    // Run multiple times to check values come from correct axes
    for (let i = 0; i < 20; i++) {
      const result = pickToneAxes();
      expect(TONE_AXES.emotional_distance).toContain(result.tone_emotional);
      expect(TONE_AXES.structural_constraint).toContain(result.tone_structure);
      expect(TONE_AXES.aesthetic_direction).toContain(result.tone_aesthetic);
      expect(TONE_AXES.tempo_rhythm).toContain(result.tone_tempo);
      expect(TONE_AXES.perspective_operation).toContain(result.tone_perspective);
    }
  });

  it('should apply partial overrides (only specified axes)', () => {
    const overrides = {
      aesthetic_direction: ['カスタム美学のみ'],
    };
    for (let i = 0; i < 10; i++) {
      const result = pickToneAxes(overrides);
      expect(result.tone_aesthetic).toBe('カスタム美学のみ');
      // Other axes should still use defaults
      expect(TONE_AXES.emotional_distance).toContain(result.tone_emotional);
    }
  });

  it('should apply full overrides', () => {
    const overrides = {
      emotional_distance: ['custom1'],
      structural_constraint: ['custom2'],
      aesthetic_direction: ['custom3'],
      tempo_rhythm: ['custom4'],
      perspective_operation: ['custom5'],
    };
    const result = pickToneAxes(overrides);
    expect(result.tone_emotional).toBe('custom1');
    expect(result.tone_structure).toBe('custom2');
    expect(result.tone_aesthetic).toBe('custom3');
    expect(result.tone_tempo).toBe('custom4');
    expect(result.tone_perspective).toBe('custom5');
  });
});

describe('TONE_DIRECTIVES (backward compat)', () => {
  it('should still be exported as an array', () => {
    expect(Array.isArray(TONE_DIRECTIVES)).toBe(true);
    expect(TONE_DIRECTIVES.length).toBeGreaterThan(0);
  });
});
