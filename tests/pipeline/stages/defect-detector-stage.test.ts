import { describe, it, expect, vi } from 'vitest';
import type { PipelineContext, PipelineDeps } from '../../../src/pipeline/types.js';
import type { DefectDetectorResult } from '../../../src/agents/types.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    llmClient: {
      complete: vi.fn().mockResolvedValue('retaken text'),
      completeStructured: vi.fn().mockResolvedValue({
        data: { verdict_level: 'publishable', defects: [] },
        reasoning: null,
        tokensUsed: 50,
      }),
      getTotalTokens: vi.fn().mockReturnValue(100),
    } as unknown as PipelineDeps['llmClient'],
    soulText: createMockSoulText(),
    narrativeRules: {
      pov: 'first-person',
      pronoun: 'わたし',
      protagonistName: null,
      povDescription: 'テスト',
      isDefaultProtagonist: true,
    } as PipelineDeps['narrativeRules'],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    text: 'テスト文章です。',
    prompt: 'test prompt',
    tokensUsed: 0,
    correctionAttempts: 0,
    synthesized: false,
    readerRetakeCount: 0,
    deps: makeDeps(),
    ...overrides,
  };
}

describe('defectResultToReaderJuryResult', () => {
  it('should convert passed defect result to passing reader jury result', async () => {
    const { defectResultToReaderJuryResult } = await import(
      '../../../src/pipeline/adapters/defect-to-reader.js'
    );

    const defectResult: DefectDetectorResult = {
      defects: [],
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      verdictLevel: 'publishable',
      passed: true,
      feedback: 'No defects found',
    };

    const result = defectResultToReaderJuryResult(defectResult);
    expect(result.passed).toBe(true);
    expect(result.aggregatedScore).toBe(1.0);
    expect(result.summary).toBe('No defects found');
    expect(result.evaluations).toEqual([]);
  });

  it('should convert failed defect result to failing reader jury result', async () => {
    const { defectResultToReaderJuryResult } = await import(
      '../../../src/pipeline/adapters/defect-to-reader.js'
    );

    const defectResult: DefectDetectorResult = {
      defects: [
        { severity: 'critical', category: 'voice', description: 'Voice inconsistency' },
        { severity: 'major', category: 'pacing', description: 'Pacing issue' },
        { severity: 'minor', category: 'style', description: 'Minor style issue' },
      ],
      criticalCount: 1,
      majorCount: 1,
      minorCount: 1,
      passed: false,
      feedback: 'Multiple defects found',
    };

    const result = defectResultToReaderJuryResult(defectResult);
    expect(result.passed).toBe(false);
    // score = max(0, 1.0 - (1*0.3 + 1*0.1 + 1*0.02)) = 0.58
    expect(result.aggregatedScore).toBeCloseTo(0.58, 2);
    expect(result.summary).toBe('Multiple defects found');
  });

  it('should clamp score to 0 when many defects', async () => {
    const { defectResultToReaderJuryResult } = await import(
      '../../../src/pipeline/adapters/defect-to-reader.js'
    );

    const defectResult: DefectDetectorResult = {
      defects: [],
      criticalCount: 5,
      majorCount: 10,
      minorCount: 0,
      passed: false,
      feedback: 'Many critical defects',
    };

    const result = defectResultToReaderJuryResult(defectResult);
    expect(result.aggregatedScore).toBe(0);
  });
});

