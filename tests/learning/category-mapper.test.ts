import { describe, it, expect } from 'vitest';
import { mapExtractorCategory } from '../../src/learning/category-mapper.js';

describe('mapExtractorCategory', () => {
  it('should map identical category names', () => {
    expect(mapExtractorCategory('opening')).toBe('opening');
    expect(mapExtractorCategory('introspection')).toBe('introspection');
    expect(mapExtractorCategory('dialogue')).toBe('dialogue');
    expect(mapExtractorCategory('action')).toBe('action');
    expect(mapExtractorCategory('symbolism')).toBe('symbolism');
    expect(mapExtractorCategory('killing')).toBe('killing');
    expect(mapExtractorCategory('generated_dialogue')).toBe('generated_dialogue');
  });

  it('should map extractor-specific category names to FragmentCategory', () => {
    expect(mapExtractorCategory('character')).toBe('character_voice');
    expect(mapExtractorCategory('worldbuilding')).toBe('world_building');
    expect(mapExtractorCategory('closing')).toBe('opening');
  });

  it('should handle already-correct enum values', () => {
    expect(mapExtractorCategory('character_voice')).toBe('character_voice');
    expect(mapExtractorCategory('world_building')).toBe('world_building');
  });

  it('should return null for unknown categories', () => {
    expect(mapExtractorCategory('unknown')).toBeNull();
    expect(mapExtractorCategory('')).toBeNull();
    expect(mapExtractorCategory('foobar')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(mapExtractorCategory('Opening')).toBe('opening');
    expect(mapExtractorCategory('DIALOGUE')).toBe('dialogue');
    expect(mapExtractorCategory('WorldBuilding')).toBe('world_building');
  });
});
