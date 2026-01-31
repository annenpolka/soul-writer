import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CerebrasClient } from '../../src/llm/cerebras.js';
import type { LLMClient, CompletionOptions } from '../../src/llm/types.js';

// Mock SDK client
const mockCreate = vi.fn().mockResolvedValue({
  object: 'chat.completion',
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

  let sleepSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      object: 'chat.completion',
      choices: [{ message: { content: 'Mock response' } }],
      usage: { total_tokens: 100 },
    });
    sleepSpy = vi.spyOn(CerebrasClient.prototype as any, 'sleep').mockResolvedValue(undefined);
    client = new CerebrasClient(
      { apiKey: 'test-api-key', model: 'test-model', maxRetries: 3 },
      mockCerebrasClient as any
    );
  });

  afterEach(() => {
    sleepSpy.mockRestore();
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
        object: 'chat.completion',
        choices: [{ message: { content: '' } }],
        usage: { total_tokens: 50 },
      })
      .mockResolvedValueOnce({
        object: 'chat.completion',
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
        object: 'chat.completion',
        choices: [{ message: {} }],
        usage: { total_tokens: 50 },
      })
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [{ message: { content: 'Success after null' } }],
        usage: { total_tokens: 100 },
      });

    const result = await client.complete('System', 'User');

    expect(result).toBe('Success after null');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exceeded', async () => {
    mockCreate.mockResolvedValue({
      object: 'chat.completion',
      choices: [{ message: { content: '' } }],
      usage: { total_tokens: 50 },
    });

    await expect(client.complete('System', 'User')).rejects.toThrow(
      'LLM request failed after 3 retries'
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should retry on 503 HTTP error', async () => {
    const error503 = new Error('503 Service Unavailable');
    (error503 as any).status = 503;
    mockCreate
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [{ message: { content: 'Success after 503' } }],
        usage: { total_tokens: 100 },
      });

    const result = await client.complete('System', 'User');

    expect(result).toBe('Success after 503');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should retry on 429 rate limit error', async () => {
    const error429 = new Error('429 Too Many Requests');
    (error429 as any).status = 429;
    mockCreate
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [{ message: { content: 'Success after 429' } }],
        usage: { total_tokens: 100 },
      });

    const result = await client.complete('System', 'User');

    expect(result).toBe('Success after 429');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on 400 client error', async () => {
    const error400 = new Error('400 Bad Request');
    (error400 as any).status = 400;
    mockCreate.mockRejectedValueOnce(error400);

    await expect(client.complete('System', 'User')).rejects.toThrow('400 Bad Request');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on 401 auth error', async () => {
    const error401 = new Error('401 Unauthorized');
    (error401 as any).status = 401;
    mockCreate.mockRejectedValueOnce(error401);

    await expect(client.complete('System', 'User')).rejects.toThrow('401 Unauthorized');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries on persistent 503', async () => {
    const error503 = new Error('503 Service Unavailable');
    (error503 as any).status = 503;
    mockCreate.mockRejectedValue(error503);

    await expect(client.complete('System', 'User')).rejects.toThrow(
      'LLM request failed after 3 retries'
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should apply exponential backoff delay on retries', async () => {
    const error503 = new Error('503 Service Unavailable');
    (error503 as any).status = 503;
    mockCreate
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [{ message: { content: 'Success' } }],
        usage: { total_tokens: 100 },
      });

    const retryClient = new CerebrasClient(
      { apiKey: 'test', model: 'test', initialRetryDelayMs: 1000, maxRetryDelayMs: 30000 },
      mockCerebrasClient as any
    );
    await retryClient.complete('System', 'User');

    expect(sleepSpy).toHaveBeenCalledTimes(2);
    // First delay ~1000ms (with jitter), second ~2000ms (with jitter)
    const firstDelay = sleepSpy.mock.calls[0][0] as number;
    const secondDelay = sleepSpy.mock.calls[1][0] as number;
    expect(firstDelay).toBeGreaterThanOrEqual(750);
    expect(firstDelay).toBeLessThanOrEqual(1250);
    expect(secondDelay).toBeGreaterThanOrEqual(1500);
    expect(secondDelay).toBeLessThanOrEqual(2500);
  });

  it('should accept retry config options', () => {
    const configClient = new CerebrasClient(
      {
        apiKey: 'test',
        model: 'test',
        maxRetries: 5,
        initialRetryDelayMs: 2000,
        maxRetryDelayMs: 60000,
      },
      mockCerebrasClient as any
    );
    expect(configClient).toBeDefined();
  });

  it('should accumulate tokens across retries', async () => {
    mockCreate
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [{ message: { content: '' } }],
        usage: { total_tokens: 50 },
      })
      .mockResolvedValueOnce({
        object: 'chat.completion',
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
