import { describe, it, expect } from 'vitest';
import type { ToolCallResponse } from '../../../src/llm/types.js';
import { parseDefectDetectorResponse } from '../../../src/agents/parsers/defect-detector-parser.js';

function makeToolResponse(args: Record<string, unknown>): ToolCallResponse {
  return {
    toolCalls: [{
      id: 'tc-1',
      type: 'function',
      function: {
        name: 'submit_defects',
        arguments: JSON.stringify(args),
      },
    }],
    content: null,
    tokensUsed: 50,
  };
}

describe('parseDefectDetectorResponse', () => {
  it('should parse valid defects from tool response', () => {
    const response = makeToolResponse({
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
  });

  it('should handle empty defects array', () => {
    const response = makeToolResponse({ defects: [] });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toEqual([]);
    expect(result.criticalCount).toBe(0);
    expect(result.majorCount).toBe(0);
    expect(result.minorCount).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe('欠陥なし');
  });

  it('should count critical, major, minor defects correctly', () => {
    const response = makeToolResponse({
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

  it('should set passed=false when critical defects exist', () => {
    const response = makeToolResponse({
      defects: [
        { severity: 'critical', category: 'plot', description: 'Plot hole' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.passed).toBe(false);
  });

  it('should set passed=true when only minor defects exist', () => {
    const response = makeToolResponse({
      defects: [
        { severity: 'minor', category: 'style', description: 'Slight issue' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.passed).toBe(true);
  });

  it('should set passed=true when only major defects exist (within default threshold)', () => {
    const response = makeToolResponse({
      defects: [
        { severity: 'major', category: 'pacing', description: 'Pacing issue' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.passed).toBe(true);
  });

  it('should include optional location field', () => {
    const response = makeToolResponse({
      defects: [
        { severity: 'major', category: 'pacing', description: 'Slow', location: 'paragraph 5' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects[0].location).toBe('paragraph 5');
  });

  it('should filter out defects with invalid severity', () => {
    const response = makeToolResponse({
      defects: [
        { severity: 'critical', category: 'plot', description: 'Valid' },
        { severity: 'unknown', category: 'bad', description: 'Invalid severity' },
        { severity: 'major', category: 'pacing', description: 'Also valid' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toHaveLength(2);
    expect(result.criticalCount).toBe(1);
    expect(result.majorCount).toBe(1);
  });

  it('should generate feedback summarizing defect descriptions', () => {
    const response = makeToolResponse({
      defects: [
        { severity: 'critical', category: 'plot', description: 'Plot hole found' },
        { severity: 'major', category: 'pacing', description: 'Slow pacing' },
      ],
    });
    const result = parseDefectDetectorResponse(response);

    expect(result.feedback).toContain('Plot hole found');
    expect(result.feedback).toContain('Slow pacing');
  });

  it('should return fallback result when tool call is missing', () => {
    const response: ToolCallResponse = {
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: {
          name: 'wrong_tool',
          arguments: '{}',
        },
      }],
      content: null,
      tokensUsed: 50,
    };
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.feedback).toContain('パース失敗');
  });

  it('should return fallback result when arguments JSON is invalid', () => {
    const response: ToolCallResponse = {
      toolCalls: [{
        id: 'tc-1',
        type: 'function',
        function: {
          name: 'submit_defects',
          arguments: 'not-json',
        },
      }],
      content: null,
      tokensUsed: 50,
    };
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.feedback).toContain('パース失敗');
  });

  it('should handle defects without defects array gracefully', () => {
    const response = makeToolResponse({});
    const result = parseDefectDetectorResponse(response);

    expect(result.defects).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
