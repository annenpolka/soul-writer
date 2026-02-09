import { describe, it, expect } from 'vitest';
import { ChapterSchema, PlotSchema, ChapterSkeletonSchema } from '../src/schemas/plot.js';
import type { ImprovementAction } from '../src/agents/types.js';

describe('Phase 1: Agency type definitions', () => {
  describe('WS6a: ChapterSchema decision_point', () => {
    it('should accept a chapter with decision_point', () => {
      const chapter = {
        index: 1,
        title: 'テスト章',
        summary: 'テストの要約',
        key_events: ['イベント1'],
        target_length: 4000,
        decision_point: {
          action: '名前を呼ぶ',
          stakes: '正体が露見するリスク',
          irreversibility: 'クラスメイトが透心を「名前を知る者」として認識する',
        },
      };
      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.decision_point).toEqual(chapter.decision_point);
      }
    });

    it('should accept a chapter without decision_point (optional)', () => {
      const chapter = {
        index: 1,
        title: 'テスト章',
        summary: 'テストの要約',
        key_events: ['イベント1'],
        target_length: 4000,
      };
      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(true);
    });

    it('should reject decision_point with missing required fields', () => {
      const chapter = {
        index: 1,
        title: 'テスト章',
        summary: 'テストの要約',
        key_events: ['イベント1'],
        decision_point: {
          action: '名前を呼ぶ',
          // missing stakes and irreversibility
        },
      };
      const result = ChapterSchema.safeParse(chapter);
      expect(result.success).toBe(false);
    });
  });

  describe('WS7a: ImprovementAction agency_boost type', () => {
    it('should allow agency_boost as a valid action type', () => {
      const action: ImprovementAction = {
        section: '冒頭',
        type: 'agency_boost',
        description: '受動的観察ループを能動的行動に変換',
        source: 'judge_weakness',
        priority: 'high',
      };
      expect(action.type).toBe('agency_boost');
    });

    it('should still allow existing action types', () => {
      const existingTypes: ImprovementAction['type'][] = [
        'expression_upgrade',
        'pacing_adjustment',
        'scene_reorder',
        'motif_fix',
        'voice_refinement',
        'imagery_injection',
        'tension_enhancement',
        'agency_boost',
      ];
      expect(existingTypes).toHaveLength(8);
    });
  });

  describe('WS1: Constitution constraint removal validation', () => {
    it('should load constitution without rhythm_pattern', async () => {
      const { readFileSync } = await import('fs');
      const constitution = JSON.parse(
        readFileSync('soul/constitution.json', 'utf-8')
      );
      // rhythm_pattern should be removed
      expect(constitution.protagonist_specific.sentence_structure.rhythm_pattern).toBeUndefined();
    });

    it('should load constitution without dialogue_ratio', async () => {
      const { readFileSync } = await import('fs');
      const constitution = JSON.parse(
        readFileSync('soul/constitution.json', 'utf-8')
      );
      // dialogue_ratio should be removed
      expect(constitution.protagonist_specific.narrative.dialogue_ratio).toBeUndefined();
    });

    it('should preserve essential constitution fields', async () => {
      const { readFileSync } = await import('fs');
      const constitution = JSON.parse(
        readFileSync('soul/constitution.json', 'utf-8')
      );
      // These MUST remain
      expect(constitution.universal.vocabulary.forbidden_words).toBeDefined();
      expect(constitution.universal.vocabulary.special_marks).toBeDefined();
      expect(constitution.universal.rhetoric).toBeDefined();
      expect(constitution.universal.thematic_constraints).toBeDefined();
      expect(constitution.protagonist_specific.narrative.default_pov).toBeDefined();
      expect(constitution.protagonist_specific.scene_modes).toBeDefined();
    });
  });
});
