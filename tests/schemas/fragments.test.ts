import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  FragmentCollectionSchema,
  FragmentSchema,
  FragmentOrigin,
} from '../../src/schemas/fragments.js';

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

describe('FragmentSchema origin field', () => {
  it('should default origin to "original" when not specified', () => {
    const fragment = {
      id: 'test-001',
      text: 'テストテキスト',
      tags: ['test'],
      added_at: '2024-01-01T00:00:00Z',
    };
    const result = FragmentSchema.parse(fragment);
    expect(result.origin).toBe('original');
  });

  it('should accept origin: "learned"', () => {
    const fragment = {
      id: 'learned-opening-001',
      text: '学習フラグメント',
      source: 'work:abc123',
      origin: 'learned',
      tags: ['learned'],
      added_at: '2026-02-17T00:00:00Z',
    };
    const result = FragmentSchema.parse(fragment);
    expect(result.origin).toBe('learned');
  });

  it('should accept origin: "original"', () => {
    const fragment = {
      id: 'opening-001',
      text: 'オリジナルフラグメント',
      origin: 'original',
      tags: ['opening'],
      added_at: '2024-01-01T00:00:00Z',
    };
    const result = FragmentSchema.parse(fragment);
    expect(result.origin).toBe('original');
  });

  it('should reject invalid origin value', () => {
    const fragment = {
      id: 'test-001',
      text: 'テスト',
      origin: 'unknown',
      tags: [],
      added_at: '2024-01-01T00:00:00Z',
    };
    const result = FragmentSchema.safeParse(fragment);
    expect(result.success).toBe(false);
  });

  it('should export FragmentOrigin enum', () => {
    expect(FragmentOrigin).toBeDefined();
    expect(FragmentOrigin.options).toContain('original');
    expect(FragmentOrigin.options).toContain('learned');
  });

  it('should maintain backward compatibility with existing fragment files', () => {
    const fragmentFiles = readdirSync('soul/fragments').filter((f) =>
      f.endsWith('.json')
    );
    for (const filename of fragmentFiles) {
      const json = JSON.parse(
        readFileSync(`soul/fragments/${filename}`, 'utf-8')
      );
      const result = FragmentCollectionSchema.safeParse(json);
      expect(result.success).toBe(true);
      if (result.success) {
        for (const fragment of result.data.fragments) {
          expect(fragment.origin).toBe('original');
        }
      }
    }
  });
});
