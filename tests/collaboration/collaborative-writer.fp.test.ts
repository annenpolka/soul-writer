import { describe, it, expect, vi } from 'vitest';
import { createCollaborativeWriter, type CollaborativeWriterDeps } from '../../src/collaboration/collaborative-writer.js';
import { createMockLLMClientWithStructured, createMockThemeContext } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { CollaborationState } from '../../src/collaboration/types.js';
import type { WriterConfig } from '../../src/agents/types.js';
import type { CollaborationActionRaw } from '../../src/schemas/collaboration-action.js';
import type { LLMClient, StructuredResponse } from '../../src/llm/types.js';

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

function createWriterConfig(overrides?: Partial<WriterConfig>): WriterConfig {
  return {
    id: 'writer_1',
    personaName: '語り手',
    personaDirective: '冒頭の独白を担当',
    focusCategories: ['opening', 'introspection'],
    temperature: 0.7,
    topP: 0.9,
    ...overrides,
  };
}

function createDeps(overrides?: Partial<CollaborativeWriterDeps>): CollaborativeWriterDeps {
  const defaultData: CollaborationActionRaw = {
    action: 'proposal',
    content: 'テスト提案',
  };
  return {
    llmClient: createMockLLMClientWithStructured(defaultData),
    soulText: createMockSoulText(),
    config: createWriterConfig(),
    ...overrides,
  };
}

