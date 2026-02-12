import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { CerebrasClient } from './cerebras.js';
import type { ToolDefinition, LLMMessage } from './types.js';

// Mock the Cerebras SDK
const mockCreate = vi.fn();
const mockCerebras = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
} as any;

describe('CerebrasClient.completeWithTools', () => {
  let client: CerebrasClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CerebrasClient(
      { apiKey: 'test-key', model: 'test-model' },
      mockCerebras,
    );
  });

  const tools: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'submit_proposal',
        description: '提案を提出する',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
          required: ['content'],
        },
        strict: true,
      },
    },
  ];

  it('should return tool calls when LLM responds with tool_calls', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'submit_proposal',
                  arguments: '{"content":"透心の独白から始める"}',
                },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 200 },
    });

    const result = await client.completeWithTools(
      'system',
      'user',
      tools,
      { toolChoice: 'required' },
    );

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('submit_proposal');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({
      content: '透心の独白から始める',
    });
    expect(result.tokensUsed).toBe(200);
    expect(result.content).toBeNull();
  });

  it('should pass tools and tool_choice to Cerebras API', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'submit_proposal', arguments: '{"content":"test"}' },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    await client.completeWithTools('sys', 'usr', tools, { toolChoice: 'required' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools,
        tool_choice: 'required',
      }),
    );
  });

  it('should return content when LLM responds without tool_calls', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'テキスト応答',
            tool_calls: null,
          },
        },
      ],
      usage: { total_tokens: 50 },
    });

    const result = await client.completeWithTools('sys', 'usr', tools);

    expect(result.toolCalls).toHaveLength(0);
    expect(result.content).toBe('テキスト応答');
  });

  it('should track tokens across completeWithTools calls', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'test' },
        },
      ],
      usage: { total_tokens: 100 },
    });
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'submit_proposal', arguments: '{}' } },
            ],
          },
        },
      ],
      usage: { total_tokens: 200 },
    });

    await client.completeWithTools('s', 'u', tools);
    await client.completeWithTools('s', 'u', tools);

    expect(client.getTotalTokens()).toBe(300);
  });

  it('should return reasoning from completeWithTools response', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            reasoning: 'I chose this tool because the user needs a proposal.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'submit_proposal', arguments: '{"content":"test"}' },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 150 },
    });

    const result = await client.completeWithTools('sys', 'usr', tools, { toolChoice: 'required' });

    expect(result.reasoning).toBe('I chose this tool because the user needs a proposal.');
  });

  it('should return null reasoning when not present in completeWithTools response', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'submit_proposal', arguments: '{"content":"test"}' },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const result = await client.completeWithTools('sys', 'usr', tools);

    expect(result.reasoning).toBeNull();
  });

  it('should pass reasoning_format to completeWithTools API call', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'submit_proposal', arguments: '{"content":"test"}' },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    await client.completeWithTools('sys', 'usr', tools, { reasoningFormat: 'hidden' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning_format: 'hidden',
      }),
    );
  });
});

