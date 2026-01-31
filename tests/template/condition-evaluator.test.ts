import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../../src/template/condition-evaluator.js';
import type { Condition } from '../../src/template/types.js';

describe('evaluateCondition', () => {
  const ctx = {
    name: 'test',
    nested: { value: 'hello', empty: '', list: ['a', 'b'] },
    items: ['x', 'y'],
    nullVal: null,
  };

  describe('has', () => {
    it('returns true when path exists and is truthy', () => {
      expect(evaluateCondition({ has: 'name' }, ctx)).toBe(true);
    });

    it('returns true for nested path', () => {
      expect(evaluateCondition({ has: 'nested.value' }, ctx)).toBe(true);
    });

    it('returns false for missing path', () => {
      expect(evaluateCondition({ has: 'missing' }, ctx)).toBe(false);
    });

    it('returns false for null value', () => {
      expect(evaluateCondition({ has: 'nullVal' }, ctx)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(evaluateCondition({ has: 'nested.empty' }, ctx)).toBe(false);
    });

    it('returns false for empty array', () => {
      const c = { emptyArr: [] };
      expect(evaluateCondition({ has: 'emptyArr' }, c)).toBe(false);
    });

    it('returns true for non-empty array', () => {
      expect(evaluateCondition({ has: 'items' }, ctx)).toBe(true);
    });
  });

  describe('eq', () => {
    it('returns true when path value equals literal', () => {
      expect(evaluateCondition({ eq: ['nested.value', 'hello'] }, ctx)).toBe(true);
    });

    it('returns false when values differ', () => {
      expect(evaluateCondition({ eq: ['nested.value', 'world'] }, ctx)).toBe(false);
    });

    it('compares two paths if second resolves', () => {
      const c = { a: 'same', b: 'same' };
      expect(evaluateCondition({ eq: ['a', 'b'] }, c)).toBe(true);
    });
  });

  describe('in', () => {
    it('returns true when value is in array', () => {
      const c = { category: 'x', categories: ['x', 'y', 'z'] };
      expect(evaluateCondition({ in: ['category', 'categories'] }, c)).toBe(true);
    });

    it('returns false when value is not in array', () => {
      const c = { category: 'w', categories: ['x', 'y'] };
      expect(evaluateCondition({ in: ['category', 'categories'] }, c)).toBe(false);
    });
  });

  describe('and', () => {
    it('returns true when all conditions are true', () => {
      expect(evaluateCondition({ and: [{ has: 'name' }, { has: 'items' }] }, ctx)).toBe(true);
    });

    it('returns false when any condition is false', () => {
      expect(evaluateCondition({ and: [{ has: 'name' }, { has: 'missing' }] }, ctx)).toBe(false);
    });
  });

  describe('or', () => {
    it('returns true when any condition is true', () => {
      expect(evaluateCondition({ or: [{ has: 'missing' }, { has: 'name' }] }, ctx)).toBe(true);
    });

    it('returns false when all conditions are false', () => {
      expect(evaluateCondition({ or: [{ has: 'missing' }, { has: 'nullVal' }] }, ctx)).toBe(false);
    });
  });

  describe('not', () => {
    it('negates a true condition', () => {
      expect(evaluateCondition({ not: { has: 'name' } }, ctx)).toBe(false);
    });

    it('negates a false condition', () => {
      expect(evaluateCondition({ not: { has: 'missing' } }, ctx)).toBe(true);
    });
  });
});
