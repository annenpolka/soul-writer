import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CerebrasClient } from '../../src/llm/cerebras.js';
import type { LLMClient, CompletionOptions } from '../../src/llm/types.js';

// Mock SDK client
const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: 'Mock response' } }],
  usage: { total_tokens: 100 },
});

const mockCerebrasClient = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
};

describe('CerebrasClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mock response' } }],
      usage: { total_tokens: 100 },
    });
    client = new CerebrasClient(
      { apiKey: 'test-api-key', model: 'test-model' },
      mockCerebrasClient
    );
  });

  it('should implement LLMClient interface', () => {
    expect(client.complete).toBeDefined();
    expect(typeof client.complete).toBe('function');
  });

  it('should complete a prompt', async () => {
    const result = await client.complete(
      'You are a helpful assistant.',
      'Hello!'
    );

    expect(result).toBe('Mock response');
  });

  it('should pass options to the API', async () => {
    const options: CompletionOptions = {
      temperature: 0.7,
      maxTokens: 1000,
    };

    const result = await client.complete(
      'System prompt',
      'User prompt',
      options
    );

    expect(result).toBe('Mock response');
  });

  it('should track token usage', async () => {
    await client.complete('System', 'User');

    expect(client.getTotalTokens()).toBe(100);
  });
});

describe('CerebrasClient Integration', () => {
  it.skipIf(!process.env.CEREBRAS_API_KEY)(
    'should connect to real Cerebras API',
    async () => {
      const client = new CerebrasClient({
        apiKey: process.env.CEREBRAS_API_KEY!,
        model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
      });

      const result = await client.complete(
        'You are a helpful assistant. Respond briefly.',
        'Say hello in Japanese.'
      );

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    }
  );
});
