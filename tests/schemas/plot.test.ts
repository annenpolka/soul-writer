import { describe, it, expect } from 'vitest';
import { ChapterSchema, PlotSchema } from '../../src/schemas/plot.js';

describe('ChapterSchema', () => {
  describe('valid data', () => {
    it('should accept valid chapter with all fields', () => {
      const chapter = {
        index: 1,
        title: '第一章',
        summary: '物語の始まり',
        key_events: ['イベント1', 'イベント2'],
        target_length: 4000,
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(chapter);
      }
    });

    it('should use default target_length when not provided', () => {
      const chapter = {
        index: 1,
        title: '第一章',
        summary: '物語の始まり',
        key_events: ['イベント1'],
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.target_length).toBe(4000);
      }
    });
  });

  describe('invalid data', () => {
    it('should reject non-positive index', () => {
      const chapter = {
        index: 0,
        title: '第一章',
        summary: '物語の始まり',
        key_events: ['イベント1'],
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });

    it('should reject negative index', () => {
      const chapter = {
        index: -1,
        title: '第一章',
        summary: '物語の始まり',
        key_events: ['イベント1'],
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const chapter = {
        index: 1,
        title: '',
        summary: '物語の始まり',
        key_events: ['イベント1'],
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });

    it('should reject empty summary', () => {
      const chapter = {
        index: 1,
        title: '第一章',
        summary: '',
        key_events: ['イベント1'],
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });

    it('should reject empty key_events array', () => {
      const chapter = {
        index: 1,
        title: '第一章',
        summary: '物語の始まり',
        key_events: [],
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });

    it('should reject non-positive target_length', () => {
      const chapter = {
        index: 1,
        title: '第一章',
        summary: '物語の始まり',
        key_events: ['イベント1'],
        target_length: 0,
      };

      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });
  });
});

describe('PlotSchema', () => {
  describe('valid data', () => {
    it('should accept minimal valid plot', () => {
      const plot = {
        title: '物語のタイトル',
        theme: '中心テーマの説明',
        chapters: [
          {
            index: 1,
            title: '第一章',
            summary: '物語の始まり',
            key_events: ['イベント1'],
          },
        ],
      };

      const result = PlotSchema.safeParse(plot);
      expect(result.success).toBe(true);
    });

    it('should accept plot with multiple chapters', () => {
      const plot = {
        title: '物語のタイトル',
        theme: '中心テーマの説明',
        chapters: [
          {
            index: 1,
            title: '第一章',
            summary: '物語の始まり',
            key_events: ['イベント1'],
            target_length: 3000,
          },
          {
            index: 2,
            title: '第二章',
            summary: '展開',
            key_events: ['イベント2', 'イベント3'],
            target_length: 5000,
          },
          {
            index: 3,
            title: '第三章',
            summary: '結末',
            key_events: ['イベント4'],
            target_length: 4000,
          },
        ],
      };

      const result = PlotSchema.safeParse(plot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chapters).toHaveLength(3);
      }
    });
  });

  describe('invalid data', () => {
    it('should reject empty title', () => {
      const plot = {
        title: '',
        theme: '中心テーマの説明',
        chapters: [
          {
            index: 1,
            title: '第一章',
            summary: '物語の始まり',
            key_events: ['イベント1'],
          },
        ],
      };

      const result = PlotSchema.safeParse(plot);
      expect(result.success).toBe(false);
    });

    it('should reject empty theme', () => {
      const plot = {
        title: '物語のタイトル',
        theme: '',
        chapters: [
          {
            index: 1,
            title: '第一章',
            summary: '物語の始まり',
            key_events: ['イベント1'],
          },
        ],
      };

      const result = PlotSchema.safeParse(plot);
      expect(result.success).toBe(false);
    });

    it('should reject empty chapters array', () => {
      const plot = {
        title: '物語のタイトル',
        theme: '中心テーマの説明',
        chapters: [],
      };

      const result = PlotSchema.safeParse(plot);
      expect(result.success).toBe(false);
    });

    it('should reject plot with invalid chapter', () => {
      const plot = {
        title: '物語のタイトル',
        theme: '中心テーマの説明',
        chapters: [
          {
            index: 0, // invalid
            title: '第一章',
            summary: '物語の始まり',
            key_events: ['イベント1'],
          },
        ],
      };

      const result = PlotSchema.safeParse(plot);
      expect(result.success).toBe(false);
    });
  });
});