describe('createCollaborativeWriter', () => {
  it('should return an object with id, name, focusCategories, and participate', () => {
    const writer = createCollaborativeWriter(createDeps());

    expect(writer.id).toBe('writer_1');
    expect(writer.name).toBe('語り手');
    expect(writer.focusCategories).toEqual(['opening', 'introspection']);
    expect(typeof writer.participate).toBe('function');
  });

  it('should use config.id as name when personaName is not set', () => {
    const writer = createCollaborativeWriter(createDeps({
      config: createWriterConfig({ personaName: undefined }),
    }));

    expect(writer.name).toBe('writer_1');
  });

  describe('participate', () => {
    it('should call completeStructured and parse action', async () => {
      const deps = createDeps();
      const writer = createCollaborativeWriter(deps);

      const actions = await writer.participate(createEmptyState(), 'テスト用プロンプト');

      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        type: 'proposal',
        writerId: 'writer_1',
        content: 'テスト提案',
      });
      expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(1);
    });

    it('should parse draft action correctly', async () => {
      const draftData: CollaborationActionRaw = {
        action: 'draft',
        section: 'opening',
        text: '透心は窓の外を見つめていた。',
      };
      const deps = createDeps({
        llmClient: createMockLLMClientWithStructured(draftData),
      });
      const writer = createCollaborativeWriter(deps);

      const state = createEmptyState({ currentPhase: 'drafting' });
      const actions = await writer.participate(state, 'テスト');

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('draft');
      if (actions[0].type === 'draft') {
        expect(actions[0].section).toBe('opening');
        expect(actions[0].text).toBe('透心は窓の外を見つめていた。');
      }
    });

    it('should fallback to a proposal on repeated failures', async () => {
      const deps = createDeps({
        llmClient: {
          complete: vi.fn().mockResolvedValue(''),
          completeStructured: vi.fn().mockRejectedValue(new Error('LLM error')),
          getTotalTokens: vi.fn().mockReturnValue(0),
        },
      });
      const writer = createCollaborativeWriter(deps);

      const actions = await writer.participate(createEmptyState(), 'test');

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('proposal');
      expect(actions[0].writerId).toBe('writer_1');
      expect((actions[0] as any).content).toContain('失敗');
      // Should have retried 3 times (0, 1, 2)
      expect(deps.llmClient.completeStructured).toHaveBeenCalledTimes(3);
    });

    it('should include theme context in system prompt when provided', async () => {
      const deps = createDeps({
        themeContext: createMockThemeContext({ emotion: '焦燥', tone: '鋭利' }),
      });
      const writer = createCollaborativeWriter(deps);

      await writer.participate(createEmptyState(), 'テスト');

      const call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[0];
      const messages = call[0] as Array<{ role: string; content: string }>;
      const systemMsg = messages.find(m => m.role === 'system');
      expect(systemMsg?.content).toContain('焦燥');
      expect(systemMsg?.content).toContain('鋭利');
    });

    it('should include round history in user prompt', async () => {
      const deps = createDeps();
      const writer = createCollaborativeWriter(deps);

      const state = createEmptyState({
        rounds: [{
          roundNumber: 1,
          phase: 'proposal',
          actions: [{ type: 'proposal', writerId: 'writer_2', content: '前回の提案' }],
          moderatorSummary: 'ラウンド1の要約',
        }],
      });

      await writer.participate(state, 'テスト');

      const call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[0];
      const messages = call[0] as Array<{ role: string; content: string }>;
      const userMsg = messages.find(m => m.role === 'user');
      expect(userMsg?.content).toContain('ラウンド1の要約');
      expect(userMsg?.content).toContain('前回の提案');
    });

    it('should use temperature 1.0', async () => {
      const deps = createDeps();
      const writer = createCollaborativeWriter(deps);

      await writer.participate(createEmptyState(), 'テスト');

      const call = (deps.llmClient.completeStructured as ReturnType<typeof vi.fn>).mock.calls[0];
      const options = call[2] as { temperature?: number };
      expect(options.temperature).toBe(1.0);
    });
  });

  describe('multi-turn conversation accumulation', () => {
    function createMultiTurnDeps(): { deps: CollaborativeWriterDeps; messageSnapshots: Array<Array<{ role: string; content: string }>> } {
      const messageSnapshots: Array<Array<{ role: string; content: string }>> = [];
      let callCount = 0;

      const responses: CollaborationActionRaw[] = [
        { action: 'proposal', content: 'Round 1 proposal' },
        { action: 'feedback', targetWriterId: 'writer_2', feedback: 'Round 2 feedback', sentiment: 'suggest_revision' },
        { action: 'draft', section: 'opening', text: 'Round 3 draft text' },
      ];

      const llmClient: LLMClient = {
        complete: vi.fn().mockResolvedValue(''),
        completeStructured: vi.fn().mockImplementation((messages: any) => {
          messageSnapshots.push([...messages]);
          const data = responses[callCount] ?? responses[0];
          callCount++;
          return Promise.resolve({
            data,
            reasoning: callCount === 1 ? 'round 1 reasoning' : null,
            tokensUsed: 100,
          } satisfies StructuredResponse<CollaborationActionRaw>);
        }),
        getTotalTokens: vi.fn().mockReturnValue(0),
      };

      return {
        deps: {
          llmClient,
          soulText: createMockSoulText(),
          config: createWriterConfig(),
        },
        messageSnapshots,
      };
    }

    it('should accumulate messages across multiple participate() calls', async () => {
      const { deps, messageSnapshots } = createMultiTurnDeps();
      const writer = createCollaborativeWriter(deps);

      // Round 1
      await writer.participate(createEmptyState(), 'テスト');
      // Round 2 (state updated with round history)
      const state2 = createEmptyState({
        currentPhase: 'discussion',
        rounds: [{
          roundNumber: 1,
          phase: 'proposal',
          actions: [{ type: 'proposal', writerId: 'writer_1', content: 'Round 1 proposal' }],
          moderatorSummary: 'ラウンド1完了',
        }],
      });
      await writer.participate(state2, 'テスト');

      // First call: system + user = 2 messages
      expect(messageSnapshots[0]).toHaveLength(2);
      expect(messageSnapshots[0][0].role).toBe('system');
      expect(messageSnapshots[0][1].role).toBe('user');

      // Second call: system + user(round1) + assistant(round1 response) + user(round2) = 4 messages
      expect(messageSnapshots[1]).toHaveLength(4);
      expect(messageSnapshots[1][0].role).toBe('system');
      expect(messageSnapshots[1][1].role).toBe('user');
      expect(messageSnapshots[1][2].role).toBe('assistant');
      expect(messageSnapshots[1][3].role).toBe('user');
    });

    it('should include reasoning from prior round in assistant message', async () => {
      const { deps, messageSnapshots } = createMultiTurnDeps();
      const writer = createCollaborativeWriter(deps);

      // Round 1 (returns reasoning: 'round 1 reasoning')
      await writer.participate(createEmptyState(), 'テスト');
      // Round 2
      const state2 = createEmptyState({ currentPhase: 'discussion' });
      await writer.participate(state2, 'テスト');

      // Assistant message from round 1 should include reasoning
      const assistantMsg = messageSnapshots[1][2] as any;
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.reasoning).toBe('round 1 reasoning');
    });

    it('should omit reasoning from assistant message when null', async () => {
      const messageSnapshots: Array<Array<{ role: string; content: string; reasoning?: string }>> = [];
      let callCount = 0;
      const llmClient: LLMClient = {
        complete: vi.fn().mockResolvedValue(''),
        completeStructured: vi.fn().mockImplementation((messages: any) => {
          messageSnapshots.push([...messages]);
          callCount++;
          return Promise.resolve({
            data: { action: 'proposal', content: `response ${callCount}` },
            reasoning: null,
            tokensUsed: 50,
          } satisfies StructuredResponse<CollaborationActionRaw>);
        }),
        getTotalTokens: vi.fn().mockReturnValue(0),
      };
      const deps: CollaborativeWriterDeps = {
        llmClient,
        soulText: createMockSoulText(),
        config: createWriterConfig(),
      };
      const writer = createCollaborativeWriter(deps);

      await writer.participate(createEmptyState(), 'テスト');
      await writer.participate(createEmptyState({ currentPhase: 'discussion' }), 'テスト');

      // Assistant message from round 1 should NOT have reasoning key
      const assistantMsg = messageSnapshots[1][2] as any;
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg).not.toHaveProperty('reasoning');
    });

    it('should accumulate 3 rounds correctly (6 messages on 3rd call)', async () => {
      const { deps, messageSnapshots } = createMultiTurnDeps();
      const writer = createCollaborativeWriter(deps);

      // 3 rounds
      await writer.participate(createEmptyState(), 'テスト');
      await writer.participate(createEmptyState({ currentPhase: 'discussion' }), 'テスト');
      await writer.participate(createEmptyState({ currentPhase: 'drafting' }), 'テスト');

      // 3rd call: system + user + assistant + user + assistant + user = 6 messages
      expect(messageSnapshots[2]).toHaveLength(6);
      expect(messageSnapshots[2][0].role).toBe('system');
      expect(messageSnapshots[2][1].role).toBe('user');
      expect(messageSnapshots[2][2].role).toBe('assistant');
      expect(messageSnapshots[2][3].role).toBe('user');
      expect(messageSnapshots[2][4].role).toBe('assistant');
      expect(messageSnapshots[2][5].role).toBe('user');
    });
  });
});
