import { describe, it, expect } from 'vitest';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { ReaderPersona } from '../../../src/schemas/reader-personas.js';
import type { ReaderEvaluationRawResponse } from '../../../src/schemas/reader-evaluation-response.js';
import {
  parseEvalToolResponse,
  normalizeScores,
  clampScore,
  getDefaultScores,
  calculateWeightedScore,
} from '../../../src/agents/parsers/reader-eval-parser.js';

function makeStructuredResponse(data: ReaderEvaluationRawResponse): StructuredResponse<ReaderEvaluationRawResponse> {
  return {
    data,
    reasoning: null,
    tokensUsed: 50,
  };
}

const mockPersona: ReaderPersona = {
  id: 'sf_fan',
  name: 'SF愛好家',
  description: 'SFの技術的整合性を重視する読者',
  preferences: ['世界設定の緻密さ'],
  evaluation_weights: {
    style: 0.2,
    plot: 0.2,
    character: 0.2,
    worldbuilding: 0.3,
    readability: 0.1,
  },
};

describe('clampScore', () => {
  it('should return 0.5 for undefined', () => {
    expect(clampScore(undefined)).toBe(0.5);
  });

  it('should return 0.5 for NaN', () => {
    expect(clampScore(NaN)).toBe(0.5);
  });

  it('should clamp values below 0 to 0', () => {
    expect(clampScore(-0.5)).toBe(0);
  });

  it('should clamp values above 1 to 1', () => {
    expect(clampScore(1.5)).toBe(1);
  });

  it('should pass through valid values', () => {
    expect(clampScore(0.7)).toBe(0.7);
  });

  it('should handle boundary values', () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(1)).toBe(1);
  });
});

describe('getDefaultScores', () => {
  it('should return all scores as 0.5', () => {
    const scores = getDefaultScores();
    expect(scores.style).toBe(0.5);
    expect(scores.plot).toBe(0.5);
    expect(scores.character).toBe(0.5);
    expect(scores.worldbuilding).toBe(0.5);
    expect(scores.readability).toBe(0.5);
  });
});

describe('normalizeScores', () => {
  it('should normalize valid partial scores', () => {
    const result = normalizeScores({ style: 0.8, plot: 0.9 });
    expect(result.style).toBe(0.8);
    expect(result.plot).toBe(0.9);
    expect(result.character).toBe(0.5);
    expect(result.worldbuilding).toBe(0.5);
    expect(result.readability).toBe(0.5);
  });

  it('should normalize undefined scores to defaults', () => {
    const result = normalizeScores(undefined);
    expect(result.style).toBe(0.5);
    expect(result.plot).toBe(0.5);
    expect(result.character).toBe(0.5);
    expect(result.worldbuilding).toBe(0.5);
    expect(result.readability).toBe(0.5);
  });

  it('should clamp out-of-range values', () => {
    const result = normalizeScores({ style: 1.5, plot: -0.3, character: 0.7, worldbuilding: 0.8, readability: 0.9 });
    expect(result.style).toBe(1);
    expect(result.plot).toBe(0);
    expect(result.character).toBe(0.7);
  });
});

describe('calculateWeightedScore', () => {
  it('should calculate weighted score using persona weights', () => {
    const scores = { style: 0.8, plot: 0.75, character: 0.7, worldbuilding: 0.9, readability: 0.85 };
    const weights = mockPersona.evaluation_weights;
    const result = calculateWeightedScore(scores, weights);
    // 0.8*0.2 + 0.75*0.2 + 0.7*0.2 + 0.9*0.3 + 0.85*0.1 = 0.16+0.15+0.14+0.27+0.085 = 0.805
    expect(result).toBeCloseTo(0.805, 3);
  });

  it('should return 0 when all scores and weights are 0', () => {
    const scores = { style: 0, plot: 0, character: 0, worldbuilding: 0, readability: 0 };
    const weights = { style: 0, plot: 0, character: 0, worldbuilding: 0, readability: 0 };
    expect(calculateWeightedScore(scores, weights)).toBe(0);
  });
});

describe('parseEvalToolResponse', () => {
  it('should parse a valid structured response with feedback', () => {
    const response = makeStructuredResponse({
      categoryScores: {
        style: 0.8,
        plot: 0.75,
        character: 0.7,
        worldbuilding: 0.9,
        readability: 0.85,
      },
      feedback: {
        strengths: '世界観が優れている',
        weaknesses: '一部テンポが遅い',
        suggestion: '描写を深める',
      },
    });
    const result = parseEvalToolResponse(response, mockPersona);

    expect(result.personaId).toBe('sf_fan');
    expect(result.personaName).toBe('SF愛好家');
    expect(result.categoryScores.style).toBe(0.8);
    expect(result.categoryScores.worldbuilding).toBe(0.9);
    expect(result.feedback.strengths).toBe('世界観が優れている');
    expect(result.feedback.weaknesses).toBe('一部テンポが遅い');
    expect(result.feedback.suggestion).toBe('描写を深める');
    expect(result.weightedScore).toBeCloseTo(0.805, 3);
  });

  it('should handle empty feedback strings', () => {
    const response = makeStructuredResponse({
      categoryScores: {
        style: 0.8,
        plot: 0.75,
        character: 0.7,
        worldbuilding: 0.9,
        readability: 0.85,
      },
      feedback: {
        strengths: '',
        weaknesses: '',
        suggestion: '',
      },
    });
    const result = parseEvalToolResponse(response, mockPersona);

    expect(result.feedback.strengths).toBe('');
    expect(result.feedback.weaknesses).toBe('');
    expect(result.feedback.suggestion).toBe('');
  });
});
