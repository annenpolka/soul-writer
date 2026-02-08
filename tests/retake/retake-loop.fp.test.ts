import { describe, it, expect, vi } from 'vitest';
import { createRetakeLoop } from '../../src/retake/retake-loop.js';
import type { Retaker, Judge, JudgeResult, ScoreBreakdown } from '../../src/agents/types.js';
import type { RetakeLoopConfig } from '../../src/retake/retake-loop.js';

function makeScores(overrides?: Partial<ScoreBreakdown>): ScoreBreakdown {
  return {
    style: 0.8,
    compliance: 0.9,
    overall: 0.85,
    voice_accuracy: 0.8,
    originality: 0.8,
    structure: 0.8,
    amplitude: 0.7,
    agency: 0.6,
    stakes: 0.7,
    ...overrides,
  };
}

function makeJudgeResult(winner: 'A' | 'B', scoresA?: Partial<ScoreBreakdown>, scoresB?: Partial<ScoreBreakdown>): JudgeResult {
  return {
    winner,
    reasoning: 'Test reasoning',
    scores: {
      A: makeScores(scoresA),
      B: makeScores(scoresB),
    },
    praised_excerpts: { A: [], B: [] },
  };
}

function createMockRetaker(retakenText: string = 'retaken text'): Retaker {
  return {
    retake: vi.fn().mockResolvedValue({
      retakenText,
      tokensUsed: 100,
    }),
  };
}

function createMockJudge(evaluateResults: JudgeResult[]): Judge {
  let callIndex = 0;
  return {
    evaluate: vi.fn().mockImplementation(async () => {
      const result = evaluateResults[callIndex] ?? evaluateResults[evaluateResults.length - 1];
      callIndex++;
      return result;
    }),
  };
}

describe('createRetakeLoop (FP)', () => {
  it('should return an object with run method', () => {
    const retaker = createMockRetaker();
    const judge = createMockJudge([]);

    const loop = createRetakeLoop({ retaker, judge });

    expect(loop).toBeDefined();
    expect(typeof loop.run).toBe('function');
  });

  it('should skip retake when quality is above thresholds', async () => {
    const retaker = createMockRetaker();
    const judge = createMockJudge([
      makeJudgeResult('A', { overall: 0.85, voice_accuracy: 0.8 }),
    ]);

    const loop = createRetakeLoop({ retaker, judge });
    const result = await loop.run('good text');

    expect(result.retakeCount).toBe(0);
    expect(result.finalText).toBe('good text');
    expect(result.improved).toBe(false);
    expect(result.finalScore).toBe(0.85);
    expect(retaker.retake).not.toHaveBeenCalled();
  });

  it('should retake when score is below threshold and adopt better retake', async () => {
    const retaker = createMockRetaker('better text');
    const judge = createMockJudge([
      // Self-eval: low score → needs retake
      makeJudgeResult('A', { overall: 0.5, voice_accuracy: 0.4 }),
      // Comparison: B (retake) wins
      makeJudgeResult('B', { overall: 0.5 }, { overall: 0.8 }),
      // Self-eval of retake: high score → done
      makeJudgeResult('A', { overall: 0.85, voice_accuracy: 0.8 }),
    ]);

    const loop = createRetakeLoop({ retaker, judge });
    const result = await loop.run('bad text');

    expect(result.retakeCount).toBe(1);
    expect(result.improved).toBe(true);
    expect(result.finalText).toBe('better text');
  });

  it('should keep original when retake is worse', async () => {
    const retaker = createMockRetaker('worse text');
    const judge = createMockJudge([
      // Self-eval: low score → needs retake
      makeJudgeResult('A', { overall: 0.5, voice_accuracy: 0.4 }),
      // Comparison: A (original) wins
      makeJudgeResult('A', { overall: 0.6 }, { overall: 0.4 }),
    ]);

    const loop = createRetakeLoop({ retaker, judge });
    const result = await loop.run('original text');

    expect(result.retakeCount).toBe(1);
    expect(result.improved).toBe(false);
    expect(result.finalText).toBe('original text');
    expect(result.finalScore).toBe(0.6);
  });

  it('should respect maxRetakes from config', async () => {
    const retaker = createMockRetaker();
    const judge = createMockJudge([
      makeJudgeResult('A', { overall: 0.3, voice_accuracy: 0.3 }),
      makeJudgeResult('B', {}, { overall: 0.4 }),
      makeJudgeResult('A', { overall: 0.4, voice_accuracy: 0.3 }),
      makeJudgeResult('B', {}, { overall: 0.5 }),
    ]);

    const config: RetakeLoopConfig = {
      maxRetakes: 2,
      minScoreThreshold: 0.7,
      minVoiceThreshold: 0.6,
    };

    const loop = createRetakeLoop({ retaker, judge, config });
    const result = await loop.run('bad text');

    expect(result.retakeCount).toBeLessThanOrEqual(2);
  });

  it('should use initialFeedback on first retake', async () => {
    const retaker = createMockRetaker();
    const judge = createMockJudge([
      makeJudgeResult('A', { overall: 0.5, voice_accuracy: 0.4 }),
      makeJudgeResult('A', { overall: 0.6 }, { overall: 0.4 }),
    ]);

    const loop = createRetakeLoop({ retaker, judge });
    await loop.run('text', 'custom feedback');

    expect(retaker.retake).toHaveBeenCalledWith('text', 'custom feedback');
  });

  it('should accumulate tokens from retake attempts', async () => {
    const retaker = createMockRetaker();
    const judge = createMockJudge([
      makeJudgeResult('A', { overall: 0.5, voice_accuracy: 0.4 }),
      makeJudgeResult('A', { overall: 0.6 }, { overall: 0.4 }),
    ]);

    const loop = createRetakeLoop({ retaker, judge });
    const result = await loop.run('text');

    expect(result.totalTokensUsed).toBe(100);
  });

  it('should trigger retake when voice_accuracy is below threshold even with high overall', async () => {
    const retaker = createMockRetaker();
    const judge = createMockJudge([
      makeJudgeResult('A', { overall: 0.8, voice_accuracy: 0.3 }),
      makeJudgeResult('A', { overall: 0.8 }, { overall: 0.7 }),
    ]);

    const loop = createRetakeLoop({ retaker, judge });
    const result = await loop.run('text');

    expect(retaker.retake).toHaveBeenCalled();
    expect(result.retakeCount).toBe(1);
  });
});
