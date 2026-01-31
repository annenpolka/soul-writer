import { describe, it, expect } from 'vitest';
import { applyFilter } from '../../src/template/filters.js';

describe('applyFilter', () => {
  describe('join', () => {
    it('joins array with separator', () => {
      expect(applyFilter(['a', 'b', 'c'], 'join: ", "')).toBe('a, b, c');
    });

    it('joins with custom separator', () => {
      expect(applyFilter(['x', 'y'], 'join: "・"')).toBe('x・y');
    });

    it('returns string as-is for non-array', () => {
      expect(applyFilter('hello', 'join: ", "')).toBe('hello');
    });
  });

  describe('prefix', () => {
    it('adds prefix to string', () => {
      expect(applyFilter('world', 'prefix: "hello "')).toBe('hello world');
    });

    it('adds prefix to each array element', () => {
      expect(applyFilter(['a', 'b'], 'prefix: "- "')).toEqual(['- a', '- b']);
    });
  });

  describe('tag', () => {
    it('wraps string in tag', () => {
      expect(applyFilter('content', 'tag: "##"')).toBe('## content');
    });
  });

  describe('chaining', () => {
    it('applies multiple filters in sequence', () => {
      expect(applyFilter(['a', 'b'], 'prefix: "- " | join: "\\n"')).toBe('- a\n- b');
    });
  });

  describe('unknown filter', () => {
    it('returns value unchanged for unknown filter', () => {
      expect(applyFilter('hello', 'unknown: "x"')).toBe('hello');
    });
  });
});
