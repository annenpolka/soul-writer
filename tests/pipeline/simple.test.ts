import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimplePipeline } from '../../src/pipeline/simple.js';
import type { LLMClient } from '../../src/llm/types.js';
import { SoulTextManager } from '../../src/soul/manager.js';

// Mock LLM Client
let callCount = 0;
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount <= 4) {
      return Promise.resolve(`Generated text ${callCount}: この世界は無関心に満ちている。`);
    }
    return Promise.resolve(
      JSON.stringify({
        winner: 'A',
        reasoning: 'Better captures the soul',
        scores: {
          A: { style: 0.85, compliance: 0.9, overall: 0.875 },
          B: { style: 0.75, compliance: 0.8, overall: 0.775 },
        },
      })
    );
  }),
  getTotalTokens: vi.fn().mockReturnValue(1000),
};

describe('SimplePipeline', () => {
  let soulManager: SoulTextManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    callCount = 0;
    soulManager = await SoulTextManager.load('soul');
  });

  describe('constructor', () => {
    it('should create a pipeline', () => {
      const pipeline = new SimplePipeline(mockLLMClient, soulManager);
      expect(pipeline).toBeInstanceOf(SimplePipeline);
    });
  });

  describe('generate', () => {
    it('should generate text using tournament', async () => {
      const pipeline = new SimplePipeline(mockLLMClient, soulManager);
      const result = await pipeline.generate('Write a scene about the morning');

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.champion).toBeDefined();
    });

    it('should include tournament details in result', async () => {
      const pipeline = new SimplePipeline(mockLLMClient, soulManager);
      const result = await pipeline.generate('Write a scene');

      expect(result.tournamentResult).toBeDefined();
      expect(result.tournamentResult.rounds).toHaveLength(3);
    });

    it('should track token usage', async () => {
      const pipeline = new SimplePipeline(mockLLMClient, soulManager);
      const result = await pipeline.generate('Write a scene');

      // Token usage comes from the arena which tracks totalTokensUsed
      expect(result.tokensUsed).toBeDefined();
    });
  });
});
