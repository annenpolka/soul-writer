import { describe, it, expect } from 'vitest';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { JudgeRawResponse } from '../../../src/schemas/judge-response.js';
import { parseJudgeResponse } from '../../../src/agents/parsers/judge-parser.js';

function makeStructuredResponse(data: JudgeRawResponse): StructuredResponse<JudgeRawResponse> {
  return {
    data,
    reasoning: null,
    tokensUsed: 50,
  };
}

const baseData: JudgeRawResponse = {
  winner: 'A',
  reasoning: 'A is better',
  scores: {
    A: { style: 0.8, compliance: 0.9, overall: 0.85, voice_accuracy: 0.8, originality: 0.7, structure: 0.8, amplitude: 0.7, agency: 0.6, stakes: 0.7 },
    B: { style: 0.6, compliance: 0.7, overall: 0.65, voice_accuracy: 0.6, originality: 0.5, structure: 0.6, amplitude: 0.5, agency: 0.4, stakes: 0.5 },
  },
  praised_excerpts: { A: ['excerpt'], B: ['excerpt'] },
};

describe('parseJudgeResponse - enhanced fields', () => {
  it('should parse weaknesses when present', () => {
    const response = makeStructuredResponse({
      ...baseData,
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
    const response = makeStructuredResponse({
      ...baseData,
      axis_comments: [
        { axis: 'style', commentA: 'Good rhythm', commentB: 'Lacks flow', exampleA: 'excerpt A', exampleB: 'excerpt B' },
        { axis: 'originality', commentA: 'Fresh', commentB: 'Predictable' },
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
    const response = makeStructuredResponse({
      ...baseData,
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
    const response = makeStructuredResponse(baseData);
    const result = parseJudgeResponse(response);

    expect(result.weaknesses).toBeUndefined();
    expect(result.axis_comments).toBeUndefined();
    expect(result.section_analysis).toBeUndefined();
  });

  it('should parse all three enhanced fields together', () => {
    const response = makeStructuredResponse({
      ...baseData,
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
