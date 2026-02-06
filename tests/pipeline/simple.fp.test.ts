import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../src/pipeline/types.js';
import type { ComplianceResult } from '../../src/agents/types.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

// Helper to create a minimal PipelineContext for testing
function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    text: '',
    prompt: 'test prompt',
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps: {
      llmClient: { complete: vi.fn(), getTotalTokens: vi.fn().mockReturnValue(0) },
      soulText: createMockSoulText(),
      narrativeRules: {
        pov: 'first-person',
        pronoun: 'わたし',
        protagonistName: null,
        povDescription: 'テスト',
        isDefaultProtagonist: true,
      },
    } as PipelineDeps,
    ...overrides,
  };
}

describe('createSimplePipeline', () => {
  it('should be importable', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    expect(createSimplePipeline).toBeDefined();
    expect(typeof createSimplePipeline).toBe('function');
  });

  it('should return a PipelineStage function', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    const stage = createSimplePipeline({});
    expect(typeof stage).toBe('function');
  });

  it('should return a function for simple mode', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    const stage = createSimplePipeline({ simple: true });
    expect(typeof stage).toBe('function');
  });

  it('should return a function for collaboration mode', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    const stage = createSimplePipeline({ mode: 'collaboration' });
    expect(typeof stage).toBe('function');
  });

  it('should return a function for collaboration simple mode', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    const stage = createSimplePipeline({ mode: 'collaboration', simple: true });
    expect(typeof stage).toBe('function');
  });

  it('should accept maxCorrectionAttempts config', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    const stage = createSimplePipeline({ maxCorrectionAttempts: 5 });
    expect(typeof stage).toBe('function');
  });

  it('should accept writerConfigs', async () => {
    const { createSimplePipeline } = await import('../../src/pipeline/simple.js');
    const stage = createSimplePipeline({
      writerConfigs: [
        { id: 'writer-1', temperature: 0.7, topP: 0.9, style: 'balanced' },
        { id: 'writer-2', temperature: 0.8, topP: 0.95, style: 'creative' },
      ],
    });
    expect(typeof stage).toBe('function');
  });
});

describe('createJudgeRetakeStage', () => {
  it('should be importable', async () => {
    const { createJudgeRetakeStage } = await import('../../src/pipeline/stages/judge-retake.js');
    expect(createJudgeRetakeStage).toBeDefined();
    expect(typeof createJudgeRetakeStage).toBe('function');
  });

  it('should return a PipelineStage function', async () => {
    const { createJudgeRetakeStage } = await import('../../src/pipeline/stages/judge-retake.js');
    const stage = createJudgeRetakeStage();
    expect(typeof stage).toBe('function');
  });

  it('should not retake when quality is above threshold', async () => {
    const { createJudgeRetakeStage } = await import('../../src/pipeline/stages/judge-retake.js');
    const stage = createJudgeRetakeStage();

    // Mock LLM client that returns high scores (above threshold)
    const mockLLM = {
      complete: vi.fn().mockResolvedValue('リテイクされた文章です。'),
      completeWithTools: vi.fn().mockResolvedValue({
        toolCalls: [{
          id: 'tc-1',
          type: 'function',
          function: {
            name: 'submit_judgement',
            arguments: JSON.stringify({
              winner: 'A',
              reasoning: 'テスト',
              scores: {
                A: { style: 0.9, compliance: 0.9, overall: 0.9, voice_accuracy: 0.9 },
                B: { style: 0.8, compliance: 0.8, overall: 0.8, voice_accuracy: 0.8 },
              },
              praised_excerpts: { A: [], B: [] },
            }),
          },
        }],
        content: null,
        tokensUsed: 50,
      }),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };

    const ctx = makeContext({
      text: 'テスト文章',
      deps: {
        ...makeContext().deps,
        llmClient: mockLLM,
      },
    });

    const result = await stage(ctx);
    // Score 0.9 >= threshold 0.7, so no retake happens
    expect(result.text).toBe('テスト文章');
  });
});

