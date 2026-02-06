import { describe, it, expect } from 'vitest';
import { loadSoulText } from '../../src/soul/loader.js';

describe('loadSoulText (FP)', () => {
  it('should load soul text from a valid directory', async () => {
    const soulText = await loadSoulText('soul');

    expect(soulText.constitution).toBeDefined();
    expect(soulText.constitution.meta.soul_id).toBe('my-lion');
    expect(soulText.worldBible).toBeDefined();
    expect(soulText.worldBible.characters).toHaveProperty('御鐘透心');
    expect(soulText.antiSoul).toBeDefined();
    expect(soulText.antiSoul.categories).toBeDefined();
    expect(soulText.readerPersonas).toBeDefined();
    expect(soulText.readerPersonas.personas).toHaveLength(5);
    expect(soulText.fragments).toBeInstanceOf(Map);
    expect(soulText.promptConfig).toBeDefined();
  });

  it('should load fragments by category', async () => {
    const soulText = await loadSoulText('soul');

    const openingFragments = soulText.fragments.get('opening');
    expect(openingFragments).toBeDefined();
    expect(openingFragments!.length).toBeGreaterThan(0);
  });

  it('should return empty array for non-existent fragment category', async () => {
    const soulText = await loadSoulText('soul');

    expect(soulText.fragments.get('non-existent')).toBeUndefined();
  });

  it('should load raw soultext when present', async () => {
    const soulText = await loadSoulText('soul');

    expect(soulText.rawSoultext).toBeDefined();
    expect(soulText.rawSoultext).toContain('御鐘透心');
  });

  it('should load writer personas when present', async () => {
    const soulText = await loadSoulText('soul');

    expect(soulText.writerPersonas).toBeDefined();
    expect(Array.isArray(soulText.writerPersonas)).toBe(true);
  });

  it('should throw error for non-existent directory', async () => {
    await expect(loadSoulText('non-existent')).rejects.toThrow('Soul directory not found');
  });
});
