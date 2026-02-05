import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectionLoop } from '../../src/correction/loop.js';
import { CorrectorAgent } from '../../src/agents/corrector.js';
import { ComplianceChecker } from '../../src/compliance/checker.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { Violation, ChapterContext } from '../../src/agents/types.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

const mockSoulText = createMockSoulText({ forbiddenWords: ['とても'] });

describe('CorrectionLoop', () => {
  let mockLLMClient: LLMClient;
  let corrector: CorrectorAgent;
  let checker: ComplianceChecker;

  beforeEach(() => {
    mockLLMClient = {
      complete: vi.fn().mockResolvedValue('修正された文章です。'),
      getTotalTokens: vi.fn().mockReturnValue(100),
    };
    corrector = new CorrectorAgent(mockLLMClient, mockSoulText);
    checker = ComplianceChecker.fromSoulText(mockSoulText);
  });

  describe('constructor', () => {
    it('should create a correction loop with default max attempts', () => {
      const loop = new CorrectionLoop(corrector, checker);
      expect(loop).toBeInstanceOf(CorrectionLoop);
    });

    it('should create a correction loop with custom max attempts', () => {
      const loop = new CorrectionLoop(corrector, checker, 5);
      expect(loop).toBeInstanceOf(CorrectionLoop);
    });
  });

  describe('run', () => {
    it('should return immediately if text is already compliant', async () => {
      const loop = new CorrectionLoop(corrector, checker);
      const compliantText = '透心は静かに窓を見つめていた。';

      const result = await loop.run(compliantText);

      expect(result.success).toBe(true);
      expect(result.finalText).toBe(compliantText);
      expect(result.attempts).toBe(0);
      expect(mockLLMClient.complete).not.toHaveBeenCalled();
    });

    it('should attempt correction for non-compliant text', async () => {
      const loop = new CorrectionLoop(corrector, checker);
      const nonCompliantText = 'とても美しい朝だった。';

      await loop.run(nonCompliantText);

      expect(mockLLMClient.complete).toHaveBeenCalled();
    });

    it('should succeed when correction fixes violations', async () => {
      // Mock corrector to return compliant text
      mockLLMClient.complete = vi.fn().mockResolvedValue('美しい朝だった。');

      const loop = new CorrectionLoop(corrector, checker);
      const result = await loop.run('とても美しい朝だった。');

      expect(result.success).toBe(true);
      expect(result.finalText).toBe('美しい朝だった。');
      expect(result.attempts).toBe(1);
    });

    it('should retry up to max attempts if corrections fail', async () => {
      // Mock corrector to always return non-compliant text
      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 3);
      const result = await loop.run('とても美しい。');

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(3);
    });

    it('should track violations from original text on failure', async () => {
      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 2);
      const result = await loop.run('とても美しい。');

      expect(result.success).toBe(false);
      expect(result.originalViolations).toBeDefined();
      expect(result.originalViolations!.length).toBeGreaterThan(0);
    });

    it('should accumulate tokens used across attempts', async () => {
      let callCount = 0;
      mockLLMClient.complete = vi.fn().mockImplementation(() => {
        callCount++;
        // First two attempts return non-compliant, third returns compliant
        return Promise.resolve(callCount < 3 ? 'とても良い。' : '良い朝だ。');
      });
      mockLLMClient.getTotalTokens = vi.fn().mockReturnValue(50);

      const loop = new CorrectionLoop(corrector, checker, 3);
      const result = await loop.run('とても美しい。');

      // First check is free (no LLM call), but each correction attempt uses tokens
      expect(result.totalTokensUsed).toBe(150); // 3 attempts × 50 tokens
    });

    it('should stop early if text becomes compliant', async () => {
      let callCount = 0;
      mockLLMClient.complete = vi.fn().mockImplementation(() => {
        callCount++;
        // Second attempt succeeds
        return Promise.resolve(callCount < 2 ? 'とても良い。' : '良い朝だ。');
      });

      const loop = new CorrectionLoop(corrector, checker, 5);
      const result = await loop.run('とても美しい。');

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
    });
  });

  describe('run with initialViolations', () => {
    it('should pass initial violations to corrector on first attempt', async () => {
      const selfRepViolation: Violation = {
        type: 'self_repetition',
        position: { start: 0, end: 10 },
        context: '「静かに」が4回使用されている',
        rule: 'phrase: 同一フレーズの繰り返し',
        severity: 'error',
      };

      // Text is compliant by sync rules, but has self_repetition from async check
      const text = '透心は静かに窓を見つめていた。';
      mockLLMClient.complete = vi.fn().mockResolvedValue('透心は窓を見つめていた。');

      const loop = new CorrectionLoop(corrector, checker, 3);
      await loop.run(text, [selfRepViolation]);

      // Corrector should have been called with the self_repetition violation
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(1);
      const prompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain('self_repetition');
    });

    it('should merge initial violations with sync violations on first attempt', async () => {
      const selfRepViolation: Violation = {
        type: 'self_repetition',
        position: { start: 0, end: 10 },
        context: '「静かに」が4回使用されている',
        rule: 'phrase: 同一フレーズの繰り返し',
        severity: 'error',
      };

      // Text has BOTH sync violations (forbidden word) and async violations (self_repetition)
      const text = 'とても美しい朝だった。';
      mockLLMClient.complete = vi.fn().mockResolvedValue('美しい朝だった。');

      const loop = new CorrectionLoop(corrector, checker, 3);
      await loop.run(text, [selfRepViolation]);

      // First call should contain both violation types
      const prompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain('self_repetition');
      expect(prompt).toContain('forbidden_word');
    });

    it('should include initial violations in originalViolations on failure', async () => {
      const selfRepViolation: Violation = {
        type: 'self_repetition',
        position: { start: 0, end: 10 },
        context: '「静かに」が4回使用されている',
        rule: 'phrase: 同一フレーズの繰り返し',
        severity: 'error',
      };

      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 1);
      const result = await loop.run('とても美しい。', [selfRepViolation]);

      expect(result.success).toBe(false);
      expect(result.originalViolations).toBeDefined();
      expect(result.originalViolations!.some(v => v.type === 'self_repetition')).toBe(true);
      expect(result.originalViolations!.some(v => v.type === 'forbidden_word')).toBe(true);
    });
  });

  describe('run with chapterContext (async rules every iteration)', () => {
    it('should call checkWithContext on every iteration when chapterContext is provided', async () => {
      const chapterContext: ChapterContext = { previousChapterTexts: ['前章のテキスト。'] };

      // Spy on checker methods
      const checkWithContextSpy = vi.spyOn(checker, 'checkWithContext').mockResolvedValue({
        isCompliant: false,
        score: 0.5,
        violations: [{ type: 'forbidden_word', position: { start: 0, end: 3 }, context: 'とても', rule: 'test', severity: 'error' }],
      });

      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 2);
      await loop.run('とても美しい。', undefined, chapterContext);

      // checkWithContext should have been called for initial + each iteration
      expect(checkWithContextSpy).toHaveBeenCalledTimes(3); // initial + 2 iterations
      expect(checkWithContextSpy).toHaveBeenCalledWith('とても美しい。', chapterContext);

      checkWithContextSpy.mockRestore();
    });

    it('should pass async violations to corrector on every attempt', async () => {
      const chapterContext: ChapterContext = { previousChapterTexts: ['前章のテキスト。'] };

      let checkCallCount = 0;
      vi.spyOn(checker, 'checkWithContext').mockImplementation(async () => {
        checkCallCount++;
        return {
          isCompliant: false,
          score: 0.5,
          violations: [
            { type: 'forbidden_word', position: { start: 0, end: 3 }, context: 'とても', rule: 'test', severity: 'error' as const },
            { type: 'self_repetition', position: { start: 0, end: 10 }, context: `反復検出 attempt ${checkCallCount}`, rule: 'phrase: 反復', severity: 'error' as const },
          ],
        };
      });

      mockLLMClient.complete = vi.fn().mockResolvedValue('とても素晴らしい。');

      const loop = new CorrectionLoop(corrector, checker, 2);
      await loop.run('とても美しい。', undefined, chapterContext);

      // Both attempts should receive self_repetition violations
      const firstPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      const secondPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[1][1] as string;
      expect(firstPrompt).toContain('self_repetition');
      expect(secondPrompt).toContain('self_repetition');
    });

    it('should fall back to sync check when no chapterContext', async () => {
      const checkSpy = vi.spyOn(checker, 'check');
      const checkWithContextSpy = vi.spyOn(checker, 'checkWithContext');

      mockLLMClient.complete = vi.fn().mockResolvedValue('美しい朝だった。');

      const loop = new CorrectionLoop(corrector, checker, 3);
      await loop.run('とても美しい。');

      expect(checkSpy).toHaveBeenCalled();
      expect(checkWithContextSpy).not.toHaveBeenCalled();

      checkSpy.mockRestore();
      checkWithContextSpy.mockRestore();
    });
  });
});
