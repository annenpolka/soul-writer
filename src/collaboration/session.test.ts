import { describe, it, expect, vi } from 'vitest';
import { CollaborationSession } from './session.js';
import { createMockSoulText } from '../../tests/helpers/mock-soul-text.js';
import type { LLMClient, ToolCallResponse } from '../llm/types.js';
import type { WriterConfig } from '../agents/types.js';
import type { CollaborationConfig } from './types.js';

function createMockLLMClient(opts: {
  facilitationResponses: string[];
  composeFinalResponse?: string;
  writerToolResponses?: ToolCallResponse[];
}): LLMClient {
  let callIndex = 0;
  let toolCallIndex = 0;
  let tokens = 0;

  const facilitationResponses = [...opts.facilitationResponses];
  const writerToolResponse: ToolCallResponse = {
    toolCalls: [{
      id: 'call_1',
      type: 'function',
      function: {
        name: 'submit_proposal',
        arguments: JSON.stringify({ content: 'テスト提案' }),
      },
    }],
    content: null,
    tokensUsed: 50,
  };

  return {
    complete: vi.fn().mockImplementation(() => {
      tokens += 100;
      const idx = callIndex++;
      // Last complete call is composeFinal
      if (idx >= facilitationResponses.length) {
        return Promise.resolve(opts.composeFinalResponse ?? '最終テキスト');
      }
      return Promise.resolve(facilitationResponses[idx]);
    }),
    completeWithTools: vi.fn().mockImplementation(() => {
      tokens += 50;
      if (opts.writerToolResponses) {
        const resp = opts.writerToolResponses[toolCallIndex % opts.writerToolResponses.length];
        toolCallIndex++;
        return Promise.resolve(resp);
      }
      return Promise.resolve(writerToolResponse);
    }),
    getTotalTokens: vi.fn().mockImplementation(() => tokens),
  };
}

const writerConfigs: WriterConfig[] = [
  { id: 'w1', temperature: 0.7, topP: 0.9, style: 'balanced', personaName: '語り手A' },
  { id: 'w2', temperature: 0.8, topP: 0.9, style: 'creative', personaName: '語り手B' },
];

const testConfig: CollaborationConfig = {
  maxRounds: 3,
  writerCount: 2,
  earlyTerminationThreshold: 0.8,
};

function makeFacilitationJson(overrides?: Record<string, unknown>): string {
  return JSON.stringify({
    nextPhase: 'discussion',
    assignments: {},
    summary: 'ラウンド要約',
    shouldTerminate: false,
    consensusScore: 0.3,
    ...overrides,
  });
}

