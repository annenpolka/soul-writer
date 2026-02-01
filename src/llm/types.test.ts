import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ToolDefinition, ToolCallResult } from './types.js';

describe('LLMClient tool calling types', () => {
  it('should define ToolDefinition with JSON Schema parameters', () => {
    const tool: ToolDefinition = {
      type: 'function',
      function: {
        name: 'submit_proposal',
        description: '提案を提出する',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '提案内容' },
            targetSection: { type: 'string', description: '対象セクション' },
          },
          required: ['content'],
        },
        strict: true,
      },
    };
    expect(tool.function.name).toBe('submit_proposal');
    expect(tool.function.strict).toBe(true);
  });

  it('should define ToolCallResult with parsed arguments', () => {
    const result: ToolCallResult = {
      id: 'call_123',
      type: 'function',
      function: {
        name: 'submit_proposal',
        arguments: '{"content":"透心の内面独白から始める"}',
      },
    };
    expect(result.function.name).toBe('submit_proposal');
    const args = JSON.parse(result.function.arguments);
    expect(args.content).toBe('透心の内面独白から始める');
  });

  it('should allow completeWithTools on LLMClient', async () => {
    const mockToolCalls: ToolCallResult[] = [
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'submit_proposal',
          arguments: '{"content":"test"}',
        },
      },
    ];

    const mockClient: LLMClient = {
      complete: vi.fn().mockResolvedValue('text response'),
      completeWithTools: vi.fn().mockResolvedValue({
        toolCalls: mockToolCalls,
        content: null,
        tokensUsed: 150,
      }),
      getTotalTokens: vi.fn().mockReturnValue(150),
    };

    const result = await mockClient.completeWithTools!(
      'system prompt',
      'user prompt',
      [{ type: 'function', function: { name: 'submit_proposal', description: 'test', parameters: {}, strict: true } }],
      { toolChoice: 'required' },
    );

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('submit_proposal');
  });
});
