import { describe, it, expect } from 'vitest';
import type { ToolCallResponse } from '../../../src/llm/types.js';
import { parsePlotResponse } from '../../../src/agents/parsers/plotter-parser.js';

function makeToolResponse(args: string): ToolCallResponse {
  return {
    toolCalls: [{
      id: 'tc-1',
      type: 'function',
      function: {
        name: 'submit_plot',
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
});