describe('CollaborationSession', () => {
  it('should run rounds until maxRounds and produce a result', async () => {
    const llm = createMockLLMClient({
      facilitationResponses: [
        makeFacilitationJson({ nextPhase: 'discussion', consensusScore: 0.3 }),
        makeFacilitationJson({ nextPhase: 'drafting', consensusScore: 0.5 }),
        makeFacilitationJson({ nextPhase: 'review', consensusScore: 0.6, shouldTerminate: false }),
      ],
      composeFinalResponse: '完成テキスト',
    });

    const session = new CollaborationSession(
      llm,
      createMockSoulText(),
      writerConfigs,
      testConfig,
    );

    const result = await session.run('テストプロンプト');

    expect(result.rounds).toHaveLength(3);
    expect(result.finalText).toBe('完成テキスト');
    expect(result.participants).toEqual(['w1', 'w2']);
    expect(result.totalTokensUsed).toBeGreaterThan(0);
    expect(result.consensusScore).toBe(0.6);
  });

  it('should terminate early when consensus threshold is reached and drafts exist', async () => {
    const draftResponse: ToolCallResponse = {
      toolCalls: [{
        id: 'call_d',
        type: 'function',
        function: {
          name: 'submit_draft',
          arguments: JSON.stringify({ section: 'opening', text: '冒頭テキスト' }),
        },
      }],
      content: null,
      tokensUsed: 50,
    };

    const llm = createMockLLMClient({
      facilitationResponses: [
        makeFacilitationJson({ nextPhase: 'drafting', consensusScore: 0.5, shouldTerminate: false }),
        makeFacilitationJson({ consensusScore: 0.9, shouldTerminate: true }),
      ],
      writerToolResponses: [draftResponse],
      composeFinalResponse: '合意テキスト',
    });

    const session = new CollaborationSession(
      llm,
      createMockSoulText(),
      writerConfigs,
      testConfig,
    );

    const result = await session.run('テスト');

    expect(result.rounds).toHaveLength(2);
    expect(result.consensusScore).toBe(0.9);
    expect(result.finalText).toBe('合意テキスト');
  });

  it('should not terminate when shouldTerminate is true but no drafts exist', async () => {
    const llm = createMockLLMClient({
      facilitationResponses: [
        makeFacilitationJson({ consensusScore: 0.9, shouldTerminate: true }),
        makeFacilitationJson({ consensusScore: 0.9, shouldTerminate: true }),
        makeFacilitationJson({ consensusScore: 0.9, shouldTerminate: true }),
      ],
      composeFinalResponse: 'テキスト',
    });

    const session = new CollaborationSession(
      llm,
      createMockSoulText(),
      writerConfigs,
      testConfig,
    );

    const result = await session.run('テスト');

    // No drafts → runs all 3 rounds without early termination
    expect(result.rounds).toHaveLength(3);
  });

  it('should extend rounds when moderator requests continueRounds', async () => {
    // maxRounds=2, round 1 requests continueRounds=3
    // After round 1: remaining=1, but extension=3 > 1 → remaining=3
    // Total possible: 1 (done) + 3 (remaining) = 4 rounds
    const llm = createMockLLMClient({
      facilitationResponses: [
        makeFacilitationJson({ consensusScore: 0.3, continueRounds: 3 }),
        makeFacilitationJson({ consensusScore: 0.4 }),
        makeFacilitationJson({ consensusScore: 0.5 }),
        makeFacilitationJson({ consensusScore: 0.6 }),
      ],
      composeFinalResponse: '延長テキスト',
    });

    const session = new CollaborationSession(
      llm,
      createMockSoulText(),
      writerConfigs,
      { maxRounds: 2, writerCount: 2, earlyTerminationThreshold: 0.8 },
    );

    const result = await session.run('テスト');

    // Original maxRounds=2, but extended to 4 by continueRounds=3
    expect(result.rounds.length).toBe(4);
    expect(result.finalText).toBe('延長テキスト');
  });

  it('should not exceed safety limit even with continueRounds requests', async () => {
    // Create many facilitation responses that always request more rounds
    const responses = Array.from({ length: 25 }, () =>
      makeFacilitationJson({ consensusScore: 0.3, continueRounds: 5 }),
    );

    const llm = createMockLLMClient({
      facilitationResponses: responses,
      composeFinalResponse: '安全停止テキスト',
    });

    const session = new CollaborationSession(
      llm,
      createMockSoulText(),
      writerConfigs,
      { maxRounds: 3, writerCount: 2, earlyTerminationThreshold: 0.8 },
    );

    const result = await session.run('テスト');

    // Safety limit is 20
    expect(result.rounds.length).toBeLessThanOrEqual(20);
  });

  it('should accumulate drafts from draft actions across rounds', async () => {
    const draftResponse: ToolCallResponse = {
      toolCalls: [{
        id: 'call_d',
        type: 'function',
        function: {
          name: 'submit_draft',
          arguments: JSON.stringify({ section: 'opening', text: '冒頭のテキスト' }),
        },
      }],
      content: null,
      tokensUsed: 50,
    };

    const llm = createMockLLMClient({
      facilitationResponses: [
        makeFacilitationJson({
          nextPhase: 'drafting',
          assignments: { opening: 'w1' },
          shouldTerminate: true,
          consensusScore: 0.9,
        }),
      ],
      writerToolResponses: [draftResponse],
      composeFinalResponse: '統合テキスト',
    });

    const session = new CollaborationSession(
      llm,
      createMockSoulText(),
      writerConfigs,
      testConfig,
    );

    const result = await session.run('テスト');

    expect(result.finalText).toBe('統合テキスト');
    expect(result.rounds).toHaveLength(1);
  });
});
