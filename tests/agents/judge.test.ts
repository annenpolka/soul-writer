import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgeAgent } from '../../src/agents/judge.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

// Mock LLM Client
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue(
    JSON.stringify({
      winner: 'A',
      reasoning: 'Text A better captures the soul',
      scores: {
        A: { style: 0.8, compliance: 0.9, overall: 0.85 },
        B: { style: 0.7, compliance: 0.8, overall: 0.75 },
      },
    })
  ),
  getTotalTokens: vi.fn().mockReturnValue(100),
};

const mockSoulText = createMockSoulText({ forbiddenWords: [] });

describe('JudgeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a judge agent', () => {
      const judge = new JudgeAgent(mockLLMClient, mockSoulText);
      expect(judge).toBeInstanceOf(JudgeAgent);
    });
  });

  describe('evaluate', () => {
    it('should evaluate two texts and return winner', async () => {
      const judge = new JudgeAgent(mockLLMClient, mockSoulText);
      const result = await judge.evaluate('Text A content', 'Text B content');

      expect(result.winner).toBe('A');
      expect(result.reasoning).toBeDefined();
      expect(result.scores).toBeDefined();
    });

    it('should call LLM with both texts', async () => {
      const judge = new JudgeAgent(mockLLMClient, mockSoulText);
      await judge.evaluate('First text', 'Second text');

      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('First text'),
        expect.any(Object)
      );
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Second text'),
        expect.any(Object)
      );
    });
  });

  describe('prompt-config integration', () => {
    it('should use penalty_items from promptConfig', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          agents: {
            judge: {
              penalty_items: [
                'つるぎの台詞が説明的・解説的になっている → 減点',
                'AR/MRの設定説明が長すぎる → 減点',
              ],
            },
          },
        },
      };
      const judge = new JudgeAgent(mockLLMClient, soulTextWithConfig);
      await judge.evaluate('text A', 'text B');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(systemPrompt).toContain('つるぎの台詞が説明的・解説的になっている → 減点');
      expect(systemPrompt).toContain('AR/MRの設定説明が長すぎる → 減点');
    });

    it('should use character_voice_rules from promptConfig instead of constitution', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          agents: {
            judge: {
              character_voice_rules: {
                '愛原つるぎ': '短い台詞、皮肉混じり、哲学的',
                '御鐘透心': '内面独白的、冷徹だが感受性豊か',
              },
            },
          },
        },
      };
      const judge = new JudgeAgent(mockLLMClient, soulTextWithConfig);
      await judge.evaluate('text A', 'text B');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(systemPrompt).toContain('愛原つるぎ: 短い台詞、皮肉混じり、哲学的');
      expect(systemPrompt).toContain('御鐘透心: 内面独白的、冷徹だが感受性豊か');
    });
  });
});
