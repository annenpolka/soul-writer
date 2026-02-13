import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJudge } from '../../src/agents/judge.js';
import type { JudgeDeps } from '../../src/agents/types.js';
import { createMockLLMClientWithStructured } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { JudgeRawResponse } from '../../src/schemas/judge-response.js';

function createMockJudgeDeps(overrides?: {
  data?: JudgeRawResponse;
}): JudgeDeps {
  const defaultData: JudgeRawResponse = {
    winner: 'A',
    reasoning: 'A is stronger overall',
    scores: {
      A: { style: 0.8, compliance: 0.9, overall: 0.85, voice_accuracy: 0.8, originality: 0.7, structure: 0.8, amplitude: 0.7, agency: 0.6, stakes: 0.7 },
      B: { style: 0.6, compliance: 0.7, overall: 0.65, voice_accuracy: 0.6, originality: 0.5, structure: 0.6, amplitude: 0.5, agency: 0.4, stakes: 0.5 },
    },
    praised_excerpts: { A: ['good A'], B: ['good B'] },
    weaknesses: {
      A: [{ category: 'pacing', description: 'Slow', suggestedFix: 'Tighten', severity: 'minor' }],
      B: [{ category: 'voice', description: 'Off', suggestedFix: 'Fix tone', severity: 'major' }],
    },
    axis_comments: [
      { axis: 'style', commentA: 'Good rhythm', commentB: 'Uneven', exampleA: 'ex-A', exampleB: 'ex-B' },
    ],
    section_analysis: [
      { section: 'introduction', ratingA: 'excellent', ratingB: 'good', commentA: 'Strong', commentB: 'Adequate' },
    ],
  };

  return {
    llmClient: createMockLLMClientWithStructured<JudgeRawResponse>(overrides?.data ?? defaultData),
    soulText: createMockSoulText(),
  };
}

describe('createJudge evaluate() with enhanced fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return weaknesses from structured response', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');

    expect(result.weaknesses).toBeDefined();
    expect(result.weaknesses!.A).toHaveLength(1);
    expect(result.weaknesses!.A[0].category).toBe('pacing');
    expect(result.weaknesses!.B[0].severity).toBe('major');
  });

  it('should return axis_comments from structured response', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');

    expect(result.axis_comments).toBeDefined();
    expect(result.axis_comments).toHaveLength(1);
    expect(result.axis_comments![0].axis).toBe('style');
    expect(result.axis_comments![0].exampleA).toBe('ex-A');
  });

  it('should return section_analysis from structured response', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');

    expect(result.section_analysis).toBeDefined();
    expect(result.section_analysis).toHaveLength(1);
    expect(result.section_analysis![0].ratingA).toBe('excellent');
  });

  it('should work without enhanced fields (backward compatible)', async () => {
    const deps = createMockJudgeDeps({
      data: {
        winner: 'B',
        reasoning: 'B wins',
        scores: {
          A: { style: 0.5, compliance: 0.5, overall: 0.5, voice_accuracy: 0.5, originality: 0.5, structure: 0.5, amplitude: 0.5, agency: 0.5, stakes: 0.5 },
          B: { style: 0.8, compliance: 0.8, overall: 0.8, voice_accuracy: 0.8, originality: 0.8, structure: 0.8, amplitude: 0.8, agency: 0.8, stakes: 0.8 },
        },
        praised_excerpts: { A: [], B: [] },
      },
    });
    const judge = createJudge(deps);
    const result = await judge.evaluate('A', 'B');

    expect(result.winner).toBe('B');
    expect(result.weaknesses).toBeUndefined();
    expect(result.axis_comments).toBeUndefined();
    expect(result.section_analysis).toBeUndefined();
  });
});
