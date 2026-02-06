import { describe, it, expect, beforeAll } from 'vitest';
import { loadSoulText, createSoulTextManager } from '../../src/soul/manager.js';
import type { SoulTextManagerFn } from '../../src/soul/manager.js';

describe('loadSoulText (FP)', () => {
  it('should load soul text data from directory', async () => {
    const soulText = await loadSoulText('soul');

    expect(soulText.constitution).toBeDefined();
    expect(soulText.constitution.meta.soul_id).toBe('my-lion');
    expect(soulText.worldBible).toBeDefined();
    expect(soulText.antiSoul).toBeDefined();
    expect(soulText.readerPersonas).toBeDefined();
    expect(soulText.fragments).toBeInstanceOf(Map);
    expect(soulText.promptConfig).toBeDefined();
  });

  it('should throw error for non-existent directory', async () => {
    await expect(loadSoulText('non-existent')).rejects.toThrow();
  });

  it('should load raw soultext content', async () => {
    const soulText = await loadSoulText('soul');
    expect(soulText.rawSoultext).toBeDefined();
    expect(soulText.rawSoultext).toContain('御鐘透心');
  });

  it('should load fragments for categories', async () => {
    const soulText = await loadSoulText('soul');
    const openingFragments = soulText.fragments.get('opening');
    expect(openingFragments).toBeDefined();
    expect(openingFragments!.length).toBeGreaterThan(0);
  });
});

describe('createSoulTextManager (FP)', () => {
  let mgr: SoulTextManagerFn;

  beforeAll(async () => {
    const soulText = await loadSoulText('soul');
    mgr = createSoulTextManager(soulText);
  });

  it('should return an object with all manager methods', () => {
    expect(mgr.getConstitution).toBeInstanceOf(Function);
    expect(mgr.getWorldBible).toBeInstanceOf(Function);
    expect(mgr.getAntiSoul).toBeInstanceOf(Function);
    expect(mgr.getReaderPersonas).toBeInstanceOf(Function);
    expect(mgr.getFragmentsForCategory).toBeInstanceOf(Function);
    expect(mgr.getAllFragments).toBeInstanceOf(Function);
    expect(mgr.getPromptConfig).toBeInstanceOf(Function);
    expect(mgr.getWriterPersonas).toBeInstanceOf(Function);
    expect(mgr.getCollabPersonas).toBeInstanceOf(Function);
    expect(mgr.getRawSoultext).toBeInstanceOf(Function);
    expect(mgr.getSoulText).toBeInstanceOf(Function);
    expect(mgr.buildSystemPrompt).toBeInstanceOf(Function);
  });

  it('should return constitution', () => {
    const constitution = mgr.getConstitution();
    expect(constitution).toBeDefined();
    expect(constitution.meta.soul_id).toBe('my-lion');
  });

  it('should return world bible', () => {
    const worldBible = mgr.getWorldBible();
    expect(worldBible).toBeDefined();
    expect(worldBible.characters).toHaveProperty('御鐘透心');
  });

  it('should return anti-soul', () => {
    const antiSoul = mgr.getAntiSoul();
    expect(antiSoul).toBeDefined();
    expect(antiSoul.categories).toBeDefined();
  });

  it('should return reader personas', () => {
    const personas = mgr.getReaderPersonas();
    expect(personas).toBeDefined();
    expect(personas.personas).toHaveLength(5);
  });

  it('should return fragments for category', () => {
    const fragments = mgr.getFragmentsForCategory('opening');
    expect(fragments).toBeDefined();
    expect(fragments.length).toBeGreaterThan(0);
  });

  it('should return empty array for non-existent category', () => {
    const fragments = mgr.getFragmentsForCategory('non-existent');
    expect(fragments).toEqual([]);
  });

  it('should return soul text object', () => {
    const soulText = mgr.getSoulText();
    expect(soulText.constitution).toBeDefined();
    expect(soulText.worldBible).toBeDefined();
    expect(soulText.antiSoul).toBeDefined();
    expect(soulText.readerPersonas).toBeDefined();
    expect(soulText.fragments).toBeDefined();
  });

  it('should build system prompt', () => {
    const prompt = mgr.buildSystemPrompt();
    expect(prompt).toContain('# ソウルテキスト');
    expect(prompt).toContain('御鐘透心');
    expect(prompt).toContain('×');
  });

  it('should build system prompt with category', () => {
    const prompt = mgr.buildSystemPrompt('opening');
    expect(prompt).toContain('opening');
  });

  it('should return raw soultext', () => {
    const raw = mgr.getRawSoultext();
    expect(raw).toBeDefined();
    expect(raw).toContain('御鐘透心');
  });
});
