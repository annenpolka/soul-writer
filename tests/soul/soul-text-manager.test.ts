import { describe, it, expect, beforeAll } from 'vitest';
import { SoulTextManager } from '../../src/soul/manager.js';

describe('SoulTextManager', () => {
  let manager: SoulTextManager;

  beforeAll(async () => {
    manager = await SoulTextManager.load('soul');
  });

  describe('load', () => {
    it('should load soul text from directory', async () => {
      expect(manager).toBeInstanceOf(SoulTextManager);
    });

    it('should throw error for non-existent directory', async () => {
      await expect(SoulTextManager.load('non-existent')).rejects.toThrow();
    });
  });

  describe('getConstitution', () => {
    it('should return constitution', () => {
      const constitution = manager.getConstitution();
      expect(constitution).toBeDefined();
      expect(constitution.meta.soul_id).toBe('my-lion');
    });
  });

  describe('getWorldBible', () => {
    it('should return world bible', () => {
      const worldBible = manager.getWorldBible();
      expect(worldBible).toBeDefined();
      expect(worldBible.characters).toHaveProperty('御鐘透心');
    });
  });

  describe('getAntiSoul', () => {
    it('should return anti-soul', () => {
      const antiSoul = manager.getAntiSoul();
      expect(antiSoul).toBeDefined();
      expect(antiSoul.categories).toBeDefined();
    });
  });

  describe('getReaderPersonas', () => {
    it('should return reader personas', () => {
      const personas = manager.getReaderPersonas();
      expect(personas).toBeDefined();
      expect(personas.personas).toHaveLength(4);
    });
  });

  describe('getFragmentsForCategory', () => {
    it('should return fragments for opening category', () => {
      const fragments = manager.getFragmentsForCategory('opening');
      expect(fragments).toBeDefined();
      expect(fragments.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent category', () => {
      const fragments = manager.getFragmentsForCategory('non-existent');
      expect(fragments).toEqual([]);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt with all soul text components', () => {
      const prompt = manager.buildSystemPrompt();

      expect(prompt).toContain('# ソウルテキスト');
      expect(prompt).toContain('御鐘透心');
      expect(prompt).toContain('×');
    });

    it('should include fragments for specific category', () => {
      const prompt = manager.buildSystemPrompt('opening');

      expect(prompt).toContain('opening');
    });
  });

  describe('getSoulText', () => {
    it('should return complete soul text object', () => {
      const soulText = manager.getSoulText();

      expect(soulText.constitution).toBeDefined();
      expect(soulText.worldBible).toBeDefined();
      expect(soulText.antiSoul).toBeDefined();
      expect(soulText.readerPersonas).toBeDefined();
      expect(soulText.fragments).toBeDefined();
    });

    it('should include rawSoultext in soul text object', () => {
      const soulText = manager.getSoulText();
      expect(soulText.rawSoultext).toBeDefined();
      expect(soulText.rawSoultext).toContain('御鐘透心');
    });
  });

  describe('getRawSoultext', () => {
    it('should return raw soultext content', () => {
      const rawSoultext = manager.getRawSoultext();
      expect(rawSoultext).toBeDefined();
      expect(typeof rawSoultext).toBe('string');
      expect(rawSoultext).toContain('御鐘透心');
      expect(rawSoultext).toContain('愛原つるぎ');
    });

    it('should not contain the instruction header', () => {
      const rawSoultext = manager.getRawSoultext();
      expect(rawSoultext).not.toContain('以下は執筆中の小説のメモ');
    });
  });
});
