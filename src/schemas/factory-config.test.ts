import { describe, it, expect } from 'vitest';
import { FactoryConfigSchema, DEFAULT_FACTORY_CONFIG, type FactoryConfig } from './factory-config.js';

describe('FactoryConfigSchema', () => {
  describe('validation', () => {
    it('should validate a complete config object', () => {
      const config = {
        count: 100,
        parallel: 4,
        chaptersPerStory: 5,
        soulPath: 'soul',
        outputDir: 'output',
        dbPath: 'factory.db',
        taskDelayMs: 1000,
      };

      const result = FactoryConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('should provide default values for empty object', () => {
      const result = FactoryConfigSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(10);
        expect(result.data.parallel).toBe(4);
        expect(result.data.chaptersPerStory).toBe(5);
        expect(result.data.soulPath).toBe('soul');
        expect(result.data.outputDir).toBe('output');
        expect(result.data.dbPath).toBe('factory.db');
      }
    });

    it('should fill missing fields with defaults', () => {
      const partial = { count: 50 };

      const result = FactoryConfigSchema.safeParse(partial);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(50);
        expect(result.data.parallel).toBe(4); // default
      }
    });
  });

  describe('validation errors', () => {
    it('should reject negative count', () => {
      const result = FactoryConfigSchema.safeParse({ count: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject zero count', () => {
      const result = FactoryConfigSchema.safeParse({ count: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject parallel greater than 8', () => {
      const result = FactoryConfigSchema.safeParse({ parallel: 9 });
      expect(result.success).toBe(false);
    });

    it('should reject parallel less than 1', () => {
      const result = FactoryConfigSchema.safeParse({ parallel: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer count', () => {
      const result = FactoryConfigSchema.safeParse({ count: 10.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('DEFAULT_FACTORY_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_FACTORY_CONFIG.count).toBe(10);
      expect(DEFAULT_FACTORY_CONFIG.parallel).toBe(4);
      expect(DEFAULT_FACTORY_CONFIG.chaptersPerStory).toBe(5);
      expect(DEFAULT_FACTORY_CONFIG.soulPath).toBe('soul');
      expect(DEFAULT_FACTORY_CONFIG.outputDir).toBe('output');
      expect(DEFAULT_FACTORY_CONFIG.dbPath).toBe('factory.db');
    });
  });
});
