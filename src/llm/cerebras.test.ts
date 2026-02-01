import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CerebrasClient } from './cerebras.js';
import type { ToolDefinition } from './types.js';

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
});
