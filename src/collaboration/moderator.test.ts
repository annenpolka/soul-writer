import { describe, it, expect, vi } from 'vitest';
import { ModeratorAgent } from './moderator.js';
import { createMockSoulText } from '../../tests/helpers/mock-soul-text.js';
import type { LLMClient } from '../llm/types.js';
import type { CollaborationState, CollaborationAction } from './types.js';

function createMockLLMClient(response: string): LLMClient {
  let tokens = 0;
  return {
    complete: vi.fn().mockImplementation(() => {
      tokens += 100;
      return Promise.resolve(response);
    }),
    completeWithTools: vi.fn().mockImplementation(() => {
      tokens += 100;
      return Promise.resolve({
        toolCalls: [{
          id: 'tc-1',
          type: 'function',
          function: {
            name: 'submit_facilitation',
            arguments: response,
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

describe('ModeratorAgent', () => {
  describe('facilitateRound', () => {
    it('should use tool calling for facilitation', async () => {
      const llm: LLMClient = {
        complete: vi.fn().mockResolvedValue('ignored text'),
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: {
              name: 'submit_facilitation',
              arguments: JSON.stringify({
                nextPhase: 'discussion',
                assignments: { opening: 'writer_1' },
                summary: 'ツール経由の要約',
                shouldTerminate: false,
                consensusScore: 0.2,
                continueRounds: 0,
              }),
            },
          }],
          content: null,
          tokensUsed: 50,
        }),
        getTotalTokens: vi.fn().mockReturnValue(100),
      };
      const soulText = createMockSoulText();
      const moderator = new ModeratorAgent(llm, soulText);

      const result = await moderator.facilitateRound(createEmptyState(), [], []);

      expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
      expect(result.nextPhase).toBe('discussion');
    });

    it('should parse facilitation result from LLM response', async () => {
      const llm = createMockLLMClient(JSON.stringify({
        nextPhase: 'discussion',
        assignments: { opening: 'writer_1', climax: 'writer_2' },
        summary: 'Writer 1が冒頭の方向性を提案。Writer 2がクライマックスを担当希望。',
        shouldTerminate: false,
        consensusScore: 0.3,
      }));
      const soulText = createMockSoulText();
      const moderator = new ModeratorAgent(llm, soulText);

      const actions: CollaborationAction[] = [
        { type: 'proposal', writerId: 'writer_1', content: '冒頭は透心の独白から' },
        { type: 'volunteer', writerId: 'writer_2', section: 'climax', reason: '殺害シーンが得意' },
      ];

      const result = await moderator.facilitateRound(
        createEmptyState(),
        actions,
        [{ id: 'writer_1', name: '語り手', focusCategories: ['opening'] },
         { id: 'writer_2', name: '職人', focusCategories: ['killing'] }],
      );

      expect(result.nextPhase).toBe('discussion');
      expect(result.assignments).toEqual({ opening: 'writer_1', climax: 'writer_2' });
      expect(result.shouldTerminate).toBe(false);
      expect(result.consensusScore).toBe(0.3);
      expect(result.summary).toContain('Writer 1');
    });

    it('should handle shouldTerminate=true when consensus is high', async () => {
      const llm = createMockLLMClient(JSON.stringify({
        nextPhase: 'review',
        assignments: {},
        summary: '全Writerが方向性に合意。草稿フェーズに移行可能。',
        shouldTerminate: true,
        consensusScore: 0.9,
      }));
      const soulText = createMockSoulText();
      const moderator = new ModeratorAgent(llm, soulText);

      const result = await moderator.facilitateRound(
        createEmptyState({ currentPhase: 'discussion' }),
        [],
        [],
      );

      expect(result.shouldTerminate).toBe(true);
      expect(result.consensusScore).toBe(0.9);
    });

    it('should fallback on invalid tool arguments', async () => {
      const llm = createMockLLMClient('not json');
      const soulText = createMockSoulText();
      const moderator = new ModeratorAgent(llm, soulText);

      const result = await moderator.facilitateRound(createEmptyState(), [], []);

      expect(result.summary).toContain('解析に失敗');
    });
  });

  describe('composeFinal', () => {
    it('should return composed final text from LLM', async () => {
      const llm = createMockLLMClient('透心は窓の外を見つめていた。ARタグが剥がれかけた空が、嘘みたいに青い。');
      const soulText = createMockSoulText();
      const moderator = new ModeratorAgent(llm, soulText);

      const drafts: Record<string, string> = {
        opening: '透心は窓の外を見つめていた。',
        climax: 'ARタグが剥がれかけた空が、嘘みたいに青い。',
      };
      const feedback = [
        { type: 'feedback' as const, writerId: 'writer_2', targetWriterId: 'writer_1',
          feedback: '接続を滑らかに', sentiment: 'suggest_revision' as const },
      ];

      const result = await moderator.composeFinal(drafts, feedback);

      expect(result.text).toContain('透心');
      expect(result.tokensUsed).toBeGreaterThan(0);
    });
  });
});
