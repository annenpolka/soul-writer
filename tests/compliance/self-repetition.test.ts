import { describe, it, expect, vi } from 'vitest';
import { SelfRepetitionRule } from '../../src/compliance/rules/self-repetition.js';
import type { LLMClient, ToolCallResponse } from '../../src/llm/types.js';
import type { ChapterContext } from '../../src/agents/types.js';

function createMockLLMClient(toolResponse: unknown): LLMClient {
  return {
    complete: vi.fn(),
    completeWithTools: vi.fn().mockResolvedValue({
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'report_repetitions',
            arguments: JSON.stringify(toolResponse),
          },
        },
      ],
      content: null,
      tokensUsed: 100,
    } satisfies ToolCallResponse),
    getTotalTokens: vi.fn().mockReturnValue(100),
  };
}

describe('SelfRepetitionRule', () => {
  it('should return violations when repetitions are detected', async () => {
    const mockClient = createMockLLMClient({
      repetitions: [
        {
          type: 'phrase',
          description: '「静かに」が4回使用されている',
          severity: 'error',
          examples: ['静かに'],
        },
      ],
    });

    const rule = new SelfRepetitionRule(mockClient);
    const text = '透心は静かに歩いた。静かに座った。静かに立ち上がった。静かに笑った。';
    const violations = await rule.check(text);

    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('self_repetition');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].rule).toContain('phrase');
  });

  it('should return empty array when no repetitions found', async () => {
    const mockClient = createMockLLMClient({
      repetitions: [],
    });

    const rule = new SelfRepetitionRule(mockClient);
    const violations = await rule.check('多様な表現で書かれた文章。');

    expect(violations).toHaveLength(0);
  });

  it('should pass chapter context to LLM for cross-chapter detection', async () => {
    const mockClient = createMockLLMClient({
      repetitions: [
        {
          type: 'opening',
          description: '前章と同じ風景描写で開始している',
          severity: 'warning',
          examples: ['窓の外には'],
        },
      ],
    });

    const rule = new SelfRepetitionRule(mockClient);
    const chapterContext: ChapterContext = {
      previousChapterTexts: ['窓の外には雨が降っていた。透心はそれを見つめていた。'],
    };
    const violations = await rule.check(
      '窓の外には雪が降っていた。透心はそれを見つめていた。',
      chapterContext,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('self_repetition');
    expect(violations[0].severity).toBe('warning');

    // Verify that previous chapter text was included in the prompt
    const completeWithTools = mockClient.completeWithTools!;
    expect(completeWithTools).toHaveBeenCalledTimes(1);
    const userPrompt = (completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(userPrompt).toContain('【前章1】');
    expect(userPrompt).toContain('窓の外には雨が降っていた');
  });

  it('should handle tool call parse failure gracefully', async () => {
    const mockClient: LLMClient = {
      complete: vi.fn(),
      completeWithTools: vi.fn().mockResolvedValue({
        toolCalls: [],
        content: null,
        tokensUsed: 100,
      } satisfies ToolCallResponse),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };

    const rule = new SelfRepetitionRule(mockClient);
    const violations = await rule.check('テスト文章。');

    expect(violations).toHaveLength(0);
  });

  it('should detect multiple repetition types', async () => {
    const mockClient = createMockLLMClient({
      repetitions: [
        {
          type: 'phrase',
          description: '同一フレーズの繰り返し',
          severity: 'error',
          examples: ['心臓が跳ねた'],
        },
        {
          type: 'motif',
          description: '×マークのモチーフが磨耗',
          severity: 'warning',
          examples: ['×'],
        },
      ],
    });

    const rule = new SelfRepetitionRule(mockClient);
    const violations = await rule.check('テスト文章。');

    expect(violations).toHaveLength(2);
    expect(violations[0].severity).toBe('error');
    expect(violations[1].severity).toBe('warning');
  });
});
