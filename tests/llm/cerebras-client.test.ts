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

  it('should retry when response content is empty', async () => {
    // First call returns empty, second call returns valid response
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
        usage: { total_tokens: 50 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Success after retry' } }],
        usage: { total_tokens: 100 },
      });

    const result = await client.complete('System', 'User');

    expect(result).toBe('Success after retry');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should retry when response content is null/undefined', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: {} }],
        usage: { total_tokens: 50 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Success after null' } }],
        usage: { total_tokens: 100 },
      });

    const result = await client.complete('System', 'User');

    expect(result).toBe('Success after null');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exceeded', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '' } }],
      usage: { total_tokens: 50 },
    });

    await expect(client.complete('System', 'User')).rejects.toThrow(
      'No content in LLM response after 3 retries'
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should accumulate tokens across retries', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
        usage: { total_tokens: 50 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Success' } }],
        usage: { total_tokens: 100 },
      });

    await client.complete('System', 'User');

    // 50 + 100 = 150
    expect(client.getTotalTokens()).toBe(150);
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
