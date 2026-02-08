import { describe, it, expect } from 'vitest';
import type { ToolCallResponse } from '../../../src/llm/types.js';
import { parseJudgeResponse } from '../../../src/agents/parsers/judge-parser.js';

function makeToolResponse(args: Record<string, unknown>): ToolCallResponse {
  return {
    toolCalls: [{
      id: 'tc-1',
      type: 'function',
      function: {
        name: 'submit_judgement',
        arguments: JSON.stringify(args),
      },
    }],
    content: null,
    tokensUsed: 50,
  };
}

const baseArgs = {
  winner: 'A',
  reasoning: 'A is better',
  scores: {
    A: { style: 0.8, compliance: 0.9, overall: 0.85, voice_accuracy: 0.8, originality_fidelity: 0.7, narrative_quality: 0.8, novelty: 0.7 },
    B: { style: 0.6, compliance: 0.7, overall: 0.65, voice_accuracy: 0.6, originality_fidelity: 0.5, narrative_quality: 0.6, novelty: 0.5 },
  },
  praised_excerpts: { A: ['excerpt'], B: ['excerpt'] },
};

describe('parseJudgeResponse - enhanced fields', () => {
  it('should parse weaknesses when present', () => {
    const response = makeToolResponse({
      ...baseArgs,
      weaknesses: {
        A: [{ category: 'pacing', description: 'Slow middle', suggestedFix: 'Tighten', severity: 'minor' }],
        B: [
          { category: 'voice', description: 'Inconsistent', suggestedFix: 'Maintain tone', severity: 'major' },
          { category: 'style', description: 'Overwritten', suggestedFix: 'Simplify', severity: 'critical' },
        ],
      },
    });
    const result = parseJudgeResponse(response);

    expect(result.weaknesses).toBeDefined();
    expect(result.weaknesses!.A).toHaveLength(1);
    expect(result.weaknesses!.A[0].category).toBe('pacing');
    expect(result.weaknesses!.A[0].severity).toBe('minor');
    expect(result.weaknesses!.B).toHaveLength(2);
    expect(result.weaknesses!.B[0].category).toBe('voice');
    expect(result.weaknesses!.B[1].severity).toBe('critical');
  });

  it('should parse axis_comments when present', () => {
    const response = makeToolResponse({
      ...baseArgs,
      axis_comments: [
        { axis: 'style', commentA: 'Good rhythm', commentB: 'Lacks flow', exampleA: 'excerpt A', exampleB: 'excerpt B' },
        { axis: 'novelty', commentA: 'Fresh', commentB: 'Predictable' },
      ],
    });
    const result = parseJudgeResponse(response);

    expect(result.axis_comments).toBeDefined();
    expect(result.axis_comments).toHaveLength(2);
    expect(result.axis_comments![0].axis).toBe('style');
    expect(result.axis_comments![0].commentA).toBe('Good rhythm');
    expect(result.axis_comments![0].exampleA).toBe('excerpt A');
    expect(result.axis_comments![1].exampleA).toBeUndefined();
  });

  it('should parse section_analysis when present', () => {
    const response = makeToolResponse({
      ...baseArgs,
      section_analysis: [
        { section: 'introduction', ratingA: 'excellent', ratingB: 'good', commentA: 'Strong', commentB: 'Decent' },
        { section: 'climax', ratingA: 'adequate', ratingB: 'excellent', commentA: 'Flat', commentB: 'Gripping' },
      ],
    });
    const result = parseJudgeResponse(response);

    expect(result.section_analysis).toBeDefined();
    expect(result.section_analysis).toHaveLength(2);
    expect(result.section_analysis![0].section).toBe('introduction');
    expect(result.section_analysis![0].ratingA).toBe('excellent');
    expect(result.section_analysis![1].commentB).toBe('Gripping');
  });

  it('should return undefined for enhanced fields when not present', () => {
    const response = makeToolResponse(baseArgs);
    const result = parseJudgeResponse(response);

    expect(result.weaknesses).toBeUndefined();
    expect(result.axis_comments).toBeUndefined();
    expect(result.section_analysis).toBeUndefined();
  });

  it('should ignore weaknesses when data is not an object', () => {
    const response = makeToolResponse({
      ...baseArgs,
      weaknesses: 'not-an-object',
    });
    const result = parseJudgeResponse(response);

    expect(result.weaknesses).toBeUndefined();
  });

  it('should ignore axis_comments when data is not an array', () => {
    const response = makeToolResponse({
      ...baseArgs,
      axis_comments: 'not-an-array',
    });
    const result = parseJudgeResponse(response);

    expect(result.axis_comments).toBeUndefined();
  });

  it('should ignore section_analysis when data is not an array', () => {
    const response = makeToolResponse({
      ...baseArgs,
      section_analysis: { not: 'an array' },
    });
    const result = parseJudgeResponse(response);

    expect(result.section_analysis).toBeUndefined();
  });

  it('should ignore weaknesses when A or B is not an array', () => {
    const response = makeToolResponse({
      ...baseArgs,
      weaknesses: { A: 'not-array', B: [{ category: 'style', description: 'd', suggestedFix: 's', severity: 'minor' }] },
    });
    const result = parseJudgeResponse(response);

    expect(result.weaknesses).toBeUndefined();
  });

  it('should parse all three enhanced fields together', () => {
    const response = makeToolResponse({
      ...baseArgs,
      weaknesses: {
        A: [{ category: 'imagery', description: 'Cliche', suggestedFix: 'Use fresh imagery', severity: 'minor' }],
        B: [],
      },
      axis_comments: [
        { axis: 'compliance', commentA: 'No violations', commentB: 'Minor issues' },
      ],
      section_analysis: [
        { section: 'ending', ratingA: 'good', ratingB: 'weak', commentA: 'Satisfying', commentB: 'Rushed' },
      ],
    });
    const result = parseJudgeResponse(response);

    expect(result.weaknesses).toBeDefined();
    expect(result.axis_comments).toBeDefined();
    expect(result.section_analysis).toBeDefined();
    expect(result.weaknesses!.A[0].category).toBe('imagery');
    expect(result.weaknesses!.B).toHaveLength(0);
    expect(result.axis_comments![0].axis).toBe('compliance');
    expect(result.section_analysis![0].section).toBe('ending');
  });
});
