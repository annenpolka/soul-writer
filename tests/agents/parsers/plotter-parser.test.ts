import { describe, it, expect } from 'vitest';
import type { ToolCallResponse } from '../../../src/llm/types.js';
import {
  parsePlotResponse,
  parsePlotSkeletonResponse,
  parseChapterConstraintsResponse,
  coerceStringifiedArrays,
} from '../../../src/agents/parsers/plotter-parser.js';

function makeToolResponse(args: string, toolName = 'submit_plot'): ToolCallResponse {
  return {
    toolCalls: [{
      id: 'tc-1',
      type: 'function',
      function: {
        name: toolName,
        arguments: args,
      },
    }],
    content: null,
    tokensUsed: 50,
  };
}

const validPlotJson = JSON.stringify({
  title: '透心の朝',
  theme: '存在確認',
  chapters: [
    {
      index: 1,
      title: '目覚め',
      summary: '透心が朝を迎える',
      key_events: ['起床', 'MRタグの確認'],
      target_length: 4000,
    },
    {
      index: 2,
      title: '教室',
      summary: '学校での日常',
      key_events: ['クラスメイトとの会話'],
      target_length: 4000,
    },
  ],
});

describe('parsePlotResponse', () => {
  it('should parse a valid plot response', () => {
    const response = makeToolResponse(validPlotJson);
    const result = parsePlotResponse(response);

    expect(result.title).toBe('透心の朝');
    expect(result.theme).toBe('存在確認');
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].index).toBe(1);
    expect(result.chapters[0].title).toBe('目覚め');
  });

  it('should parse chapters with variation_constraints', () => {
    const plotWithConstraints = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: [{
        index: 1,
        title: '章1',
        summary: '概要',
        key_events: ['イベント'],
        target_length: 4000,
        variation_constraints: {
          structure_type: 'single_scene',
          emotional_arc: 'ascending',
          pacing: 'slow_burn',
          deviation_from_previous: null,
          motif_budget: [{ motif: 'ライオン', max_uses: 2 }],
        },
      }],
    });
    const response = makeToolResponse(plotWithConstraints);
    const result = parsePlotResponse(response);

    expect(result.chapters[0].variation_constraints).toBeDefined();
    expect(result.chapters[0].variation_constraints!.structure_type).toBe('single_scene');
    expect(result.chapters[0].variation_constraints!.motif_budget).toHaveLength(1);
  });

  it('should parse chapters with epistemic_constraints', () => {
    const plotWithEpistemic = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: [{
        index: 1,
        title: '章1',
        summary: '概要',
        key_events: ['イベント'],
        target_length: 4000,
        epistemic_constraints: [{
          perspective: '透心',
          constraints: ['つるぎの正体を知らない'],
        }],
      }],
    });
    const response = makeToolResponse(plotWithEpistemic);
    const result = parsePlotResponse(response);

    expect(result.chapters[0].epistemic_constraints).toHaveLength(1);
    expect(result.chapters[0].epistemic_constraints![0].perspective).toBe('透心');
  });

  it('should throw when tool call is missing', () => {
    const response: ToolCallResponse = {
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: { name: 'wrong_tool', arguments: '{}' },
      }],
      content: null,
      tokensUsed: 50,
    };

    expect(() => parsePlotResponse(response)).toThrow('Failed to parse tool call arguments');
  });

  it('should throw when arguments JSON is invalid', () => {
    const response = makeToolResponse('not-json');

    expect(() => parsePlotResponse(response)).toThrow('Failed to parse tool call arguments');
  });

  it('should throw on schema validation failure — empty title', () => {
    const invalidPlot = JSON.stringify({
      title: '',
      theme: 'test',
      chapters: [{ index: 1, title: 'c', summary: 's', key_events: ['e'], target_length: 1000 }],
    });
    const response = makeToolResponse(invalidPlot);

    expect(() => parsePlotResponse(response)).toThrow('Plot validation failed');
  });

  it('should throw on schema validation failure — empty chapters', () => {
    const invalidPlot = JSON.stringify({
      title: 'valid',
      theme: 'valid',
      chapters: [],
    });
    const response = makeToolResponse(invalidPlot);

    expect(() => parsePlotResponse(response)).toThrow('Plot validation failed');
  });

  it('should throw on schema validation failure — missing key_events', () => {
    const invalidPlot = JSON.stringify({
      title: 'valid',
      theme: 'valid',
      chapters: [{ index: 1, title: 'c', summary: 's', key_events: [], target_length: 1000 }],
    });
    const response = makeToolResponse(invalidPlot);

    expect(() => parsePlotResponse(response)).toThrow('Plot validation failed');
  });

  it('should coerce chapters from JSON string to array', () => {
    const chapters = [
      { index: 1, title: '章1', summary: '概要', key_events: ['イベント'], target_length: 4000 },
    ];
    const plot = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: JSON.stringify(chapters),
    });
    const response = makeToolResponse(plot);
    const result = parsePlotResponse(response);

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe('章1');
  });

  it('should coerce key_events from JSON string to array', () => {
    const plot = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: [{
        index: 1,
        title: '章1',
        summary: '概要',
        key_events: JSON.stringify(['起床', 'MRタグ確認']),
        target_length: 4000,
      }],
    });
    const response = makeToolResponse(plot);
    const result = parsePlotResponse(response);

    expect(result.chapters[0].key_events).toEqual(['起床', 'MRタグ確認']);
  });

  it('should coerce both chapters and key_events from JSON strings', () => {
    const chapters = [
      { index: 1, title: '章1', summary: '概要', key_events: JSON.stringify(['イベント']), target_length: 4000 },
    ];
    const plot = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: JSON.stringify(chapters),
    });
    const response = makeToolResponse(plot);
    const result = parsePlotResponse(response);

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].key_events).toEqual(['イベント']);
  });

  it('should throw when chapters is an invalid string', () => {
    const plot = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: 'not-valid-json',
    });
    const response = makeToolResponse(plot);

    expect(() => parsePlotResponse(response)).toThrow('Plot validation failed');
  });
});

