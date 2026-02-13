import { describe, it, expect, vi } from 'vitest';
import { createModerator, type ModeratorDeps } from '../../src/collaboration/moderator.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { LLMClient, StructuredResponse, LLMMessage } from '../../src/llm/types.js';
import type { CollaborationState, CollaborationAction, FacilitationResult } from '../../src/collaboration/types.js';

function createMockLLMForModerator(facilitationData: FacilitationResult): LLMClient {
  let tokens = 0;
  return {
    complete: vi.fn().mockImplementation(() => {
      tokens += 100;
      return Promise.resolve('composed text');
    }),
    completeStructured: vi.fn().mockImplementation(() => {
      tokens += 100;
      return Promise.resolve({
        data: facilitationData,
        reasoning: null,
        tokensUsed: 100,
      } satisfies StructuredResponse<FacilitationResult>);
    }),
    getTotalTokens: vi.fn().mockImplementation(() => tokens),
  };
}

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

function createDeps(overrides?: Partial<ModeratorDeps>): ModeratorDeps {
  return {
    llmClient: createMockLLMForModerator({
      nextPhase: 'discussion',
      assignments: {},
      summary: 'デフォルト要約',
      shouldTerminate: false,
      consensusScore: 0.3,
      continueRounds: 0,
    }),
    soulText: createMockSoulText(),
    ...overrides,
  };
}

