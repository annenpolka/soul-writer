import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCorrector, buildCorrectorContext } from '../../src/agents/corrector.js';
import type { Violation } from '../../src/agents/types.js';
import { createMockCorrectorDeps, createMockThemeContext } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

describe('buildCorrectorContext (pure function)', () => {
  const soulText = createMockSoulText({
    forbiddenSimiles: ['天使のような'],
  });

  it('should build context with forbidden words from constitution', () => {
    const violations: Violation[] = [{
      type: 'forbidden_word', position: { start: 0, end: 3 },
      context: 'とても', rule: 'test', severity: 'error',
    }];
    const ctx = buildCorrectorContext(soulText, 'test text', violations);
    expect(ctx.forbiddenWords).toEqual(['とても']);
  });

  it('should build context with forbidden similes', () => {
    const ctx = buildCorrectorContext(soulText, 'test', []);
    expect(ctx.forbiddenSimiles).toEqual(['天使のような']);
  });

  it('should include violation list as formatted string', () => {
    const violations: Violation[] = [
      { type: 'forbidden_word', position: { start: 0, end: 3 }, context: 'とても', rule: 'bad word', severity: 'error' },
      { type: 'forbidden_simile', position: { start: 5, end: 10 }, context: '天使のような', rule: 'bad simile', severity: 'error' },
    ];
    const ctx = buildCorrectorContext(soulText, 'test', violations);
    expect(ctx.violationList).toContain('forbidden_word');
    expect(ctx.violationList).toContain('天使のような');
    expect(ctx.violationList).toContain('1.');
    expect(ctx.violationList).toContain('2.');
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext({ emotion: '渇望' });
    const ctx = buildCorrectorContext(soulText, 'test', [], themeContext);
    expect(ctx.themeContext).toEqual(themeContext);
  });

  it('should have undefined themeContext when not provided', () => {
    const ctx = buildCorrectorContext(soulText, 'test', []);
    expect(ctx.themeContext).toBeUndefined();
  });

  it('should include special mark info', () => {
    const ctx = buildCorrectorContext(soulText, 'test', []);
    expect(ctx.specialMark).toBe('×');
  });

  it('should include the original text', () => {
    const ctx = buildCorrectorContext(soulText, 'original text here', []);
    expect(ctx.text).toBe('original text here');
  });
});

describe('createCorrector (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Corrector with correct method', () => {
    const deps = createMockCorrectorDeps();
    const corrector = createCorrector(deps);
    expect(corrector.correct).toBeInstanceOf(Function);
  });

  it('should call LLM with text and violations', async () => {
    const deps = createMockCorrectorDeps({ response: 'Corrected text.' });
    const corrector = createCorrector(deps);

    const violations: Violation[] = [
      {
        type: 'forbidden_word',
        position: { start: 0, end: 3 },
        context: 'とても美しい',
        rule: 'Forbidden word: とても',
        severity: 'error',
      },
    ];

    const result = await corrector.correct('とても美しい文章', violations);
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
    expect(result.correctedText).toBe('Corrected text.');
  });

  it('should include violation info in prompt sent to LLM', async () => {
    const deps = createMockCorrectorDeps();
    const corrector = createCorrector(deps);

    const violations: Violation[] = [
      {
        type: 'forbidden_word',
        position: { start: 0, end: 3 },
        context: 'とても',
        rule: 'test rule',
        severity: 'error',
      },
    ];

    await corrector.correct('とても美しい', violations);

    const userPromptArg = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(userPromptArg).toContain('とても');
    expect(userPromptArg).toContain('forbidden_word');
  });

  it('should return token count', async () => {
    const deps = createMockCorrectorDeps({ tokenCount: 250 });
    const corrector = createCorrector(deps);

    const violations: Violation[] = [
      {
        type: 'forbidden_word',
        position: { start: 0, end: 3 },
        context: 'とても',
        rule: 'test',
        severity: 'error',
      },
    ];

    const result = await corrector.correct('とても美しい', violations);
    expect(result.tokensUsed).toBe(250);
  });

  it('should handle multiple violations', async () => {
    const deps = createMockCorrectorDeps();
    const corrector = createCorrector(deps);

    const violations: Violation[] = [
      {
        type: 'forbidden_word',
        position: { start: 0, end: 3 },
        context: 'とても',
        rule: 'test',
        severity: 'error',
      },
      {
        type: 'forbidden_simile',
        position: { start: 10, end: 16 },
        context: '天使のような',
        rule: 'test',
        severity: 'error',
      },
    ];

    await corrector.correct('とても美しい天使のような笑顔', violations);

    const userPromptArg = (deps.llmClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(userPromptArg).toContain('とても');
    expect(userPromptArg).toContain('天使のような');
  });

  it('should pass themeContext through to context building', async () => {
    const themeContext = createMockThemeContext({ emotion: '渇望' });
    const deps = createMockCorrectorDeps({ themeContext });
    const corrector = createCorrector(deps);

    const violations: Violation[] = [
      {
        type: 'forbidden_word',
        position: { start: 0, end: 3 },
        context: 'とても',
        rule: 'test',
        severity: 'error',
      },
    ];

    // Verify it doesn't throw and produces a valid result
    const result = await corrector.correct('とても美しい', violations);
    expect(result.correctedText).toBeDefined();
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('should work with custom soulText', async () => {
    const soulText = createMockSoulText({
      forbiddenSimiles: ['天使のような'],
      deep: {
        constitution: {
          universal: {
            vocabulary: {
              special_marks: { mark: '×', usage: 'test', forms: ['×した'] },
            },
          },
        },
      } as never,
    });
    const deps = createMockCorrectorDeps();
    deps.soulText = soulText;
    const corrector = createCorrector(deps);

    const violations: Violation[] = [
      {
        type: 'forbidden_word',
        position: { start: 0, end: 3 },
        context: 'とても',
        rule: 'test',
        severity: 'error',
      },
    ];

    const result = await corrector.correct('test text', violations);
    expect(result.correctedText).toBeDefined();
  });
});
