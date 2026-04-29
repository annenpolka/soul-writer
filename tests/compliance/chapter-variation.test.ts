import { describe, it, expect, vi } from 'vitest';
import { createChapterVariationRule } from '../../src/compliance/rules/chapter-variation.js';
import type { ChapterContext } from '../../src/agents/types.js';

function createMockLLMClient(issues: unknown[]) {
  return {
    complete: vi.fn(),
    completeStructured: vi.fn().mockResolvedValue({
      data: { issues },
      reasoning: null,
      tokensUsed: 100,
    }),
    getTotalTokens: vi.fn().mockReturnValue(0),
  };
}

describe('createChapterVariationRule', () => {
  it('should return empty violations for first chapter (no previous chapters)', async () => {
    const client = createMockLLMClient([]);
    const rule = createChapterVariationRule(client);

    const result = await rule.check('第1章のテキスト');
    expect(result).toEqual([]);
    expect(client.completeStructured).not.toHaveBeenCalled();
  });

  it('should return empty violations when chapterContext has empty previousChapterTexts', async () => {
    const client = createMockLLMClient([]);
    const rule = createChapterVariationRule(client);
    const ctx: ChapterContext = { previousChapterTexts: [] };

    const result = await rule.check('第1章のテキスト', ctx);
    expect(result).toEqual([]);
    expect(client.completeStructured).not.toHaveBeenCalled();
  });

  it('should detect variation issues and convert to Violation[]', async () => {
    const issues = [
      {
        type: 'emotional_arc_similarity',
        description: '両章とも「疎外→怒り→諦観」の同一パターン',
        severity: 'warning',
        suggestion: '感情遷移を変化させてください',
      },
      {
        type: 'beat_structure_similarity',
        description: 'ビート構成がほぼ同一',
        severity: 'error',
        suggestion: '展開構造を変えてください',
      },
    ];
    const client = createMockLLMClient(issues);
    const rule = createChapterVariationRule(client);
    const ctx: ChapterContext = { previousChapterTexts: ['前章のテキスト'] };

    const result = await rule.check('現在の章のテキスト', ctx);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'chapter_variation',
      position: { start: 0, end: 0 },
      context: '感情遷移を変化させてください',
      rule: 'emotional_arc_similarity: 両章とも「疎外→怒り→諦観」の同一パターン',
      severity: 'warning',
    });
    expect(result[1]).toEqual({
      type: 'chapter_variation',
      position: { start: 0, end: 0 },
      context: '展開構造を変えてください',
      rule: 'beat_structure_similarity: ビート構成がほぼ同一',
      severity: 'error',
    });
  });

  it('should return empty violations when no issues found', async () => {
    const client = createMockLLMClient([]);
    const rule = createChapterVariationRule(client);
    const ctx: ChapterContext = { previousChapterTexts: ['前章のテキスト'] };

    const result = await rule.check('現在の章のテキスト', ctx);
    expect(result).toEqual([]);
  });

  it('should work with a client that has structured output but no tool calling', async () => {
    const client = {
      complete: vi.fn(),
      completeStructured: vi.fn().mockResolvedValue({
        data: { issues: [] },
        reasoning: null,
        tokensUsed: 0,
      }),
      getTotalTokens: vi.fn().mockReturnValue(0),
    };
    const rule = createChapterVariationRule(client);
    const ctx: ChapterContext = { previousChapterTexts: ['前章のテキスト'] };

    await expect(rule.check('テキスト', ctx)).resolves.toEqual([]);
  });

  it('should return empty violations on parse failure (graceful degradation)', async () => {
    const client = {
      complete: vi.fn(),
      completeStructured: vi.fn().mockResolvedValue({
        data: { issues: [{ type: 'invalid' }] },
        reasoning: null,
        tokensUsed: 100,
      }),
      getTotalTokens: vi.fn().mockReturnValue(0),
    };
    const rule = createChapterVariationRule(client);
    const ctx: ChapterContext = { previousChapterTexts: ['前章のテキスト'] };

    const result = await rule.check('テキスト', ctx);
    expect(result).toEqual([]);
  });

  it('should only compare with the most recent previous chapter', async () => {
    const client = createMockLLMClient([]);
    const rule = createChapterVariationRule(client);
    const ctx: ChapterContext = {
      previousChapterTexts: ['第1章', '第2章', '第3章'],
    };

    await rule.check('第4章のテキスト', ctx);

    expect(client.completeStructured).toHaveBeenCalledTimes(1);
    const messages = client.completeStructured.mock.calls[0][0] as Array<{ role: string; content: string }>;
    const userPrompt = messages[1].content;
    expect(userPrompt).toContain('第3章');
    expect(userPrompt).not.toContain('第1章');
    expect(userPrompt).not.toContain('第2章');
  });
});
