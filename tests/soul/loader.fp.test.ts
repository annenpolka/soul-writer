import { describe, it, expect, afterEach } from 'vitest';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
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

describe('loadSoulText learned fragments', () => {
  const learnedDir = 'soul/fragments/learned';

  afterEach(() => {
    if (existsSync(learnedDir)) {
      rmSync(learnedDir, { recursive: true, force: true });
    }
  });

  it('should merge learned fragments when learned/ directory exists', async () => {
    mkdirSync(learnedDir, { recursive: true });
    writeFileSync(
      `${learnedDir}/opening.json`,
      JSON.stringify({
        category: 'opening',
        fragments: [
          {
            id: 'learned-opening-001',
            text: '学習された開幕テキスト',
            origin: 'learned',
            source: 'work:test-work',
            tags: [],
            added_at: '2026-02-17T00:00:00Z',
          },
        ],
      })
    );

    const soulText = await loadSoulText('soul');
    const openings = soulText.fragments.get('opening')!;
    const learnedFragments = openings.filter((f) => f.origin === 'learned');

    expect(learnedFragments).toHaveLength(1);
    expect(learnedFragments[0].text).toBe('学習された開幕テキスト');
  });

  it('should place original fragments before learned ones', async () => {
    mkdirSync(learnedDir, { recursive: true });
    writeFileSync(
      `${learnedDir}/opening.json`,
      JSON.stringify({
        category: 'opening',
        fragments: [
          {
            id: 'learned-opening-001',
            text: '学習フラグメント',
            origin: 'learned',
            tags: [],
            added_at: '2026-02-17T00:00:00Z',
          },
        ],
      })
    );

    const soulText = await loadSoulText('soul');
    const openings = soulText.fragments.get('opening')!;
    const originals = openings.filter((f) => f.origin === 'original');
    const learned = openings.filter((f) => f.origin === 'learned');

    // Originals should come first
    const firstLearnedIdx = openings.findIndex((f) => f.origin === 'learned');
    const lastOriginalIdx =
      openings.length -
      1 -
      [...openings].reverse().findIndex((f) => f.origin === 'original');
    expect(lastOriginalIdx).toBeLessThan(firstLearnedIdx);
    expect(originals.length).toBeGreaterThan(0);
    expect(learned.length).toBeGreaterThan(0);
  });

  it('should exclude learned fragments when includeLearned is false', async () => {
    mkdirSync(learnedDir, { recursive: true });
    writeFileSync(
      `${learnedDir}/opening.json`,
      JSON.stringify({
        category: 'opening',
        fragments: [
          {
            id: 'learned-opening-001',
            text: '除外されるべきフラグメント',
            origin: 'learned',
            tags: [],
            added_at: '2026-02-17T00:00:00Z',
          },
        ],
      })
    );

    const soulText = await loadSoulText('soul', { includeLearned: false });
    const openings = soulText.fragments.get('opening')!;
    const learned = openings.filter((f) => f.origin === 'learned');

    expect(learned).toHaveLength(0);
  });

  it('should handle missing learned/ directory gracefully', async () => {
    const soulText = await loadSoulText('soul');

    expect(soulText.fragments).toBeInstanceOf(Map);
    expect(soulText.fragments.get('opening')).toBeDefined();
  });

  it('should create new category entries for learned-only categories', async () => {
    mkdirSync(learnedDir, { recursive: true });
    writeFileSync(
      `${learnedDir}/generated_dialogue.json`,
      JSON.stringify({
        category: 'generated_dialogue',
        fragments: [
          {
            id: 'learned-generated_dialogue-001',
            text: '生成された台詞',
            origin: 'learned',
            tags: [],
            added_at: '2026-02-17T00:00:00Z',
          },
        ],
      })
    );

    const soulText = await loadSoulText('soul');
    const genDialogue = soulText.fragments.get('generated_dialogue');

    expect(genDialogue).toBeDefined();
    expect(genDialogue).toHaveLength(1);
  });
});
