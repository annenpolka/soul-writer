import { describe, it, expect } from 'vitest';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { JudgeRawResponse } from '../../../src/schemas/judge-response.js';
import { parseJudgeResponse, normalizeScore, createFallbackResult } from '../../../src/agents/parsers/judge-parser.js';

function makeStructuredResponse(data: JudgeRawResponse): StructuredResponse<JudgeRawResponse> {
  return {
    data,
    reasoning: null,
    tokensUsed: 50,
  };
}

describe('parseJudgeResponse', () => {
  it('should parse a valid structured response', () => {
    const response = makeStructuredResponse({
      winner: 'A',
      reasoning: 'Aが優れている',
      scores: {
        A: { style: 0.8, compliance: 0.9, overall: 0.85 },
        B: { style: 0.7, compliance: 0.8, overall: 0.75 },
      },
      praised_excerpts: {
        A: ['良い表現A'],
        B: ['良い表現B'],
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.winner).toBe('A');
    expect(result.reasoning).toBe('Aが優れている');
    expect(result.scores.A.style).toBe(0.8);
    expect(result.scores.B.style).toBe(0.7);
    expect(result.praised_excerpts?.A).toEqual(['良い表現A']);
    expect(result.praised_excerpts?.B).toEqual(['良い表現B']);
  });

  it('should parse winner B correctly', () => {
    const response = makeStructuredResponse({
      winner: 'B',
      reasoning: 'Bが優れている',
      scores: {
        A: { style: 0.5, compliance: 0.5, overall: 0.5 },
        B: { style: 0.8, compliance: 0.8, overall: 0.8 },
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.winner).toBe('B');
  });

  it('should provide default reasoning when empty', () => {
    const response = makeStructuredResponse({
      winner: 'A',
      reasoning: '',
      scores: {
        A: { style: 0.5, compliance: 0.5, overall: 0.5 },
        B: { style: 0.5, compliance: 0.5, overall: 0.5 },
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.reasoning).toBe('No reasoning provided');
  });

  it('should handle missing praised_excerpts by defaulting to empty arrays', () => {
    const response = makeStructuredResponse({
      winner: 'A',
      reasoning: 'reason',
      scores: {
        A: { style: 0.5, compliance: 0.5, overall: 0.5 },
        B: { style: 0.5, compliance: 0.5, overall: 0.5 },
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.praised_excerpts?.A).toEqual([]);
    expect(result.praised_excerpts?.B).toEqual([]);
  });

  it('should capture LLM reasoning from response', () => {
    const response: StructuredResponse<JudgeRawResponse> = {
      data: {
        winner: 'A',
        reasoning: 'Aが優れている',
        scores: {
          A: { style: 0.8, compliance: 0.9, overall: 0.85 },
          B: { style: 0.7, compliance: 0.8, overall: 0.75 },
        },
      },
      reasoning: 'Judge LLM推論: テキストAの文体が一貫していた',
      tokensUsed: 50,
    };
    const result = parseJudgeResponse(response);

    expect(result.llmReasoning).toBe('Judge LLM推論: テキストAの文体が一貫していた');
  });

  it('should set llmReasoning to null when response.reasoning is null', () => {
    const response = makeStructuredResponse({
      winner: 'A',
      reasoning: 'reason',
      scores: {
        A: { style: 0.5, compliance: 0.5, overall: 0.5 },
        B: { style: 0.5, compliance: 0.5, overall: 0.5 },
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.llmReasoning).toBeNull();
  });

  it('should clamp scores via normalizeScore', () => {
    const response = makeStructuredResponse({
      winner: 'A',
      reasoning: 'reason',
      scores: {
        A: { style: 1.5, compliance: -0.3, overall: 0.5 },
        B: { style: 0.0, compliance: 1.0, overall: 0.5 },
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.scores.A.style).toBe(0.95);
    expect(result.scores.A.compliance).toBe(0.05);
    expect(result.scores.B.style).toBe(0.05);
    expect(result.scores.B.compliance).toBe(0.95);
  });
});

describe('normalizeScore', () => {
  it('should clamp values to [0.05, 0.95]', () => {
    const result = normalizeScore({ style: 0.0, compliance: 1.0, overall: 0.5 });

    expect(result.style).toBe(0.05);
    expect(result.compliance).toBe(0.95);
    expect(result.overall).toBe(0.5);
  });

  it('should default undefined values to 0.5', () => {
    const result = normalizeScore(undefined);

    expect(result.style).toBe(0.5);
    expect(result.compliance).toBe(0.5);
    expect(result.overall).toBe(0.5);
    expect(result.voice_accuracy).toBe(0.5);
    expect(result.originality).toBe(0.5);
    expect(result.structure).toBe(0.5);
    expect(result.amplitude).toBe(0.5);
    expect(result.agency).toBe(0.5);
    expect(result.stakes).toBe(0.5);
  });

  it('should handle partial scores', () => {
    const result = normalizeScore({ style: 0.8, compliance: 0.9, overall: 0.85 });

    expect(result.style).toBe(0.8);
    expect(result.compliance).toBe(0.9);
    expect(result.overall).toBe(0.85);
    // Missing optional fields default to 0.5
    expect(result.voice_accuracy).toBe(0.5);
    expect(result.originality).toBe(0.5);
    expect(result.structure).toBe(0.5);
    expect(result.amplitude).toBe(0.5);
    expect(result.agency).toBe(0.5);
    expect(result.stakes).toBe(0.5);
  });
});

describe('createFallbackResult', () => {
  it('should return a valid JudgeResult with default values', () => {
    const result = createFallbackResult();

    expect(result.winner).toBe('A');
    expect(result.reasoning).toBe('Fallback: structured output parsing failed');
    expect(result.scores.A.style).toBe(0.5);
    expect(result.scores.A.compliance).toBe(0.5);
    expect(result.scores.A.overall).toBe(0.5);
    expect(result.scores.B.style).toBe(0.5);
    expect(result.scores.B.compliance).toBe(0.5);
    expect(result.scores.B.overall).toBe(0.5);
  });
});
