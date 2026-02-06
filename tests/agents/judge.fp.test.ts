import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJudge } from '../../src/agents/judge.js';
import type { JudgeDeps } from '../../src/agents/types.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockJudgeDeps(overrides?: {
  toolResponse?: { name: string; arguments: Record<string, unknown> };
  tokenCount?: number;
}): JudgeDeps {
  const defaultToolResponse = {
    name: 'submit_judgement',
    arguments: {
      winner: 'A',
      reasoning: 'Text A has better style',
      scores: {
        A: { style: 0.8, compliance: 0.9, overall: 0.85, voice_accuracy: 0.8, originality_fidelity: 0.7, narrative_quality: 0.8, novelty: 0.7 },
        B: { style: 0.6, compliance: 0.7, overall: 0.65, voice_accuracy: 0.6, originality_fidelity: 0.5, narrative_quality: 0.6, novelty: 0.5 },
      },
      praised_excerpts: {
        A: ['excerpt 1'],
        B: ['excerpt 2'],
      },
    },
  };

  return {
    llmClient: createMockLLMClientWithTools(
      overrides?.toolResponse ?? defaultToolResponse,
      overrides?.tokenCount ?? 100,
    ),
    soulText: createMockSoulText(),
  };
}

describe('createJudge (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Judge with evaluate method', () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    expect(judge.evaluate).toBeInstanceOf(Function);
  });

  it('evaluate() should call completeWithTools', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    await judge.evaluate('Text A content', 'Text B content');
    expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
  });

  it('evaluate() should return JudgeResult with winner', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');
    expect(result.winner).toBe('A');
    expect(result.reasoning).toBe('Text A has better style');
    expect(result.scores.A.style).toBe(0.8);
    expect(result.scores.B.style).toBe(0.6);
  });

  it('evaluate() should return winner B when tool response says B', async () => {
    const deps = createMockJudgeDeps({
      toolResponse: {
        name: 'submit_judgement',
        arguments: {
          winner: 'B',
          reasoning: 'Text B is superior',
          scores: {
            A: { style: 0.5, compliance: 0.5, overall: 0.5 },
            B: { style: 0.9, compliance: 0.9, overall: 0.9 },
          },
        },
      },
    });
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');
    expect(result.winner).toBe('B');
  });

  it('evaluate() should return praised_excerpts', async () => {
    const deps = createMockJudgeDeps();
    const judge = createJudge(deps);
    const result = await judge.evaluate('Text A', 'Text B');
    expect(result.praised_excerpts?.A).toEqual(['excerpt 1']);
    expect(result.praised_excerpts?.B).toEqual(['excerpt 2']);
  });

  it('evaluate() should clamp scores to [0.05, 0.95]', async () => {
    const deps = createMockJudgeDeps({
      toolResponse: {
        name: 'submit_judgement',
        arguments: {
          winner: 'A',
          reasoning: 'test',
          scores: {
            A: { style: 1.0, compliance: 0.0, overall: 0.5 },
            B: { style: 0.5, compliance: 0.5, overall: 0.5 },
          },
        },
      },
    });
    const judge = createJudge(deps);
    const result = await judge.evaluate('A', 'B');
    expect(result.scores.A.style).toBe(0.95);
    expect(result.scores.A.compliance).toBe(0.05);
  });
});
