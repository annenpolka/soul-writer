import { describe, it, expect } from 'vitest';
import {
  GeneratedThemeSchema,
  CharacterSchema,
  type GeneratedTheme,
  type Character,
} from './generated-theme.js';

describe('CharacterSchema', () => {
  it('should validate existing character', () => {
    const character = {
      name: '御鐘透心',
      isNew: false,
    };

    const result = CharacterSchema.safeParse(character);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('御鐘透心');
      expect(result.data.isNew).toBe(false);
      expect(result.data.description).toBeUndefined();
    }
  });

  it('should validate new character with description', () => {
    const character = {
      name: '新入生A',
      isNew: true,
      description: '透心のクラスに転入してきた謎の生徒',
    };

    const result = CharacterSchema.safeParse(character);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('新入生A');
      expect(result.data.isNew).toBe(true);
      expect(result.data.description).toBe('透心のクラスに転入してきた謎の生徒');
    }
  });

  it('should reject empty name', () => {
    const result = CharacterSchema.safeParse({ name: '', isNew: false });
    expect(result.success).toBe(false);
  });

  it('should reject missing name', () => {
    const result = CharacterSchema.safeParse({ isNew: false });
    expect(result.success).toBe(false);
  });
});

describe('GeneratedThemeSchema', () => {
  it('should validate a complete theme', () => {
    const theme = {
      emotion: '孤独',
      timeline: '出会い前',
      characters: [
        { name: '御鐘透心', isNew: false },
        { name: '愛原つるぎ', isNew: false },
      ],
      premise: '透心が日常の中で感じる空虚さを描く',
      scene_types: ['教室独白', '日常観察'],
    };

    const result = GeneratedThemeSchema.safeParse(theme);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emotion).toBe('孤独');
      expect(result.data.timeline).toBe('出会い前');
      expect(result.data.characters).toHaveLength(2);
      expect(result.data.premise).toBe('透心が日常の中で感じる空虚さを描く');
      expect(result.data.scene_types).toHaveLength(2);
    }
  });

  it('should validate theme with new character', () => {
    const theme = {
      emotion: '渇望',
      timeline: '出会い後',
      characters: [
        { name: '御鐘透心', isNew: false },
        { name: '新キャラ', isNew: true, description: 'テスト用の新キャラクター' },
      ],
      premise: 'テスト前提',
      scene_types: ['MRフロアセッション'],
    };

    const result = GeneratedThemeSchema.safeParse(theme);

    expect(result.success).toBe(true);
    if (result.success) {
      const newChar = result.data.characters.find((c) => c.isNew);
      expect(newChar).toBeDefined();
      expect(newChar?.description).toBe('テスト用の新キャラクター');
    }
  });

  it('should reject empty emotion', () => {
    const theme = {
      emotion: '',
      timeline: '出会い前',
      characters: [{ name: '透心', isNew: false }],
      premise: 'テスト',
      scene_types: ['教室独白'],
    };

    const result = GeneratedThemeSchema.safeParse(theme);
    expect(result.success).toBe(false);
  });

  it('should reject empty characters array', () => {
    const theme = {
      emotion: '孤独',
      timeline: '出会い前',
      characters: [],
      premise: 'テスト',
      scene_types: ['教室独白'],
    };

    const result = GeneratedThemeSchema.safeParse(theme);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const incomplete = {
      emotion: '孤独',
      // missing timeline, characters, premise
    };

    const result = GeneratedThemeSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});