describe('createAntiSoulCollectionStage', () => {
  it('should be importable', async () => {
    const { createAntiSoulCollectionStage } = await import('../../src/pipeline/stages/anti-soul-collection.js');
    expect(createAntiSoulCollectionStage).toBeDefined();
  });

  it('should pass through when no correction was attempted', async () => {
    const { createAntiSoulCollectionStage } = await import('../../src/pipeline/stages/anti-soul-collection.js');
    const stage = createAntiSoulCollectionStage();

    const ctx = makeContext({ text: 'テスト文章', correctionAttempts: 0 });
    const result = await stage(ctx);
    expect(result.text).toBe('テスト文章');
  });

  it('should pass through when compliance result is compliant', async () => {
    const { createAntiSoulCollectionStage } = await import('../../src/pipeline/stages/anti-soul-collection.js');
    const stage = createAntiSoulCollectionStage();

    const complianceResult: ComplianceResult = {
      isCompliant: true,
      score: 1.0,
      violations: [],
    };
    const ctx = makeContext({
      text: 'テスト文章',
      correctionAttempts: 3,
      complianceResult,
    });
    const result = await stage(ctx);
    expect(result.text).toBe('テスト文章');
  });

  it('should pass through when no compliance result exists', async () => {
    const { createAntiSoulCollectionStage } = await import('../../src/pipeline/stages/anti-soul-collection.js');
    const stage = createAntiSoulCollectionStage();

    const ctx = makeContext({
      text: 'テスト文章',
      correctionAttempts: 3,
    });
    const result = await stage(ctx);
    expect(result.text).toBe('テスト文章');
  });

  it('should collect anti-patterns when correction failed', async () => {
    const { createAntiSoulCollectionStage } = await import('../../src/pipeline/stages/anti-soul-collection.js');
    const stage = createAntiSoulCollectionStage();

    const complianceResult: ComplianceResult = {
      isCompliant: false,
      score: 0.3,
      violations: [
        { type: 'forbidden_word', rule: '禁止語彙', context: 'テスト違反', severity: 'error' },
      ],
    };
    const ctx = makeContext({
      text: 'テスト文章',
      correctionAttempts: 3,
      complianceResult,
    });
    // Should not throw; just collects
    const result = await stage(ctx);
    expect(result.text).toBe('テスト文章');
  });
});

describe('createReaderJuryRetakeLoopStage', () => {
  it('should be importable', async () => {
    const { createReaderJuryRetakeLoopStage } = await import('../../src/pipeline/stages/reader-jury-retake-loop.js');
    expect(createReaderJuryRetakeLoopStage).toBeDefined();
  });

  it('should return a PipelineStage function', async () => {
    const { createReaderJuryRetakeLoopStage } = await import('../../src/pipeline/stages/reader-jury-retake-loop.js');
    const stage = createReaderJuryRetakeLoopStage();
    expect(typeof stage).toBe('function');
  });

  it('should accept custom maxRetakes parameter', async () => {
    const { createReaderJuryRetakeLoopStage } = await import('../../src/pipeline/stages/reader-jury-retake-loop.js');
    const stage = createReaderJuryRetakeLoopStage(5);
    expect(typeof stage).toBe('function');
  });
});

describe('createCollaborationStage', () => {
  it('should be importable', async () => {
    const { createCollaborationStage } = await import('../../src/pipeline/stages/collaboration.js');
    expect(createCollaborationStage).toBeDefined();
  });

  it('should return a PipelineStage function', async () => {
    const { createCollaborationStage } = await import('../../src/pipeline/stages/collaboration.js');
    const stage = createCollaborationStage({});
    expect(typeof stage).toBe('function');
  });

  it('should accept writerConfigs and collaborationConfig', async () => {
    const { createCollaborationStage } = await import('../../src/pipeline/stages/collaboration.js');
    const stage = createCollaborationStage({
      writerConfigs: [
        { id: 'collab-1', temperature: 0.7, topP: 0.9, style: 'balanced' },
      ],
      collaborationConfig: { rounds: 3 },
    });
    expect(typeof stage).toBe('function');
  });
});

describe('generateSimple', () => {
  it('should export generateSimple function', async () => {
    const { generateSimple } = await import('../../src/pipeline/simple.js');
    expect(generateSimple).toBeDefined();
    expect(typeof generateSimple).toBe('function');
  });

  it('should export both createSimplePipeline and generateSimple', async () => {
    const mod = await import('../../src/pipeline/simple.js');
    expect(mod.generateSimple).toBeDefined();
    expect(mod.createSimplePipeline).toBeDefined();
  });
});