describe('parsePlotSkeletonResponse', () => {
  it('should parse a valid skeleton response', () => {
    const json = JSON.stringify({
      title: '螺旋の水位',
      theme: '存在と監視',
      chapters: [
        { index: 1, title: '目覚め', summary: '朝の始まり', key_events: ['起床'], target_length: 4000 },
        { index: 2, title: '教室', summary: '学校生活', key_events: ['会話'], target_length: 4000 },
      ],
    });
    const response = makeToolResponse(json, 'submit_plot_skeleton');
    const result = parsePlotSkeletonResponse(response);

    expect(result.title).toBe('螺旋の水位');
    expect(result.theme).toBe('存在と監視');
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].title).toBe('目覚め');
    expect(result.chapters[1].key_events).toEqual(['会話']);
  });

  it('should apply default target_length', () => {
    const json = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: [
        { index: 1, title: '章1', summary: '概要', key_events: ['イベント'] },
      ],
    });
    const response = makeToolResponse(json, 'submit_plot_skeleton');
    const result = parsePlotSkeletonResponse(response);

    expect(result.chapters[0].target_length).toBe(4000);
  });

  it('should throw on missing tool call', () => {
    const response: ToolCallResponse = {
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: { name: 'wrong_tool', arguments: '{}' },
      }],
      content: null,
      tokensUsed: 50,
    };
    expect(() => parsePlotSkeletonResponse(response)).toThrow('Failed to parse plot skeleton tool call arguments');
  });

  it('should throw on empty title', () => {
    const json = JSON.stringify({
      title: '',
      theme: 'テーマ',
      chapters: [{ index: 1, title: '章1', summary: '概要', key_events: ['e'], target_length: 4000 }],
    });
    const response = makeToolResponse(json, 'submit_plot_skeleton');
    expect(() => parsePlotSkeletonResponse(response)).toThrow('Plot skeleton validation failed');
  });

  it('should throw on empty chapters', () => {
    const json = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: [],
    });
    const response = makeToolResponse(json, 'submit_plot_skeleton');
    expect(() => parsePlotSkeletonResponse(response)).toThrow('Plot skeleton validation failed');
  });

  it('should coerce stringified chapters array', () => {
    const chapters = [
      { index: 1, title: '章1', summary: '概要', key_events: ['イベント'], target_length: 4000 },
    ];
    const json = JSON.stringify({
      title: 'テスト',
      theme: 'テーマ',
      chapters: JSON.stringify(chapters),
    });
    const response = makeToolResponse(json, 'submit_plot_skeleton');
    const result = parsePlotSkeletonResponse(response);

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe('章1');
  });
});

