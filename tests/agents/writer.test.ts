import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriterAgent, type WriterConfig } from '../../src/agents/writer.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

// Mock LLM Client
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue('Generated text from writer'),
  getTotalTokens: vi.fn().mockReturnValue(100),
};

const mockSoulText = createMockSoulText();

describe('WriterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a writer agent with default config', () => {
      const writer = new WriterAgent(mockLLMClient, mockSoulText);
      expect(writer).toBeInstanceOf(WriterAgent);
      expect(writer.getId()).toBe('writer_1');
    });

    it('should create a writer agent with custom config', () => {
      const config: WriterConfig = {
        id: 'custom_writer',
        temperature: 0.9,
        topP: 0.95,
        style: 'creative',
      };
      const writer = new WriterAgent(mockLLMClient, mockSoulText, config);
      expect(writer.getId()).toBe('custom_writer');
    });
  });

  describe('generate', () => {
    it('should generate text for a given prompt', async () => {
      const writer = new WriterAgent(mockLLMClient, mockSoulText);
      const result = await writer.generate('Write a scene about the morning');

      expect(result).toBe('Generated text from writer');
      expect(mockLLMClient.complete).toHaveBeenCalledOnce();
    });

    it('should use configured temperature and topP', async () => {
      const config: WriterConfig = {
        id: 'hot_writer',
        temperature: 0.9,
        topP: 0.95,
        style: 'creative',
      };
      const writer = new WriterAgent(mockLLMClient, mockSoulText, config);
      await writer.generate('Write something');

      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          temperature: 0.9,
          topP: 0.95,
        })
      );
    });
  });

  describe('prompt-config integration', () => {
    it('should use critical_rules from promptConfig for writer agent', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          agents: {
            writer: {
              critical_rules: [
                '「ライオン」はタイトルのメタファー。可視的な獣・データ獣として作中に登場させない',
                'ライオンという語は内面の比喩としてのみ使用可。具現化・実体化は禁止',
              ],
            },
          },
        },
      };
      const writer = new WriterAgent(mockLLMClient, soulTextWithConfig);
      await writer.generate('test');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(systemPrompt).toContain('「ライオン」はタイトルのメタファー');
      expect(systemPrompt).toContain('ライオンという語は内面の比喩としてのみ使用可');
    });

    it('should use character_constraints from promptConfig instead of hardcoded tsurugi rules', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          character_constraints: {
            '愛原つるぎ': [
              'つるぎは透心の案内役やメンターではない。対等な共犯者',
              'つるぎは解説しない。断片的に語る',
            ],
          },
        },
      };
      const developedChars = [
        { name: '愛原つるぎ', role: 'ハッカー', isNew: false },
        { name: '御鐘透心', role: '主人公', isNew: false },
      ];
      const writer = new WriterAgent(mockLLMClient, soulTextWithConfig, undefined, undefined, developedChars);
      await writer.generate('test');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(systemPrompt).toContain('つるぎは透心の案内役やメンターではない。対等な共犯者');
      expect(systemPrompt).toContain('つるぎは解説しない。断片的に語る');
    });

    it('should use character_constraints from promptConfig for all constrained characters in fallback mode', async () => {
      const soulTextWithConfig: SoulText = {
        ...mockSoulText,
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          character_constraints: {
            '愛原つるぎ': [
              'つるぎルール1',
              'つるぎルール2',
            ],
          },
        },
      };
      // No developedCharacters → fallback path
      const writer = new WriterAgent(mockLLMClient, soulTextWithConfig);
      await writer.generate('test');

      const systemPrompt = (mockLLMClient.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(systemPrompt).toContain('つるぎルール1');
      expect(systemPrompt).toContain('つるぎルール2');
    });
  });

  describe('DEFAULT_WRITERS', () => {
    it('should have 4 default writer configurations', async () => {
      const { DEFAULT_WRITERS } = await import('../../src/agents/writer.js');
      expect(DEFAULT_WRITERS).toHaveLength(4);
      expect(DEFAULT_WRITERS.map((w) => w.id)).toEqual([
        'writer_1',
        'writer_2',
        'writer_3',
        'writer_4',
      ]);
    });
  });
});
