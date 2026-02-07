import { describe, it, expect, vi } from 'vitest';
import { analyzePreviousChapter } from '../../src/pipeline/chapter-summary.js';
import type { LLMClient } from '../../src/llm/types.js';

function createMockLLMClient(toolResponse: unknown) {
  return {
    complete: vi.fn(),
    completeWithTools: vi.fn().mockResolvedValue({
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: {
          name: 'report_chapter_analysis',
          arguments: JSON.stringify(toolResponse),
        },
      }],
      content: null,
      tokensUsed: 100,
    }),
    getTotalTokens: vi.fn().mockReturnValue(0),
  } satisfies LLMClient;
}

const sampleChapterText = '透心は窓の外を見た。灰色の空が広がっていた。';

describe('analyzePreviousChapter', () => {
  it('正常系: PreviousChapterAnalysis が正しくパースされる', async () => {
    const toolResponse = {
      storySummary: '透心が窓の外の灰色の空を眺め、孤独を感じる場面',
      emotionalBeats: ['孤独', '諦観', '微かな希望'],
      dominantImagery: ['灰色', '窓', '空'],
      rhythmProfile: '短文連打のスタッカート',
      structuralPattern: '観察→内省→未解決',
    };
    const client = createMockLLMClient(toolResponse);

    const result = await analyzePreviousChapter(client, sampleChapterText);

    expect(result.storySummary).toBe('透心が窓の外の灰色の空を眺め、孤独を感じる場面');
    expect(result.avoidanceDirective.emotionalBeats).toEqual(['孤独', '諦観', '微かな希望']);
    expect(result.avoidanceDirective.dominantImagery).toEqual(['灰色', '窓', '空']);
    expect(result.avoidanceDirective.rhythmProfile).toBe('短文連打のスタッカート');
    expect(result.avoidanceDirective.structuralPattern).toBe('観察→内省→未解決');
  });

  it('storySummary と avoidanceDirective の各フィールドが返される', async () => {
    const toolResponse = {
      storySummary: '要約テスト',
      emotionalBeats: ['怒り'],
      dominantImagery: ['炎'],
      rhythmProfile: '長文の波状',
      structuralPattern: '衝突→収束',
    };
    const client = createMockLLMClient(toolResponse);

    const result = await analyzePreviousChapter(client, sampleChapterText);

    expect(result).toHaveProperty('storySummary');
    expect(result).toHaveProperty('avoidanceDirective');
    expect(result.avoidanceDirective).toHaveProperty('emotionalBeats');
    expect(result.avoidanceDirective).toHaveProperty('dominantImagery');
    expect(result.avoidanceDirective).toHaveProperty('rhythmProfile');
    expect(result.avoidanceDirective).toHaveProperty('structuralPattern');
  });

  it('tool calling 非対応 LLM で throw する', async () => {
    const client: LLMClient = {
      complete: vi.fn(),
      getTotalTokens: vi.fn().mockReturnValue(0),
      // completeWithTools is undefined
    };

    await expect(analyzePreviousChapter(client, sampleChapterText)).rejects.toThrow(
      'LLMClient does not support tool calling',
    );
  });

  it('completeWithTools が throw した場合にエラーが伝播する', async () => {
    const client: LLMClient = {
      complete: vi.fn(),
      completeWithTools: vi.fn().mockRejectedValue(new Error('API error')),
      getTotalTokens: vi.fn().mockReturnValue(0),
    };

    await expect(analyzePreviousChapter(client, sampleChapterText)).rejects.toThrow('API error');
  });
});
