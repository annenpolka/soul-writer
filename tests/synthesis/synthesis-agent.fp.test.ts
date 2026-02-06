import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSynthesisAgent } from '../../src/synthesis/synthesis-agent.js';
import type { SynthesisDeps, GenerationResult } from '../../src/agents/types.js';
import type { MatchResult } from '../../src/tournament/arena.js';
import { createMockLLMClient, createMockThemeContext } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import { resolveNarrativeRules } from '../../src/factory/narrative-rules.js';

function createMockSynthesisDeps(overrides?: {
  response?: string;
  tokenCount?: number;
  themeContext?: import('../../src/agents/types.js').ThemeContext;
}): SynthesisDeps {
  return {
    llmClient: createMockLLMClient(overrides?.response ?? 'synthesized text', overrides?.tokenCount),
    soulText: createMockSoulText(),
    narrativeRules: resolveNarrativeRules(),
    themeContext: overrides?.themeContext,
  };
}

function createMockGenerations(): GenerationResult[] {
  return [
    { writerId: 'writer_1', text: 'Champion text here', tokensUsed: 100 },
    { writerId: 'writer_2', text: 'Loser text A', tokensUsed: 80 },
    { writerId: 'writer_3', text: 'Loser text B', tokensUsed: 90 },
  ];
}

function createMockRounds(): MatchResult[] {
  return [
    {
      matchName: 'match1',
      contestantA: 'writer_1',
      contestantB: 'writer_2',
      winner: 'writer_1',
      judgeResult: {
        winner: 'A',
        reasoning: 'Better style',
        scores: {
          A: { style: 0.9, compliance: 0.8, overall: 0.85 },
          B: { style: 0.7, compliance: 0.8, overall: 0.75 },
        },
        praised_excerpts: {
          A: ['beautiful opening'],
          B: ['vivid imagery in the middle'],
        },
      },
    },
    {
      matchName: 'match2',
      contestantA: 'writer_1',
      contestantB: 'writer_3',
      winner: 'writer_1',
      judgeResult: {
        winner: 'A',
        reasoning: 'Stronger character voice',
        scores: {
          A: { style: 0.9, compliance: 0.85, overall: 0.87 },
          B: { style: 0.75, compliance: 0.8, overall: 0.78 },
        },
        praised_excerpts: {
          A: ['compelling dialogue'],
          B: ['atmospheric description'],
        },
      },
    },
  ];
}

describe('createSynthesisAgent (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a Synthesizer with synthesize method', () => {
    const deps = createMockSynthesisDeps();
    const synthesizer = createSynthesisAgent(deps);
    expect(synthesizer.synthesize).toBeInstanceOf(Function);
  });

  it('should call llmClient.complete when loser excerpts exist', async () => {
    const deps = createMockSynthesisDeps();
    const synthesizer = createSynthesisAgent(deps);

    await synthesizer.synthesize('Champion text', 'writer_1', createMockGenerations(), createMockRounds());
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('should return synthesized text from LLM', async () => {
    const deps = createMockSynthesisDeps({ response: 'merged output' });
    const synthesizer = createSynthesisAgent(deps);

    const result = await synthesizer.synthesize('Champion text', 'writer_1', createMockGenerations(), createMockRounds());
    expect(result.synthesizedText).toBe('merged output');
  });

  it('should skip synthesis when no loser excerpts found', async () => {
    const deps = createMockSynthesisDeps();
    const synthesizer = createSynthesisAgent(deps);

    const generations = [{ writerId: 'writer_1', text: 'Only one', tokensUsed: 50 }];
    const rounds: MatchResult[] = [];

    const result = await synthesizer.synthesize('Champion text', 'writer_1', generations, rounds);
    expect(result.synthesizedText).toBe('Champion text');
    expect(result.tokensUsed).toBe(0);
    expect(deps.llmClient.complete).not.toHaveBeenCalled();
  });

  it('should return token usage', async () => {
    const deps = createMockSynthesisDeps({ tokenCount: 500 });
    const synthesizer = createSynthesisAgent(deps);

    const result = await synthesizer.synthesize('Champion text', 'writer_1', createMockGenerations(), createMockRounds());
    expect(result.tokensUsed).toBeDefined();
  });

  it('should handle themeContext in deps', async () => {
    const themeContext = createMockThemeContext({ emotion: '渇望' });
    const deps = createMockSynthesisDeps({ themeContext });
    const synthesizer = createSynthesisAgent(deps);

    const result = await synthesizer.synthesize('Champion text', 'writer_1', createMockGenerations(), createMockRounds());
    expect(result.synthesizedText).toBeDefined();
    expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
  });
});
