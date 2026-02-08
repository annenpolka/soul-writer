import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { TournamentResult } from '../../../src/tournament/arena.js';
import type { SynthesisV2Result, ImprovementPlan } from '../../../src/agents/types.js';
import type { LoggerFn } from '../../../src/logger.js';

function createMockLogger(): LoggerFn {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    section: vi.fn(),
    close: vi.fn(),
  };
}

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('text'),
      getTotalTokens: vi.fn().mockReturnValue(0),
    } as unknown as PipelineDeps['llmClient'],
    soulText: {} as PipelineDeps['soulText'],
    narrativeRules: {} as PipelineDeps['narrativeRules'],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    text: '',
    prompt: 'test prompt',
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps: makeDeps(),
    ...overrides,
  };
}

const mockTournamentResult: TournamentResult = {
  champion: 'writer_1',
  championText: 'champion text',
  rounds: [],
  allGenerations: [
    { writerId: 'writer_1', text: 'champion text', tokensUsed: 100 },
    { writerId: 'writer_2', text: 'loser text', tokensUsed: 80 },
  ],
  totalTokensUsed: 500,
};

const mockPlan: ImprovementPlan = {
  championAssessment: 'Good base text with strong opening',
  preserveElements: ['opening imagery', 'character voice'],
  actions: [
    {
      section: 'opening',
      type: 'expression_upgrade',
      description: 'Improve opening imagery',
      source: 'writer_2',
      priority: 'high',
    },
    {
      section: 'climax',
      type: 'tension_enhancement',
      description: 'Add tension to climax',
      source: 'writer_3',
      priority: 'medium',
    },
  ],
  structuralChanges: ['Reorder mid-section'],
  expressionSources: [
    { writerId: 'writer_2', expressions: ['expr1', 'expr2'], context: 'dialogue' },
    { writerId: 'writer_3', expressions: ['expr3'], context: 'narration' },
  ],
};

describe('createSynthesisV2Stage - verbose logging', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('should log ImprovementPlan details when logger is available and plan exists', async () => {
    const mockResult: SynthesisV2Result = {
      synthesizedText: 'synthesized text here',
      plan: mockPlan,
      totalTokensUsed: 300,
    };

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue(mockResult),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const logger = createMockLogger();
    const deps = makeDeps({ logger });
    const stage = createSynthesisV2Stage();
    await stage(makeContext({
      text: 'champion text original',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      deps,
    }));

    expect(logger.section).toHaveBeenCalledWith('Synthesis V2 Analysis');
    expect(logger.debug).toHaveBeenCalledWith('Champion assessment', 'Good base text with strong opening');
    expect(logger.debug).toHaveBeenCalledWith('Preserve elements', ['opening imagery', 'character voice']);
    expect(logger.debug).toHaveBeenCalledWith('Actions', expect.arrayContaining([
      expect.stringContaining('[high] expression_upgrade'),
      expect.stringContaining('[medium] tension_enhancement'),
    ]));
    expect(logger.debug).toHaveBeenCalledWith('Structural changes', ['Reorder mid-section']);
    expect(logger.debug).toHaveBeenCalledWith('Expression sources', expect.arrayContaining([
      'writer_2: 2 expressions',
      'writer_3: 1 expressions',
    ]));
    expect(logger.debug).toHaveBeenCalledWith('Text change', expect.stringMatching(/[+-]?\d+ chars \(-?\d+\.\d+%\)/));
  });

  it('should not log when logger is not available', async () => {
    const mockResult: SynthesisV2Result = {
      synthesizedText: 'synthesized text',
      plan: mockPlan,
      totalTokensUsed: 100,
    };

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue(mockResult),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const stage = createSynthesisV2Stage();
    // No logger in deps — should not throw
    const result = await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
    }));

    expect(result.synthesized).toBe(true);
  });

  it('should not log when plan is null', async () => {
    const mockResult: SynthesisV2Result = {
      synthesizedText: 'synthesized text',
      plan: null,
      totalTokensUsed: 100,
    };

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue(mockResult),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const logger = createMockLogger();
    const deps = makeDeps({ logger });
    const stage = createSynthesisV2Stage();
    await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      deps,
    }));

    expect(logger.section).not.toHaveBeenCalled();
  });

  it('should skip structural changes log when none exist', async () => {
    const planNoStructural: ImprovementPlan = {
      ...mockPlan,
      structuralChanges: undefined,
    };
    const mockResult: SynthesisV2Result = {
      synthesizedText: 'synthesized text',
      plan: planNoStructural,
      totalTokensUsed: 100,
    };

    vi.doMock('../../../src/synthesis/synthesis-v2.js', () => ({
      createSynthesisV2: () => ({
        synthesize: vi.fn().mockResolvedValue(mockResult),
      }),
    }));

    const { createSynthesisV2Stage } = await import(
      '../../../src/pipeline/stages/synthesis-v2.js'
    );

    const logger = createMockLogger();
    const deps = makeDeps({ logger });
    const stage = createSynthesisV2Stage();
    await stage(makeContext({
      text: 'champion text',
      champion: 'writer_1',
      tournamentResult: mockTournamentResult,
      deps,
    }));

    const debugCalls = (logger.debug as ReturnType<typeof vi.fn>).mock.calls;
    const structuralCall = debugCalls.find(c => c[0] === 'Structural changes');
    expect(structuralCall).toBeUndefined();
  });
});
