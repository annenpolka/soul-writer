import { describe, it, expect, vi } from 'vitest';
import { createCollaborationSession, type CollaborationSessionDeps } from '../../src/collaboration/session.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { LLMClient, StructuredResponse } from '../../src/llm/types.js';
import type { WriterConfig } from '../../src/agents/types.js';
import type { FacilitationResult } from '../../src/collaboration/types.js';
import type { CollaborationActionRaw } from '../../src/schemas/collaboration-action.js';

function createWriterConfigs(): WriterConfig[] {
  return [
    {
      id: 'writer_1',
      personaName: '語り手',
      personaDirective: '冒頭の独白を担当',
      focusCategories: ['opening'],
      temperature: 0.7,
      topP: 0.9,
    },
    {
      id: 'writer_2',
      personaName: '職人',
      personaDirective: 'クライマックスを担当',
      focusCategories: ['killing'],
      temperature: 0.8,
      topP: 0.9,
    },
  ];
}

/**
 * Creates a mock LLM that handles both structured output (for writers and moderator)
 * and plain completion (for composeFinal).
 *
 * The completeStructured mock needs to distinguish between:
 * - Writer calls (return CollaborationActionRaw)
 * - Moderator calls (return FacilitationResult)
 *
 * Since completeStructured takes a schema as 2nd arg, we use call count to determine behavior:
 * Writers go first in each round, then moderator.
 * Round 1: 2 writer proposals + 1 moderator facilitation (transition to drafting)
 * Round 2: 2 writer drafts + 1 moderator facilitation (terminate with consensus)
 */
function createCollaborationLLM(): LLMClient {
  let tokens = 0;
  let structuredCallCount = 0;

  return {
    complete: vi.fn().mockImplementation(() => {
      tokens += 200;
      return Promise.resolve('統合された最終テキスト: 透心は息をひそめた。');
    }),
    completeStructured: vi.fn().mockImplementation(() => {
      tokens += 100;
      structuredCallCount++;

      // Calls 1-2: writer proposals (round 1)
      if (structuredCallCount <= 2) {
        const data: CollaborationActionRaw = {
          action: 'proposal',
          content: '冒頭は透心の内面独白から始める',
        };
        return Promise.resolve({
          data,
          reasoning: null,
          tokensUsed: 50,
        } satisfies StructuredResponse<CollaborationActionRaw>);
      }

      // Call 3: moderator facilitation (transition to drafting)
      if (structuredCallCount === 3) {
        const data: FacilitationResult = {
          nextPhase: 'drafting',
          assignments: { opening: 'writer_1', climax: 'writer_2' },
          summary: '担当割り振り完了。草稿フェーズへ。',
          shouldTerminate: false,
          consensusScore: 0.4,
          continueRounds: 0,
        };
        return Promise.resolve({
          data,
          reasoning: null,
          tokensUsed: 100,
        } satisfies StructuredResponse<FacilitationResult>);
      }

      // Calls 4-5: writer drafts (round 2)
      if (structuredCallCount <= 5) {
        const data: CollaborationActionRaw = {
          action: 'draft',
          section: 'opening',
          text: '透心は息をひそめた。窓の外のARタグが、静かに剥がれ落ちていく。',
        };
        return Promise.resolve({
          data,
          reasoning: null,
          tokensUsed: 50,
        } satisfies StructuredResponse<CollaborationActionRaw>);
      }

      // Call 6: moderator facilitation (terminate)
      const data: FacilitationResult = {
        nextPhase: 'review',
        assignments: {},
        summary: '草稿完了。合意形成。',
        shouldTerminate: true,
        consensusScore: 0.9,
        continueRounds: 0,
      };
      return Promise.resolve({
        data,
        reasoning: null,
        tokensUsed: 100,
      } satisfies StructuredResponse<FacilitationResult>);
    }),
    getTotalTokens: vi.fn().mockImplementation(() => tokens),
  };
}

function createDeps(overrides?: Partial<CollaborationSessionDeps>): CollaborationSessionDeps {
  return {
    llmClient: createCollaborationLLM(),
    soulText: createMockSoulText(),
    writerConfigs: createWriterConfigs(),
    config: { maxRounds: 5, writerCount: 2, earlyTerminationThreshold: 0.8 },
    ...overrides,
  };
}

describe('createCollaborationSession', () => {
  it('should return an object with run function', () => {
    const session = createCollaborationSession(createDeps());
    expect(typeof session.run).toBe('function');
  });

  describe('run', () => {
    it('should execute collaboration rounds and return final result', async () => {
      const deps = createDeps();
      const session = createCollaborationSession(deps);

      const result = await session.run('テスト用プロンプト');

      expect(result.finalText).toContain('透心');
      expect(result.participants).toEqual(['writer_1', 'writer_2']);
      expect(result.rounds.length).toBeGreaterThanOrEqual(1);
      expect(result.totalTokensUsed).toBeGreaterThan(0);
      expect(result.consensusScore).toBeGreaterThan(0);
    });

    it('should terminate early when consensus is reached', async () => {
      const deps = createDeps();
      const session = createCollaborationSession(deps);

      const result = await session.run('テスト');

      // Should terminate on round 2 (consensus 0.9 >= threshold 0.8)
      expect(result.rounds.length).toBe(2);
      expect(result.consensusScore).toBe(0.9);
    });

    it('should respect maxRounds limit', async () => {
      let tokens = 0;
      let callCount = 0;
      const neverTerminateLLM: LLMClient = {
        complete: vi.fn().mockImplementation(() => {
          tokens += 100;
          return Promise.resolve('最終テキスト');
        }),
        completeStructured: vi.fn().mockImplementation(() => {
          tokens += 50;
          callCount++;
          // Every 3rd call is moderator (after 2 writers)
          if (callCount % 3 === 0) {
            return Promise.resolve({
              data: {
                nextPhase: 'proposal',
                assignments: {},
                summary: '続行',
                shouldTerminate: false,
                consensusScore: 0.1,
                continueRounds: 0,
              },
              reasoning: null,
              tokensUsed: 50,
            });
          }
          return Promise.resolve({
            data: {
              action: 'proposal',
              content: '提案',
            },
            reasoning: null,
            tokensUsed: 50,
          });
        }),
        getTotalTokens: vi.fn().mockImplementation(() => tokens),
      };

      const session = createCollaborationSession({
        ...createDeps(),
        llmClient: neverTerminateLLM,
        config: { maxRounds: 3, writerCount: 2, earlyTerminationThreshold: 0.8 },
      });

      const result = await session.run('テスト');

      expect(result.rounds.length).toBe(3);
      expect(result.consensusScore).toBe(0.1);
    });

    it('should collect drafts from writer actions', async () => {
      const deps = createDeps();
      const session = createCollaborationSession(deps);

      const result = await session.run('テスト');

      // The second round is drafting where writers submit drafts
      const draftActions = result.rounds
        .flatMap((r) => r.actions)
        .filter((a) => a.type === 'draft');
      expect(draftActions.length).toBeGreaterThan(0);
    });
  });
});
