import { describe, it, expect, vi } from 'vitest';
import { createModerator, type ModeratorDeps } from '../../src/collaboration/moderator.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { CollaborationState, CollaborationAction } from '../../src/collaboration/types.js';

function createMockLLMForModerator(toolArgsJson: string): LLMClient {
  let tokens = 0;
  return {
    complete: vi.fn().mockImplementation(() => {
      tokens += 100;
      return Promise.resolve(toolArgsJson);
    }),
    completeWithTools: vi.fn().mockImplementation(() => {
      tokens += 100;
      return Promise.resolve({
        toolCalls: [{
          id: 'tc-1',
          type: 'function',
          function: {
            name: 'submit_facilitation',
            arguments: toolArgsJson,
          },
        }],
        content: null,
        tokensUsed: 100,
      });
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
    llmClient: createMockLLMForModerator(JSON.stringify({
      nextPhase: 'discussion',
      assignments: {},
      summary: 'デフォルト要約',
      shouldTerminate: false,
      consensusScore: 0.3,
    })),
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
    it('should parse facilitation result from tool call', async () => {
      const deps = createDeps({
        llmClient: createMockLLMForModerator(JSON.stringify({
          nextPhase: 'discussion',
          assignments: { opening: 'writer_1', climax: 'writer_2' },
          summary: 'Writer 1が冒頭を提案。',
          shouldTerminate: false,
          consensusScore: 0.3,
        })),
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
      expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
    });

    it('should handle shouldTerminate=true with high consensus', async () => {
      const deps = createDeps({
        llmClient: createMockLLMForModerator(JSON.stringify({
          nextPhase: 'review',
          assignments: {},
          summary: '合意形成完了',
          shouldTerminate: true,
          consensusScore: 0.9,
        })),
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

    it('should fallback on invalid tool arguments', async () => {
      const deps = createDeps({
        llmClient: createMockLLMForModerator('not json'),
      });
      const moderator = createModerator(deps);

      const result = await moderator.facilitateRound(createEmptyState(), [], []);

      expect(result.summary).toContain('解析に失敗');
      expect(result.shouldTerminate).toBe(false);
      expect(result.consensusScore).toBe(0);
    });

    it('should throw when llmClient does not support tool calling', async () => {
      const deps = createDeps({
        llmClient: {
          complete: vi.fn().mockResolvedValue(''),
          getTotalTokens: vi.fn().mockReturnValue(0),
          // no completeWithTools
        },
      });
      const moderator = createModerator(deps);

      await expect(
        moderator.facilitateRound(createEmptyState(), [], []),
      ).rejects.toThrow('LLMClient does not support tool calling');
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
          completeWithTools: vi.fn(),
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
});
