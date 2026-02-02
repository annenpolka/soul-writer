import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimplePipeline } from '../../src/pipeline/simple.js';
import type { LLMClient } from '../../src/llm/types.js';
import { SoulTextManager } from '../../src/soul/manager.js';
import type { NarrativeRules } from '../../src/factory/narrative-rules.js';

// Mock LLM Client that handles all agent types
const createMockLLMClient = (): LLMClient => {
  let callCount = 0;
  return {
    complete: vi.fn().mockImplementation((systemPrompt: string) => {
      callCount++;

      // Judge response
      if (systemPrompt.includes('審査') || systemPrompt.includes('比較')) {
        return Promise.resolve(
          JSON.stringify({
            winner: 'A',
            reasoning: 'Aの方が文体が優れている',
            scores: {
              A: { style: 0.9, compliance: 0.85, overall: 0.87 },
              B: { style: 0.8, compliance: 0.82, overall: 0.81 },
            },
          })
        );
      }

      // Reader evaluation response
      if (systemPrompt.includes('評価') || systemPrompt.includes('読者')) {
        return Promise.resolve(
          JSON.stringify({
            scores: {
              style: 0.85,
              plot: 0.82,
              character: 0.88,
              worldbuilding: 0.80,
              readability: 0.90,
            },
            feedback: '全体的に良い作品です。',
          })
        );
      }

      // Corrector response
      if (systemPrompt.includes('矯正') || systemPrompt.includes('修正')) {
        return Promise.resolve('修正された文章です。');
      }

      // Synthesis response
      if (systemPrompt.includes('統合') || systemPrompt.includes('融合')) {
        return Promise.resolve(
          JSON.stringify({
            synthesizedText: '統合された文章です。透心は静かに窓の外を見つめていた。',
          })
        );
      }

      // Retake response
      if (systemPrompt.includes('リテイク') || systemPrompt.includes('書き直')) {
        return Promise.resolve('リテイクされた文章です。');
      }

      // Default writer response
      return Promise.resolve('透心は静かに窓の外を見つめていた。ARタグが揺らめく朝の光の中で。');
    }),
    completeWithTools: vi.fn().mockImplementation((_systemPrompt: string, _userPrompt: string, tools) => {
      const toolName = tools[0]?.function?.name;
      if (toolName === 'submit_judgement') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_judgement',
              arguments: JSON.stringify({
                winner: 'A',
                reasoning: 'Aの方が文体が優れている',
                scores: {
                  A: { style: 0.9, compliance: 0.85, overall: 0.87 },
                  B: { style: 0.8, compliance: 0.82, overall: 0.81 },
                },
                praised_excerpts: { A: [], B: [] },
              }),
            },
          }],
          content: null,
          tokensUsed: 50,
        });
      }
      if (toolName === 'submit_reader_evaluation') {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_reader_evaluation',
              arguments: JSON.stringify({
                categoryScores: {
                  style: 0.85,
                  plot: 0.82,
                  character: 0.88,
                  worldbuilding: 0.80,
                  readability: 0.90,
                },
                feedback: '全体的に良い作品です。',
              }),
            },
          }],
          content: null,
          tokensUsed: 50,
        });
      }
      return Promise.resolve({ toolCalls: [], content: null, tokensUsed: 0 });
    }),
    getTotalTokens: vi.fn().mockReturnValue(1000),
  };
};

describe('SimplePipeline', () => {
  let soulManager: SoulTextManager;

  beforeEach(async () => {
    soulManager = await SoulTextManager.load('soul');
  });

  describe('constructor', () => {
    it('should create a pipeline with no options', () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager);
      expect(pipeline).toBeInstanceOf(SimplePipeline);
    });

    it('should accept simple option', () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager, { simple: true });
      expect(pipeline).toBeInstanceOf(SimplePipeline);
    });

    it('should accept narrativeRules option', () => {
      const rules: NarrativeRules = {
        pov: 'first-person',
        pronoun: 'わたし',
        protagonistName: null,
        povDescription: 'テスト',
        isDefaultProtagonist: true,
      };
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager, { narrativeRules: rules });
      expect(pipeline).toBeInstanceOf(SimplePipeline);
    });
  });

  describe('generate with simple: true', () => {
    it('should generate text using tournament only', async () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager, { simple: true });
      const result = await pipeline.generate('Write a scene');

      expect(result.text).toBeDefined();
      expect(result.champion).toBeDefined();
      expect(result.tournamentResult.rounds).toHaveLength(3);
      expect(result.tokensUsed).toBeDefined();
    });

    it('should not include post-processing results', async () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager, { simple: true });
      const result = await pipeline.generate('Write a scene');

      expect(result.complianceResult).toBeUndefined();
      expect(result.readerJuryResult).toBeUndefined();
      expect(result.synthesized).toBeUndefined();
    });
  });

  describe('generate with default (full) mode', () => {
    it('should include compliance result', async () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager);
      const result = await pipeline.generate('Write a scene');

      expect(result.complianceResult).toBeDefined();
      expect(typeof result.complianceResult!.score).toBe('number');
      expect(typeof result.complianceResult!.isCompliant).toBe('boolean');
    });

    it('should include reader jury result', async () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager);
      const result = await pipeline.generate('Write a scene');

      expect(result.readerJuryResult).toBeDefined();
      expect(typeof result.readerJuryResult!.aggregatedScore).toBe('number');
    });

    it('should have synthesized flag', async () => {
      const pipeline = new SimplePipeline(createMockLLMClient(), soulManager);
      const result = await pipeline.generate('Write a scene');

      expect(result.synthesized).toBeDefined();
      expect(typeof result.synthesized).toBe('boolean');
    });
  });
});
