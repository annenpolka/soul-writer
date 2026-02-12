import { describe, it, expect } from 'vitest';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { PlotSkeleton } from '../../../src/schemas/plot.js';
import {
  parsePlotSkeletonResponse,
  parseChapterConstraintsResponse,
  type BatchChapterConstraints,
} from '../../../src/agents/parsers/plotter-parser.js';

function makeSkeletonResponse(data: PlotSkeleton): StructuredResponse<PlotSkeleton> {
  return { data, reasoning: null, tokensUsed: 50 };
}

function makeConstraintsResponse(data: BatchChapterConstraints): StructuredResponse<BatchChapterConstraints> {
  return { data, reasoning: null, tokensUsed: 50 };
}

describe('parsePlotSkeletonResponse', () => {
  it('should parse a valid skeleton response', () => {
    const data: PlotSkeleton = {
      title: '螺旋の水位',
      theme: '存在と監視',
      chapters: [
        { index: 1, title: '目覚め', summary: '朝の始まり', key_events: ['起床'], target_length: 4000 },
        { index: 2, title: '教室', summary: '学校生活', key_events: ['会話'], target_length: 4000 },
      ],
    };
    const result = parsePlotSkeletonResponse(makeSkeletonResponse(data));

    expect(result.title).toBe('螺旋の水位');
    expect(result.theme).toBe('存在と監視');
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].title).toBe('目覚め');
    expect(result.chapters[1].key_events).toEqual(['会話']);
  });

  it('should parse skeleton with dramaturgy and arc_role', () => {
    const data: PlotSkeleton = {
      title: '螺旋の水位',
      theme: '存在と監視',
      chapters: [
        {
          index: 1,
          title: '目覚め',
          summary: '朝の始まり',
          key_events: ['起床'],
          target_length: 4000,
          dramaturgy: '不穏な静寂からの覚醒',
          arc_role: 'introduction',
        },
      ],
    };
    const result = parsePlotSkeletonResponse(makeSkeletonResponse(data));

    expect(result.chapters[0].dramaturgy).toBe('不穏な静寂からの覚醒');
    expect(result.chapters[0].arc_role).toBe('introduction');
  });

  it('should return data directly', () => {
    const data: PlotSkeleton = {
      title: 'テスト',
      theme: 'テーマ',
      chapters: [
        { index: 1, title: '章1', summary: '概要', key_events: ['イベント'], target_length: 4000 },
      ],
    };
    const result = parsePlotSkeletonResponse(makeSkeletonResponse(data));
    expect(result).toBe(data);
  });
});

describe('parsePlotSkeletonResponse with variation_axis', () => {
  it('should parse skeleton with variation_axis', () => {
    const data: PlotSkeleton = {
      title: '螺旋の水位',
      theme: '存在と監視',
      chapters: [
        {
          index: 1,
          title: '目覚め',
          summary: '朝の始まり',
          key_events: ['起床'],
          target_length: 4000,
          variation_axis: {
            curve_type: 'escalation',
            intensity_target: 3,
            differentiation_technique: '内省から外界接触へ',
          },
        },
      ],
    };
    const result = parsePlotSkeletonResponse(makeSkeletonResponse(data));

    expect(result.chapters[0].variation_axis).toBeDefined();
    expect(result.chapters[0].variation_axis!.curve_type).toBe('escalation');
    expect(result.chapters[0].variation_axis!.intensity_target).toBe(3);
    expect(result.chapters[0].variation_axis!.differentiation_technique).toBe('内省から外界接触へ');
  });

  it('should parse skeleton with variation_axis including internal_beats', () => {
    const data: PlotSkeleton = {
      title: 'テスト',
      theme: 'テーマ',
      chapters: [
        {
          index: 1,
          title: '章1',
          summary: '概要',
          key_events: ['イベント'],
          target_length: 4000,
          variation_axis: {
            curve_type: 'oscillation',
            intensity_target: 4,
            differentiation_technique: '揺れ動きと停滞の交互配置',
            internal_beats: ['導入の静寂', '最初の衝撃', '反動の停滞'],
          },
        },
      ],
    };
    const result = parsePlotSkeletonResponse(makeSkeletonResponse(data));

    expect(result.chapters[0].variation_axis!.internal_beats).toEqual(['導入の静寂', '最初の衝撃', '反動の停滞']);
  });

  it('should parse skeleton without variation_axis (optional)', () => {
    const data: PlotSkeleton = {
      title: 'テスト',
      theme: 'テーマ',
      chapters: [
        { index: 1, title: '章1', summary: '概要', key_events: ['イベント'], target_length: 4000 },
      ],
    };
    const result = parsePlotSkeletonResponse(makeSkeletonResponse(data));

    expect(result.chapters[0].variation_axis).toBeUndefined();
  });
});

describe('parseChapterConstraintsResponse', () => {
  it('should parse valid constraints response', () => {
    const data: BatchChapterConstraints = {
      chapters: [
        {
          index: 1,
          variation_constraints: {
            structure_type: 'single_scene',
            emotional_arc: 'ascending',
            pacing: 'slow_burn',
          },
          epistemic_constraints: [
            { perspective: '透心', constraints: ['監視を知らない'] },
          ],
        },
        {
          index: 2,
          variation_constraints: {
            structure_type: 'parallel_montage',
            emotional_arc: 'descending',
            pacing: 'rapid_cuts',
            deviation_from_previous: '前章との差分',
          },
        },
      ],
    };
    const result = parseChapterConstraintsResponse(makeConstraintsResponse(data));

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].variation_constraints?.structure_type).toBe('single_scene');
    expect(result.chapters[0].epistemic_constraints).toHaveLength(1);
    expect(result.chapters[1].variation_constraints?.deviation_from_previous).toBe('前章との差分');
  });

  it('should return data directly', () => {
    const data: BatchChapterConstraints = { chapters: [] };
    const result = parseChapterConstraintsResponse(makeConstraintsResponse(data));
    expect(result).toBe(data);
  });

  it('should parse constraints with emotional_beats and forbidden_patterns', () => {
    const data: BatchChapterConstraints = {
      chapters: [{
        index: 1,
        variation_constraints: {
          structure_type: 'single_scene',
          emotional_arc: 'ascending',
          pacing: 'slow_burn',
          emotional_beats: ['不安', '期待', '絶望'],
          forbidden_patterns: ['安易な救済', '説明的独白'],
        },
      }],
    };
    const result = parseChapterConstraintsResponse(makeConstraintsResponse(data));

    expect(result.chapters[0].variation_constraints?.emotional_beats).toEqual(['不安', '期待', '絶望']);
    expect(result.chapters[0].variation_constraints?.forbidden_patterns).toEqual(['安易な救済', '説明的独白']);
  });

  it('should handle constraints with motif_budget', () => {
    const data: BatchChapterConstraints = {
      chapters: [{
        index: 1,
        variation_constraints: {
          structure_type: 'single_scene',
          emotional_arc: 'ascending',
          pacing: 'slow_burn',
          motif_budget: [{ motif: '×マーク', max_uses: 2 }],
        },
      }],
    };
    const result = parseChapterConstraintsResponse(makeConstraintsResponse(data));

    expect(result.chapters[0].variation_constraints?.motif_budget).toHaveLength(1);
    expect(result.chapters[0].variation_constraints?.motif_budget![0].motif).toBe('×マーク');
  });
});
