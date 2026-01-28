import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { FragmentCollectionSchema } from '../../src/schemas/fragments.js';

describe('FragmentCollectionSchema', () => {
  const fragmentFiles = readdirSync('soul/fragments').filter((f) =>
    f.endsWith('.json')
  );

  it.each(fragmentFiles)('should validate %s', (filename) => {
    const json = JSON.parse(
      readFileSync(`soul/fragments/${filename}`, 'utf-8')
    );
    const result = FragmentCollectionSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBeDefined();
      expect(result.data.fragments).toBeDefined();
      expect(Array.isArray(result.data.fragments)).toBe(true);
    }
  });

  it('should have valid fragment structure in opening.json', () => {
    const json = JSON.parse(readFileSync('soul/fragments/opening.json', 'utf-8'));
    const result = FragmentCollectionSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('opening');
      expect(result.data.fragments.length).toBeGreaterThan(0);

      const firstFragment = result.data.fragments[0];
      expect(firstFragment.id).toBeDefined();
      expect(firstFragment.text).toBeDefined();
      expect(firstFragment.tags).toBeDefined();
    }
  });

  it('should reject fragment collection without category', () => {
    const invalid = { fragments: [] };
    const result = FragmentCollectionSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});
