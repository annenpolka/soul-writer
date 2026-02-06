import { describe, it, expect, vi } from 'vitest';
import { createCollaborationSession, type CollaborationSessionDeps } from '../../src/collaboration/session.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { WriterConfig } from '../../src/agents/types.js';

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
 * Creates a mock LLM that handles both tool-calling (for writers and moderator)
 * and plain completion (for composeFinal).
 *
 * The moderator facilitateRound flow:
 *  - round 1: proposal phase → transitions to drafting, not terminate
 *  - round 2: drafting phase → transitions to review, terminate with consensus
 *
 * Writers: always return a proposal or draft depending on phase.
 */
function createCollaborationLLM(): LLMClient {
  let tokens = 0;
  let facilitateCallCount = 0;

  return {
    complete: vi.fn().mockImplementation(() => {
      tokens += 200;
      return Promise.resolve('統合された最終テキスト: 透心は息をひそめた。');
    }),
    completeWithTools: vi.fn().mockImplementation((_sys: string, _user: string, tools: any[]) => {
      tokens += 100;

      // Detect if this is a moderator call (submit_facilitation tool)
      const isModerator = tools.some((t: any) => t.function.name === 'submit_facilitation');

      if (isModerator) {
        facilitateCallCount++;
        if (facilitateCallCount === 1) {
          // First round: move to drafting
          return Promise.resolve({
            toolCalls: [{
              id: 'tc-mod-1',
              type: 'function',
              function: {
                name: 'submit_facilitation',
                arguments: JSON.stringify({
                  nextPhase: 'drafting',
                  assignments: { opening: 'writer_1', climax: 'writer_2' },
                  summary: '担当割り振り完了。草稿フェーズへ。',
                  shouldTerminate: false,
                  consensusScore: 0.4,
                }),
              },
            }],
            content: null,
            tokensUsed: 100,
          });
        }
        // Second round: terminate with consensus
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-mod-2',
            type: 'function',
            function: {
              name: 'submit_facilitation',
              arguments: JSON.stringify({
                nextPhase: 'review',
                assignments: {},
                summary: '草稿完了。合意形成。',
                shouldTerminate: true,
                consensusScore: 0.9,
              }),
            },
          }],
          content: null,
          tokensUsed: 100,
        });
      }

      // Writer call - check if only submit_draft tool is available (drafting phase)
      const hasDraftOnly = tools.length === 1 && tools[0].function.name === 'submit_draft';

      if (hasDraftOnly) {
        return Promise.resolve({
          toolCalls: [{
            id: 'tc-w-draft',
            type: 'function',
            function: {
              name: 'submit_draft',
              arguments: JSON.stringify({
                section: 'opening',
                text: '透心は息をひそめた。窓の外のARタグが、静かに剥がれ落ちていく。',
              }),
            },
          }],
          content: null,
          tokensUsed: 50,
        });
      }

      // Writer call - proposal phase
      return Promise.resolve({
        toolCalls: [{
          id: 'tc-w-1',
          type: 'function',
          function: {
            name: 'submit_proposal',
            arguments: JSON.stringify({
              content: '冒頭は透心の内面独白から始める',
            }),
          },
        }],
        content: null,
        tokensUsed: 50,
      });
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
      const neverTerminateLLM: LLMClient = {
        complete: vi.fn().mockImplementation(() => {
          tokens += 100;
          return Promise.resolve('最終テキスト');
        }),
        completeWithTools: vi.fn().mockImplementation((_sys: string, _user: string, tools: any[]) => {
          tokens += 50;
          const isModerator = tools.some((t: any) => t.function.name === 'submit_facilitation');
          if (isModerator) {
            return Promise.resolve({
              toolCalls: [{
                id: 'tc-1',
                type: 'function',
                function: {
                  name: 'submit_facilitation',
                  arguments: JSON.stringify({
                    nextPhase: 'proposal',
                    assignments: {},
                    summary: '続行',
                    shouldTerminate: false,
                    consensusScore: 0.1,
                  }),
                },
              }],
              content: null,
              tokensUsed: 50,
            });
          }
          return Promise.resolve({
            toolCalls: [{
              id: 'tc-w',
              type: 'function',
              function: {
                name: 'submit_proposal',
                arguments: JSON.stringify({ content: '提案' }),
              },
            }],
            content: null,
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
