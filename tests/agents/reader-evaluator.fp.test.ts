import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReaderEvaluator } from '../../src/agents/reader-evaluator.js';
import type { ReaderEvaluatorDeps } from '../../src/agents/types.js';
import type { ReaderPersona } from '../../src/schemas/reader-personas.js';
import type { ReaderEvaluationRawResponse } from '../../src/schemas/reader-evaluation-response.js';
import { createMockLLMClientWithStructured } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockPersona(overrides?: Partial<ReaderPersona>): ReaderPersona {
  return {
    id: 'test_persona',
    name: 'Test Persona',
    description: 'A test persona',
    preferences: ['preference 1'],
    evaluation_weights: { style: 0.2, plot: 0.2, character: 0.2, worldbuilding: 0.2, readability: 0.2 },
    ...overrides,
  };
}

function createMockReaderEvalDeps(overrides?: {
  structuredData?: ReaderEvaluationRawResponse;
  tokenCount?: number;
  persona?: ReaderPersona;
}): ReaderEvaluatorDeps {
  const defaultData: ReaderEvaluationRawResponse = {
    categoryScores: { style: 0.8, plot: 0.7, character: 0.9, worldbuilding: 0.6, readability: 0.85 },
    feedback: { strengths: 'Good style', weaknesses: 'Weak plot', suggestion: 'Add more plot' },
  };
  return {
    llmClient: createMockLLMClientWithStructured(
      overrides?.structuredData ?? defaultData,
      { tokenCount: overrides?.tokenCount },
    ),
    soulText: createMockSoulText(),
    persona: overrides?.persona ?? createMockPersona(),
  };
}

describe('createReaderEvaluator (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a ReaderEval with evaluate method', () => {
    const deps = createMockReaderEvalDeps();
    const evaluator = createReaderEvaluator(deps);
    expect(evaluator.evaluate).toBeInstanceOf(Function);
  });

  it('should call completeStructured on the llmClient', async () => {
    const deps = createMockReaderEvalDeps();
    const evaluator = createReaderEvaluator(deps);

    await evaluator.evaluate('test text');
    expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(1);
  });

  it('should return PersonaEvaluation with correct personaId and name', async () => {
    const persona = createMockPersona({ id: 'custom_id', name: 'Custom Name' });
    const deps = createMockReaderEvalDeps({ persona });
    const evaluator = createReaderEvaluator(deps);

    const result = await evaluator.evaluate('test text');
    expect(result.personaId).toBe('custom_id');
    expect(result.personaName).toBe('Custom Name');
  });

  it('should parse category scores from structured response', async () => {
    const deps = createMockReaderEvalDeps();
    const evaluator = createReaderEvaluator(deps);

    const result = await evaluator.evaluate('test text');
    expect(result.categoryScores.style).toBe(0.8);
    expect(result.categoryScores.plot).toBe(0.7);
    expect(result.categoryScores.character).toBe(0.9);
    expect(result.categoryScores.worldbuilding).toBe(0.6);
    expect(result.categoryScores.readability).toBe(0.85);
  });

  it('should parse feedback from structured response', async () => {
    const deps = createMockReaderEvalDeps();
    const evaluator = createReaderEvaluator(deps);

    const result = await evaluator.evaluate('test text');
    expect(result.feedback.strengths).toBe('Good style');
    expect(result.feedback.weaknesses).toBe('Weak plot');
    expect(result.feedback.suggestion).toBe('Add more plot');
  });

  it('should calculate weighted score using persona weights', async () => {
    const persona = createMockPersona({
      evaluation_weights: { style: 0.5, plot: 0.1, character: 0.2, worldbuilding: 0.1, readability: 0.1 },
    });
    const deps = createMockReaderEvalDeps({
      persona,
      structuredData: {
        categoryScores: { style: 1.0, plot: 0.0, character: 0.0, worldbuilding: 0.0, readability: 0.0 },
        feedback: { strengths: 'a', weaknesses: 'b', suggestion: 'c' },
      },
    });
    const evaluator = createReaderEvaluator(deps);

    const result = await evaluator.evaluate('test text');
    // 1.0 * 0.5 + 0.0 * 0.1 + 0.0 * 0.2 + 0.0 * 0.1 + 0.0 * 0.1 = 0.5
    expect(result.weightedScore).toBeCloseTo(0.5);
  });

  it('should pass previousEvaluation context to prompt', async () => {
    const deps = createMockReaderEvalDeps();
    const evaluator = createReaderEvaluator(deps);

    const previousEvaluation = {
      personaId: 'test_persona',
      personaName: 'Test',
      categoryScores: { style: 0.5, plot: 0.5, character: 0.5, worldbuilding: 0.5, readability: 0.5 },
      weightedScore: 0.5,
      feedback: { strengths: 'prev strength', weaknesses: 'prev weakness', suggestion: 'prev suggestion' },
    };

    await evaluator.evaluate('test text', previousEvaluation);
    expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(1);
  });

  it('should handle completeStructured failure gracefully', async () => {
    const deps = createMockReaderEvalDeps();
    (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('LLM error'));
    const evaluator = createReaderEvaluator(deps);

    const result = await evaluator.evaluate('test text');
    // Should fall back to defaults
    expect(result.categoryScores).toBeDefined();
    expect(result.categoryScores.style).toBe(0.5);
    expect(result.feedback).toBeDefined();
    expect(result.feedback.weaknesses).toContain('structured output');
  });
});
