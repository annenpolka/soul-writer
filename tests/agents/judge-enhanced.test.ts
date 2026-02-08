import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJudge, SUBMIT_JUDGEMENT_TOOL } from '../../src/agents/judge.js';
import type { JudgeDeps } from '../../src/agents/types.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockJudgeDeps(overrides?: {
  toolResponse?: { name: string; arguments: Record<string, unknown> };
}): JudgeDeps {
  const defaultToolResponse = {
    name: 'submit_judgement',
    arguments: {
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
    },
  };

  return {
    llmClient: createMockLLMClientWithTools(overrides?.toolResponse ?? defaultToolResponse),
    soulText: createMockSoulText(),
  };
}

describe('SUBMIT_JUDGEMENT_TOOL schema', () => {
  it('should be exported', () => {
    expect(SUBMIT_JUDGEMENT_TOOL).toBeDefined();
    expect(SUBMIT_JUDGEMENT_TOOL.function.name).toBe('submit_judgement');
  });

  it('should have weaknesses property in schema', () => {
    const props = SUBMIT_JUDGEMENT_TOOL.function.parameters.properties as Record<string, unknown>;
    expect(props.weaknesses).toBeDefined();
  });

  it('should have axis_comments property in schema', () => {
    const props = SUBMIT_JUDGEMENT_TOOL.function.parameters.properties as Record<string, unknown>;
    expect(props.axis_comments).toBeDefined();
  });

  it('should have section_analysis property in schema', () => {
    const props = SUBMIT_JUDGEMENT_TOOL.function.parameters.properties as Record<string, unknown>;
    expect(props.section_analysis).toBeDefined();
  });

  it('should keep weaknesses, axis_comments, section_analysis out of required', () => {
    const required = SUBMIT_JUDGEMENT_TOOL.function.parameters.required as string[];
    expect(required).not.toContain('weaknesses');
    expect(required).not.toContain('axis_comments');
    expect(required).not.toContain('section_analysis');
  });
});

describe('createJudge evaluate() with enhanced fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return weaknesses from tool response', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');

    expect(result.weaknesses).toBeDefined();
    expect(result.weaknesses!.A).toHaveLength(1);
    expect(result.weaknesses!.A[0].category).toBe('pacing');
    expect(result.weaknesses!.B[0].severity).toBe('major');
  });

  it('should return axis_comments from tool response', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');

    expect(result.axis_comments).toBeDefined();
    expect(result.axis_comments).toHaveLength(1);
    expect(result.axis_comments![0].axis).toBe('style');
    expect(result.axis_comments![0].exampleA).toBe('ex-A');
  });

  it('should return section_analysis from tool response', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');

    expect(result.section_analysis).toBeDefined();
    expect(result.section_analysis).toHaveLength(1);
    expect(result.section_analysis![0].ratingA).toBe('excellent');
  });

  it('should work without enhanced fields (backward compatible)', async () => {
    const deps = createMockJudgeDeps({
      toolResponse: {
        name: 'submit_judgement',
        arguments: {
          winner: 'B',
          reasoning: 'B wins',
          scores: {
            A: { style: 0.5, compliance: 0.5, overall: 0.5, voice_accuracy: 0.5, originality: 0.5, structure: 0.5, amplitude: 0.5, agency: 0.5, stakes: 0.5 },
            B: { style: 0.8, compliance: 0.8, overall: 0.8, voice_accuracy: 0.8, originality: 0.8, structure: 0.8, amplitude: 0.8, agency: 0.8, stakes: 0.8 },
          },
          praised_excerpts: { A: [], B: [] },
        },
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