describe('createDefectDetectorStage', () => {
  it('should pass through when detect returns passed', async () => {
    const passedResult: DefectDetectorResult = {
      defects: [],
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      verdictLevel: 'publishable',
      passed: true,
      feedback: 'All clear',
    };

    vi.doMock('../../../src/agents/defect-detector.js', () => ({
      createDefectDetector: () => ({
        detect: vi.fn().mockResolvedValue(passedResult),
      }),
    }));

    const { createDefectDetectorStage } = await import(
      '../../../src/pipeline/stages/defect-detector-stage.js'
    );

    const stage = createDefectDetectorStage();
    const ctx = makeContext();
    const result = await stage(ctx);

    expect(result.defectResult).toEqual(passedResult);
    expect(result.readerJuryResult).toBeDefined();
    expect(result.readerJuryResult!.passed).toBe(true);
    expect(result.text).toBe('テスト文章です。');
  });

  it('should retake and re-detect when failed (max 1 retry)', async () => {
    const failedResult: DefectDetectorResult = {
      defects: [{ severity: 'critical', category: 'voice', description: 'Bad voice' }],
      criticalCount: 1,
      majorCount: 0,
      minorCount: 0,
      verdictLevel: 'unacceptable',
      passed: false,
      feedback: 'Voice defect found',
    };
    const passedResult: DefectDetectorResult = {
      defects: [],
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      passed: true,
      feedback: 'All clear after retake',
    };

    const detectMock = vi.fn()
      .mockResolvedValueOnce(failedResult)
      .mockResolvedValueOnce(passedResult);

    vi.doMock('../../../src/agents/defect-detector.js', () => ({
      createDefectDetector: () => ({
        detect: detectMock,
      }),
    }));

    vi.doMock('../../../src/retake/retake-agent.js', () => ({
      createRetakeAgent: () => ({
        retake: vi.fn().mockResolvedValue({
          retakenText: 'retaken improved text',
          tokensUsed: 50,
        }),
      }),
    }));

    const { createDefectDetectorStage } = await import(
      '../../../src/pipeline/stages/defect-detector-stage.js'
    );

    const stage = createDefectDetectorStage();
    const ctx = makeContext();
    const result = await stage(ctx);

    expect(detectMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('retaken improved text');
    expect(result.defectResult).toEqual(passedResult);
    expect(result.readerJuryResult!.passed).toBe(true);
  });

  it('should keep failed state when retake does not fix defects', async () => {
    const failedResult: DefectDetectorResult = {
      defects: [{ severity: 'critical', category: 'voice', description: 'Bad voice' }],
      criticalCount: 1,
      majorCount: 0,
      minorCount: 0,
      verdictLevel: 'unacceptable',
      passed: false,
      feedback: 'Still has defects',
    };

    const detectMock = vi.fn().mockResolvedValue(failedResult);

    vi.doMock('../../../src/agents/defect-detector.js', () => ({
      createDefectDetector: () => ({
        detect: detectMock,
      }),
    }));

    vi.doMock('../../../src/retake/retake-agent.js', () => ({
      createRetakeAgent: () => ({
        retake: vi.fn().mockResolvedValue({
          retakenText: 'retaken but still bad',
          tokensUsed: 50,
        }),
      }),
    }));

    const { createDefectDetectorStage } = await import(
      '../../../src/pipeline/stages/defect-detector-stage.js'
    );

    const stage = createDefectDetectorStage();
    const ctx = makeContext();
    const result = await stage(ctx);

    // detect called 3 times: initial + 2 retakes (MAX_RETAKES=2)
    expect(detectMock).toHaveBeenCalledTimes(3);
    expect(result.defectResult!.passed).toBe(false);
    expect(result.readerJuryResult!.passed).toBe(false);
  });

  it('should store defectResult in context', async () => {
    const defectResult: DefectDetectorResult = {
      defects: [{ severity: 'minor', category: 'style', description: 'Minor issue' }],
      criticalCount: 0,
      majorCount: 0,
      minorCount: 1,
      verdictLevel: 'publishable',
      passed: true,
      feedback: 'Minor issues only',
    };

    vi.doMock('../../../src/agents/defect-detector.js', () => ({
      createDefectDetector: () => ({
        detect: vi.fn().mockResolvedValue(defectResult),
      }),
    }));

    const { createDefectDetectorStage } = await import(
      '../../../src/pipeline/stages/defect-detector-stage.js'
    );

    const stage = createDefectDetectorStage();
    const result = await stage(makeContext());

    expect(result.defectResult).toEqual(defectResult);
  });
});