describe('parseChapterConstraintsResponse', () => {
  it('should parse valid constraints response', () => {
    const json = JSON.stringify({
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
    });
    const response = makeToolResponse(json, 'submit_chapter_constraints');
    const result = parseChapterConstraintsResponse(response);

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].variation_constraints?.structure_type).toBe('single_scene');
    expect(result.chapters[0].epistemic_constraints).toHaveLength(1);
    expect(result.chapters[1].variation_constraints?.deviation_from_previous).toBe('前章との差分');
  });

  it('should return empty chapters on validation failure', () => {
    const json = JSON.stringify({ invalid: 'data' });
    const response = makeToolResponse(json, 'submit_chapter_constraints');
    const result = parseChapterConstraintsResponse(response);

    expect(result.chapters).toEqual([]);
  });

  it('should return empty chapters on parse failure', () => {
    const response: ToolCallResponse = {
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: { name: 'wrong_tool', arguments: '{}' },
      }],
      content: null,
      tokensUsed: 50,
    };
    const result = parseChapterConstraintsResponse(response);
    expect(result.chapters).toEqual([]);
  });

  it('should handle constraints with motif_budget', () => {
    const json = JSON.stringify({
      chapters: [{
        index: 1,
        variation_constraints: {
          structure_type: 'single_scene',
          emotional_arc: 'ascending',
          pacing: 'slow_burn',
          motif_budget: [{ motif: '×マーク', max_uses: 2 }],
        },
      }],
    });
    const response = makeToolResponse(json, 'submit_chapter_constraints');
    const result = parseChapterConstraintsResponse(response);

    expect(result.chapters[0].variation_constraints?.motif_budget).toHaveLength(1);
    expect(result.chapters[0].variation_constraints?.motif_budget![0].motif).toBe('×マーク');
  });
});

describe('coerceStringifiedArrays', () => {
  it('should pass through non-object values', () => {
    expect(coerceStringifiedArrays(null)).toBeNull();
    expect(coerceStringifiedArrays(undefined)).toBeUndefined();
    expect(coerceStringifiedArrays(42)).toBe(42);
    expect(coerceStringifiedArrays('string')).toBe('string');
  });

  it('should pass through objects without string arrays', () => {
    const input = { title: 'test', chapters: [{ key_events: ['a'] }] };
    const result = coerceStringifiedArrays(input) as Record<string, unknown>;
    expect(result.chapters).toEqual([{ key_events: ['a'] }]);
  });

  it('should coerce motif_budget from string', () => {
    const budget = [{ motif: 'ライオン', max_uses: 2 }];
    const input = {
      chapters: [{
        key_events: ['e'],
        motif_budget: JSON.stringify(budget),
      }],
    };
    const result = coerceStringifiedArrays(input) as Record<string, unknown>;
    const ch = (result.chapters as Record<string, unknown>[])[0];
    expect(ch.motif_budget).toEqual(budget);
  });
});
