import { describe, it, expect, vi } from 'vitest';
import { CollaborativeWriter } from './collaborative-writer.js';
import { createMockSoulText } from '../../tests/helpers/mock-soul-text.js';
import type { LLMClient, ToolCallResponse } from '../llm/types.js';
import type { CollaborationState } from './types.js';
import type { WriterConfig } from '../agents/types.js';

function createMockLLMClientWithTools(toolResponse: ToolCallResponse): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue(''),
    completeWithTools: vi.fn().mockResolvedValue(toolResponse),
    getTotalTokens: vi.fn().mockReturnValue(100),
  };
}

const defaultWriterConfig: WriterConfig = {
  id: 'writer_1',
  temperature: 0.7,
  topP: 0.9,
  style: 'balanced',
  focusCategories: ['opening', 'introspection'],
  personaDirective: '冷徹で乾いた文体を好む語り手',
  personaName: '静寂の語り手',
};

function createEmptyState(overrides?: Partial<CollaborationState>): CollaborationState {
  return {
    rounds: [],
    currentPhase: 'proposal',
    sectionAssignments: {},
    currentDrafts: {},
    consensusReached: false,
    ...overrides,
  };
}

describe('CollaborativeWriter', () => {
  it('should return proposal action during proposal phase', async () => {
    const llm = createMockLLMClientWithTools({
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'submit_proposal',
          arguments: JSON.stringify({ content: '透心の独白から始める', targetSection: 'opening' }),
        },
      }],
      content: null,
      tokensUsed: 150,
    });

    const writer = new CollaborativeWriter(llm, createMockSoulText(), defaultWriterConfig);
    const actions = await writer.participate(createEmptyState(), 'テストプロンプト');

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('proposal');
    expect(actions[0].writerId).toBe('writer_1');
    if (actions[0].type === 'proposal') {
      expect(actions[0].content).toBe('透心の独白から始める');
    }
  });

  it('should return multiple actions from parallel tool calls', async () => {
    const llm = createMockLLMClientWithTools({
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'give_feedback',
            arguments: JSON.stringify({
              targetWriterId: 'writer_2',
              feedback: '緊張感が足りない',
              sentiment: 'suggest_revision',
            }),
          },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'volunteer_section',
            arguments: JSON.stringify({ section: 'opening', reason: '得意分野です' }),
          },
        },
      ],
      content: null,
      tokensUsed: 200,
    });

    const writer = new CollaborativeWriter(llm, createMockSoulText(), defaultWriterConfig);
    const actions = await writer.participate(
      createEmptyState({ currentPhase: 'discussion' }),
      'テスト',
    );

    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('feedback');
    expect(actions[1].type).toBe('volunteer');
  });

  it('should pass tool_choice required to LLM', async () => {
    const llm = createMockLLMClientWithTools({
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'submit_proposal',
          arguments: '{"content":"test"}',
        },
      }],
      content: null,
      tokensUsed: 100,
    });

    const writer = new CollaborativeWriter(llm, createMockSoulText(), defaultWriterConfig);
    await writer.participate(createEmptyState(), 'test');

    expect(llm.completeWithTools).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ toolChoice: 'required' }),
    );
  });

  it('should only pass submit_draft tool during drafting phase', async () => {
    const llm = createMockLLMClientWithTools({
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'submit_draft',
          arguments: JSON.stringify({ section: 'opening', text: '冒頭テキスト' }),
        },
      }],
      content: null,
      tokensUsed: 100,
    });

    const writer = new CollaborativeWriter(llm, createMockSoulText(), defaultWriterConfig);
    await writer.participate(createEmptyState({ currentPhase: 'drafting' }), 'test');

    const passedTools = (llm.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(passedTools).toHaveLength(1);
    expect(passedTools[0].function.name).toBe('submit_draft');
  });

  it('should pass all tools during non-drafting phases', async () => {
    const llm = createMockLLMClientWithTools({
      toolCalls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'submit_proposal',
          arguments: '{"content":"test"}',
        },
      }],
      content: null,
      tokensUsed: 100,
    });

    const writer = new CollaborativeWriter(llm, createMockSoulText(), defaultWriterConfig);
    await writer.participate(createEmptyState({ currentPhase: 'proposal' }), 'test');

    const passedTools = (llm.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(passedTools).toHaveLength(4);
  });

  it('should return empty array when no tool calls', async () => {
    const llm = createMockLLMClientWithTools({
      toolCalls: [],
      content: 'テキスト応答のみ',
      tokensUsed: 50,
    });

    const writer = new CollaborativeWriter(llm, createMockSoulText(), defaultWriterConfig);
    const actions = await writer.participate(createEmptyState(), 'test');

    expect(actions).toHaveLength(0);
  });
});
