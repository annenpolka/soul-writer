import { describe, it, expect } from 'vitest';
import { ChapterSchema, PlotSchema, VariationConstraintsSchema, EpistemicConstraintSchema } from '../../src/schemas/plot.js';

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

describe('VariationConstraintsSchema', () => {
  it('should accept valid full constraints', () => {
    const constraints = {
      structure_type: 'parallel_montage',
      emotional_arc: 'ascending',
      pacing: 'slow_burn',
      deviation_from_previous: '前章の単一シーンから並列モンタージュへ転換',
      motif_budget: [
        { motif: '×マーク', max_uses: 2 },
        { motif: 'ARタグ', max_uses: 3 },
      ],
    };

    const result = VariationConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(true);
  });

  it('should accept minimal constraints (required fields only)', () => {
    const constraints = {
      structure_type: 'single_scene',
      emotional_arc: 'descending',
      pacing: 'rapid_cuts',
    };

    const result = VariationConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(true);
  });

  it('should reject empty structure_type', () => {
    const constraints = {
      structure_type: '',
      emotional_arc: 'ascending',
      pacing: 'slow_burn',
    };

    const result = VariationConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(false);
  });

  it('should reject non-positive max_uses in motif_budget', () => {
    const constraints = {
      structure_type: 'single_scene',
      emotional_arc: 'ascending',
      pacing: 'slow_burn',
      motif_budget: [{ motif: '×マーク', max_uses: 0 }],
    };

    const result = VariationConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(false);
  });
});

describe('EpistemicConstraintSchema', () => {
  it('should accept valid constraint with perspective and constraints', () => {
    const constraint = {
      perspective: '透心',
      constraints: ['オペレーターが監視していることを知らない', 'ARの裏側の構造を直接見ない'],
    };

    const result = EpistemicConstraintSchema.safeParse(constraint);
    expect(result.success).toBe(true);
  });

  it('should accept single constraint', () => {
    const constraint = {
      perspective: 'オペレーター',
      constraints: ['透心の内面を直接知覚しない'],
    };

    const result = EpistemicConstraintSchema.safeParse(constraint);
    expect(result.success).toBe(true);
  });

  it('should reject empty perspective', () => {
    const constraint = {
      perspective: '',
      constraints: ['何かを知らない'],
    };

    const result = EpistemicConstraintSchema.safeParse(constraint);
    expect(result.success).toBe(false);
  });

  it('should reject empty constraints array', () => {
    const constraint = {
      perspective: '透心',
      constraints: [],
    };

    const result = EpistemicConstraintSchema.safeParse(constraint);
    expect(result.success).toBe(false);
  });
});

describe('ChapterSchema with epistemic_constraints', () => {
  it('should accept chapter with epistemic_constraints', () => {
    const chapter = {
      index: 1,
      title: '第一章',
      summary: '物語の始まり',
      key_events: ['イベント1'],
      epistemic_constraints: [
        { perspective: '透心', constraints: ['オペレーターの存在を知らない'] },
        { perspective: 'オペレーター', constraints: ['透心の内面を直接知覚しない'] },
      ],
    };

    const result = ChapterSchema.safeParse(chapter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.epistemic_constraints).toHaveLength(2);
      expect(result.data.epistemic_constraints![0].perspective).toBe('透心');
    }
  });

  it('should accept chapter without epistemic_constraints', () => {
    const chapter = {
      index: 1,
      title: '第一章',
      summary: '物語の始まり',
      key_events: ['イベント1'],
    };

    const result = ChapterSchema.safeParse(chapter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.epistemic_constraints).toBeUndefined();
    }
  });
});

describe('ChapterSchema with variation_constraints', () => {
  it('should accept chapter with variation_constraints', () => {
    const chapter = {
      index: 1,
      title: '第一章',
      summary: '物語の始まり',
      key_events: ['イベント1'],
      variation_constraints: {
        structure_type: 'single_scene',
        emotional_arc: 'ascending',
        pacing: 'slow_burn',
      },
    };

    const result = ChapterSchema.safeParse(chapter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variation_constraints).toBeDefined();
      expect(result.data.variation_constraints?.structure_type).toBe('single_scene');
    }
  });

  it('should accept chapter without variation_constraints', () => {
    const chapter = {
      index: 1,
      title: '第一章',
      summary: '物語の始まり',
      key_events: ['イベント1'],
    };

    const result = ChapterSchema.safeParse(chapter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variation_constraints).toBeUndefined();
    }
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
