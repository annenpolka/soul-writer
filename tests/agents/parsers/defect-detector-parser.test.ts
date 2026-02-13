import { describe, it, expect } from 'vitest';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { DefectDetectorRawResponse } from '../../../src/schemas/defect-detector-response.js';
import { parseDefectDetectorResponse, createFallbackResult } from '../../../src/agents/parsers/defect-detector-parser.js';

function makeStructuredResponse(data: DefectDetectorRawResponse): StructuredResponse<DefectDetectorRawResponse> {
  return {
    data,
    reasoning: null,
    tokensUsed: 50,
  };
}

describe('parseDefectDetectorResponse', () => {
  it('should parse valid defects and verdictLevel from structured response', () => {
    const response = makeStructuredResponse({
      verdict_level: 'needs_work',
      defects: [
        { severity: 'critical', category: 'plot_contradiction', description: 'Plot hole in chapter 2' },
        { severity: 'major', category: 'pacing_issue', description: 'Too slow in middle section' },
        { severity: 'minor', category: 'style_deviation', description: 'Slight rhythm break' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toHaveLength(3);
    expect(result.defects[0].severity).toBe('critical');
    expect(result.defects[0].category).toBe('plot_contradiction');
    expect(result.defects[0].description).toBe('Plot hole in chapter 2');
    expect(result.verdictLevel).toBe('needs_work');
  });

  it('should handle empty defects array with publishable verdict', () => {
    const response = makeStructuredResponse({ verdict_level: 'publishable', defects: [] });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toEqual([]);
    expect(result.criticalCount).toBe(0);
    expect(result.majorCount).toBe(0);
    expect(result.minorCount).toBe(0);
    expect(result.verdictLevel).toBe('publishable');
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe('欠陥なし');
  });

  it('should count critical, major, minor defects correctly', () => {
    const response = makeStructuredResponse({
      verdict_level: 'unacceptable',
      defects: [
        { severity: 'critical', category: 'plot', description: 'c1' },
        { severity: 'critical', category: 'character', description: 'c2' },
        { severity: 'major', category: 'pacing', description: 'm1' },
        { severity: 'major', category: 'motif', description: 'm2' },
        { severity: 'major', category: 'style', description: 'm3' },
        { severity: 'minor', category: 'style', description: 'n1' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.criticalCount).toBe(2);
    expect(result.majorCount).toBe(3);
    expect(result.minorCount).toBe(1);
  });

  it('should set passed=false when critical defects exist even with publishable verdict', () => {
    const response = makeStructuredResponse({
      verdict_level: 'publishable',
      defects: [
        { severity: 'critical', category: 'plot', description: 'Plot hole' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.passed).toBe(false);
  });

  it('should set passed=true when only minor defects exist and verdict is publishable', () => {
    const response = makeStructuredResponse({
      verdict_level: 'publishable',
      defects: [
        { severity: 'minor', category: 'style', description: 'Slight issue' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.passed).toBe(true);
    expect(result.verdictLevel).toBe('publishable');
  });

  it('should set passed=false when only major defects exist but verdict is acceptable', () => {
    const response = makeStructuredResponse({
      verdict_level: 'acceptable',
      defects: [
        { severity: 'major', category: 'pacing', description: 'Pacing issue' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.passed).toBe(false);
    expect(result.verdictLevel).toBe('acceptable');
  });

  it('should include optional location field', () => {
    const response = makeStructuredResponse({
      verdict_level: 'acceptable',
      defects: [
        { severity: 'major', category: 'pacing', description: 'Slow', location: 'paragraph 5' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects[0].location).toBe('paragraph 5');
  });

  it('should include optional quoted_text and suggested_fix fields', () => {
    const response = makeStructuredResponse({
      verdict_level: 'needs_work',
      defects: [
        {
          severity: 'major',
          category: 'style',
          description: 'Cliche expression',
          quoted_text: '心臓がバクバクした',
          suggested_fix: 'より具体的な身体感覚に置き換える',
        },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects[0].quotedText).toBe('心臓がバクバクした');
    expect(result.defects[0].suggestedFix).toBe('より具体的な身体感覚に置き換える');
  });

  it('should capture LLM reasoning from response', () => {
    const response: StructuredResponse<DefectDetectorRawResponse> = {
      data: { verdict_level: 'publishable', defects: [] },
      reasoning: 'DefectDetector推論: テキストの品質は高い',
      tokensUsed: 50,
    };
    const result = parseDefectDetectorResponse(response);

    expect(result.llmReasoning).toBe('DefectDetector推論: テキストの品質は高い');
  });

  it('should set llmReasoning to null when response.reasoning is null', () => {
    const response = makeStructuredResponse({ verdict_level: 'publishable', defects: [] });
    const result = parseDefectDetectorResponse(response);

    expect(result.llmReasoning).toBeNull();
  });

  it('should generate feedback summarizing defect descriptions', () => {
    const response = makeStructuredResponse({
      verdict_level: 'needs_work',
      defects: [
        { severity: 'critical', category: 'plot', description: 'Plot hole found' },
        { severity: 'major', category: 'pacing', description: 'Slow pacing' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.feedback).toContain('Plot hole found');
    expect(result.feedback).toContain('Slow pacing');
  });

  describe('createFallbackResult', () => {
    it('should return a safe fallback result', () => {
      const result = createFallbackResult();

      expect(result.defects).toEqual([]);
      expect(result.passed).toBe(false);
      expect(result.verdictLevel).toBe('needs_work');
      expect(result.feedback).toContain('パース失敗');
    });
  });
});