describe('createModerator', () => {
  it('should return an object with facilitateRound and composeFinal', () => {
    const moderator = createModerator(createDeps());

    expect(typeof moderator.facilitateRound).toBe('function');
    expect(typeof moderator.composeFinal).toBe('function');
  });

  describe('facilitateRound', () => {
    it('should parse facilitation result from structured response', async () => {
      const deps = createDeps({
        llmClient: createMockLLMForModerator({
          nextPhase: 'discussion',
          assignments: { opening: 'writer_1', climax: 'writer_2' },
          summary: 'Writer 1が冒頭を提案。',
          shouldTerminate: false,
          consensusScore: 0.3,
          continueRounds: 0,
        }),
      });
      const moderator = createModerator(deps);

      const actions: CollaborationAction[] = [
        { type: 'proposal', writerId: 'writer_1', content: '冒頭は透心の独白から' },
      ];

      const result = await moderator.facilitateRound(
        createEmptyState(),
        actions,
        [{ id: 'writer_1', name: '語り手', focusCategories: ['opening'] }],
      );

      expect(result.nextPhase).toBe('discussion');
      expect(result.assignments).toEqual({ opening: 'writer_1', climax: 'writer_2' });
      expect(result.shouldTerminate).toBe(false);
      expect(result.consensusScore).toBe(0.3);
      expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(1);
    });

    it('should handle shouldTerminate=true with high consensus', async () => {
      const deps = createDeps({
        llmClient: createMockLLMForModerator({
          nextPhase: 'review',
          assignments: {},
          summary: '合意形成完了',
          shouldTerminate: true,
          consensusScore: 0.9,
          continueRounds: 0,
        }),
      });
      const moderator = createModerator(deps);

      const result = await moderator.facilitateRound(
        createEmptyState({ currentPhase: 'discussion' }),
        [],
        [],
      );

      expect(result.shouldTerminate).toBe(true);
      expect(result.consensusScore).toBe(0.9);
    });

    it('should fallback on completeStructured failure', async () => {
      const deps = createDeps({
        llmClient: {
          complete: vi.fn().mockResolvedValue(''),
          completeStructured: vi.fn().mockRejectedValue(new Error('parse error')),
          getTotalTokens: vi.fn().mockReturnValue(0),
        },
      });
      const moderator = createModerator(deps);

      const result = await moderator.facilitateRound(createEmptyState(), [], []);

      expect(result.summary).toContain('解析に失敗');
      expect(result.shouldTerminate).toBe(false);
      expect(result.consensusScore).toBe(0);
    });

    it('should use temperature 1.0', async () => {
      const deps = createDeps();
      const moderator = createModerator(deps);

      await moderator.facilitateRound(createEmptyState(), [], []);

      const call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[0];
      const options = call[2] as { temperature?: number };
      expect(options.temperature).toBe(1.0);
    });
  });

  describe('composeFinal', () => {
    it('should compose final text from drafts and feedback', async () => {
      const responseText = '透心は窓の外を見つめていた。ARタグが剥がれかけた空が、嘘みたいに青い。';
      let tokens = 0;
      const deps = createDeps({
        llmClient: {
          complete: vi.fn().mockImplementation(() => {
            tokens += 100;
            return Promise.resolve(responseText);
          }),
          completeStructured: vi.fn(),
          getTotalTokens: vi.fn().mockImplementation(() => tokens),
        },
      });
      const moderator = createModerator(deps);

      const drafts = {
        opening: '透心は窓の外を見つめていた。',
        climax: 'ARタグが剥がれかけた空が、嘘みたいに青い。',
      };
      const feedback = [
        {
          type: 'feedback' as const,
          writerId: 'writer_2',
          targetWriterId: 'writer_1',
          feedback: '接続を滑らかに',
          sentiment: 'suggest_revision' as const,
        },
      ];

      const result = await moderator.composeFinal(drafts, feedback);

      expect(result.text).toContain('透心');
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('multi-turn conversation accumulation', () => {
    function createMultiTurnModeratorDeps(): { deps: ModeratorDeps; messageSnapshots: Array<Array<{ role: string; content: string }>> } {
      const messageSnapshots: Array<Array<{ role: string; content: string }>> = [];
      let callCount = 0;
      let tokens = 0;

      const responses: FacilitationResult[] = [
        { nextPhase: 'discussion', assignments: { opening: 'writer_1' }, summary: 'Round 1 done', shouldTerminate: false, consensusScore: 0.3, continueRounds: 0 },
        { nextPhase: 'drafting', assignments: {}, summary: 'Round 2 done', shouldTerminate: false, consensusScore: 0.6, continueRounds: 0 },
        { nextPhase: 'review', assignments: {}, summary: 'Round 3 done', shouldTerminate: true, consensusScore: 0.9, continueRounds: 0 },
      ];

      const llmClient: LLMClient = {
        complete: vi.fn().mockImplementation(() => {
          tokens += 100;
          return Promise.resolve('composed text');
        }),
        completeStructured: vi.fn().mockImplementation((messages: any) => {
          messageSnapshots.push([...messages]);
          const data = responses[callCount] ?? responses[0];
          callCount++;
          tokens += 100;
          return Promise.resolve({
            data,
            reasoning: callCount === 1 ? 'facilitation reasoning round 1' : null,
            tokensUsed: 100,
          } satisfies StructuredResponse<FacilitationResult>);
        }),
        getTotalTokens: vi.fn().mockImplementation(() => tokens),
      };

      return {
        deps: { llmClient, soulText: createMockSoulText() },
        messageSnapshots,
      };
    }

    const sampleActions: CollaborationAction[] = [
      { type: 'proposal', writerId: 'writer_1', content: 'テスト提案' },
    ];
    const sampleWriters = [{ id: 'writer_1', name: '語り手' }];

    it('should accumulate messages across multiple facilitateRound() calls', async () => {
      const { deps, messageSnapshots } = createMultiTurnModeratorDeps();
      const moderator = createModerator(deps);

      // Round 1
      await moderator.facilitateRound(createEmptyState(), sampleActions, sampleWriters);
      // Round 2
      await moderator.facilitateRound(
        createEmptyState({ currentPhase: 'discussion' }),
        sampleActions,
        sampleWriters,
      );

      // First call: system + user = 2 messages
      expect(messageSnapshots[0]).toHaveLength(2);
      expect(messageSnapshots[0][0].role).toBe('system');
      expect(messageSnapshots[0][1].role).toBe('user');

      // Second call: system + user + assistant + user = 4 messages
      expect(messageSnapshots[1]).toHaveLength(4);
      expect(messageSnapshots[1][0].role).toBe('system');
      expect(messageSnapshots[1][1].role).toBe('user');
      expect(messageSnapshots[1][2].role).toBe('assistant');
      expect(messageSnapshots[1][3].role).toBe('user');
    });

    it('should include reasoning from prior round in assistant message', async () => {
      const { deps, messageSnapshots } = createMultiTurnModeratorDeps();
      const moderator = createModerator(deps);

      // Round 1 (returns reasoning: 'facilitation reasoning round 1')
      await moderator.facilitateRound(createEmptyState(), sampleActions, sampleWriters);
      // Round 2
      await moderator.facilitateRound(
        createEmptyState({ currentPhase: 'discussion' }),
        sampleActions,
        sampleWriters,
      );

      const assistantMsg = messageSnapshots[1][2] as any;
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.reasoning).toBe('facilitation reasoning round 1');
    });

    it('should accumulate 3 rounds correctly (6 messages on 3rd call)', async () => {
      const { deps, messageSnapshots } = createMultiTurnModeratorDeps();
      const moderator = createModerator(deps);

      await moderator.facilitateRound(createEmptyState(), sampleActions, sampleWriters);
      await moderator.facilitateRound(createEmptyState({ currentPhase: 'discussion' }), sampleActions, sampleWriters);
      await moderator.facilitateRound(createEmptyState({ currentPhase: 'drafting' }), sampleActions, sampleWriters);

      // 3rd call: system + user + assistant + user + assistant + user = 6
      expect(messageSnapshots[2]).toHaveLength(6);
      expect(messageSnapshots[2][4].role).toBe('assistant');
      expect(messageSnapshots[2][5].role).toBe('user');
    });

    it('composeFinal should NOT share conversation state with facilitateRound (separate conversation)', async () => {
      const { deps } = createMultiTurnModeratorDeps();
      const moderator = createModerator(deps);

      // Do one facilitation round
      await moderator.facilitateRound(createEmptyState(), sampleActions, sampleWriters);

      // composeFinal should use fresh conversation, not accumulated messages
      await moderator.composeFinal(
        { opening: 'テスト草稿' },
        [],
      );

      // complete() should have been called (not completeStructured), confirming separate conversation
      expect(deps.llmClient.complete).toHaveBeenCalledTimes(1);
    });
  });
});