describe('CerebrasClient.complete with messages', () => {
  let client: CerebrasClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CerebrasClient(
      { apiKey: 'test-key', model: 'test-model', initialRetryDelayMs: 1 },
      mockCerebras,
    );
  });

  it('should accept LLMMessage[] as first argument', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: '応答テキスト' },
        },
      ],
      usage: { total_tokens: 50 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'あなたは小説家です' },
      { role: 'user', content: '冒頭を書いてください' },
    ];

    const result = await client.complete(messages);

    expect(result).toBe('応答テキスト');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'あなたは小説家です' },
          { role: 'user', content: '冒頭を書いてください' },
        ],
      }),
    );
  });

  it('should pass multi-turn messages including assistant reasoning', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: '続きを書きました' },
        },
      ],
      usage: { total_tokens: 80 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'first turn' },
      { role: 'assistant', content: 'first response', reasoning: 'my reasoning' },
      { role: 'user', content: 'second turn' },
    ];

    const result = await client.complete(messages);

    expect(result).toBe('続きを書きました');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'first turn' },
          { role: 'assistant', content: 'first response', reasoning: 'my reasoning' },
          { role: 'user', content: 'second turn' },
        ],
      }),
    );
  });

  it('should pass reasoning_format with messages-based complete', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'response' },
        },
      ],
      usage: { total_tokens: 30 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    await client.complete(messages, { reasoningFormat: 'parsed' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning_format: 'parsed',
      }),
    );
  });

  it('should still work with legacy string-based complete', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'legacy response' },
        },
      ],
      usage: { total_tokens: 40 },
    });

    const result = await client.complete('system prompt', 'user prompt');

    expect(result).toBe('legacy response');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
      }),
    );
  });

  it('should retry on empty response with messages', async () => {
    mockCreate
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [
          {
            finish_reason: 'stop',
            message: { role: 'assistant', content: '' },
          },
        ],
        usage: { total_tokens: 10 },
      })
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [
          {
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'success after retry' },
          },
        ],
        usage: { total_tokens: 20 },
      });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    const result = await client.complete(messages);

    expect(result).toBe('success after retry');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe('CerebrasClient.completeStructured', () => {
  let client: CerebrasClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CerebrasClient(
      { apiKey: 'test-key', model: 'test-model', maxRetries: 3, initialRetryDelayMs: 1 },
      mockCerebras,
    );
  });

  const testSchema = z.object({
    title: z.string(),
    score: z.number(),
  });

  it('should parse response with Zod schema and return structured data', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"透心の覚醒","score":85}',
            reasoning: null,
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'Generate a story evaluation' },
      { role: 'user', content: 'Evaluate this story' },
    ];

    const result = await client.completeStructured(messages, testSchema);

    expect(result.data).toEqual({ title: '透心の覚醒', score: 85 });
    expect(result.tokensUsed).toBe(100);
  });

  it('should return reasoning from structured response', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"test","score":50}',
            reasoning: 'The story had moderate quality because...',
          },
        },
      ],
      usage: { total_tokens: 120 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    const result = await client.completeStructured(messages, testSchema);

    expect(result.reasoning).toBe('The story had moderate quality because...');
  });

  it('should return null reasoning when not present', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"test","score":50}',
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    const result = await client.completeStructured(messages, testSchema);

    expect(result.reasoning).toBeNull();
  });

  it('should pass response_format with json_schema to API', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"test","score":50}',
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    await client.completeStructured(messages, testSchema);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'response',
            strict: true,
          }),
        }),
      }),
    );
  });

  it('should use reasoning_format parsed by default', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"test","score":50}',
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    await client.completeStructured(messages, testSchema);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning_format: 'parsed',
      }),
    );
  });

  it('should use temperature 1.0 by default', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"test","score":50}',
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    await client.completeStructured(messages, testSchema);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 1.0,
      }),
    );
  });

  it('should retry on transient errors', async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 500, message: 'Internal Server Error', headers: {} })
      .mockResolvedValueOnce({
        object: 'chat.completion',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: '{"title":"success","score":99}',
            },
          },
        ],
        usage: { total_tokens: 100 },
      });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    const result = await client.completeStructured(messages, testSchema);

    expect(result.data).toEqual({ title: 'success', score: 99 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    mockCreate
      .mockResolvedValue({
        object: 'chat.completion',
        choices: [
          {
            finish_reason: 'stop',
            message: { role: 'assistant', content: '' },
          },
        ],
        usage: { total_tokens: 10 },
      });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    await expect(client.completeStructured(messages, testSchema))
      .rejects.toThrow(/failed after 3 retries/);
  });

  it('should pass clear_thinking: false', async () => {
    mockCreate.mockResolvedValueOnce({
      object: 'chat.completion',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"title":"test","score":50}',
          },
        },
      ],
      usage: { total_tokens: 100 },
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ];

    await client.completeStructured(messages, testSchema);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        clear_thinking: false,
      }),
    );
  });
});
