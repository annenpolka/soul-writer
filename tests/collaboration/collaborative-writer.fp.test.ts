import { describe, it, expect, vi } from 'vitest';
import { createCollaborativeWriter, type CollaborativeWriterDeps } from '../../src/collaboration/collaborative-writer.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../helpers/mock-deps.js';
import type { CollaborationState } from '../../src/collaboration/types.js';
import type { WriterConfig } from '../../src/agents/types.js';

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
  return {
    llmClient: createMockLLMClientWithTools({
      name: 'submit_proposal',
      arguments: { content: 'テスト提案' },
    }),
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
    it('should call completeWithTools and parse tool call to action', async () => {
      const deps = createDeps();
      const writer = createCollaborativeWriter(deps);

      const actions = await writer.participate(createEmptyState(), 'テスト用プロンプト');

      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        type: 'proposal',
        writerId: 'writer_1',
        content: 'テスト提案',
      });
      expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(1);
    });

    it('should throw when llmClient does not support tool calling', async () => {
      const deps = createDeps({
        llmClient: {
          complete: vi.fn().mockResolvedValue(''),
          getTotalTokens: vi.fn().mockReturnValue(0),
          // no completeWithTools
        },
      });
      const writer = createCollaborativeWriter(deps);

      await expect(writer.participate(createEmptyState(), 'test')).rejects.toThrow(
        'LLMClient does not support tool calling',
      );
    });

    it('should use submit_draft only during drafting phase', async () => {
      const deps = createDeps({
        llmClient: createMockLLMClientWithTools({
          name: 'submit_draft',
          arguments: { section: 'opening', text: '透心は窓の外を見つめていた。' },
        }),
      });
      const writer = createCollaborativeWriter(deps);

      const state = createEmptyState({ currentPhase: 'drafting' });
      const actions = await writer.participate(state, 'テスト');

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('draft');

      // Verify tools were filtered to submit_draft only
      const callArgs = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
      const toolsProvided = callArgs[2];
      expect(toolsProvided).toHaveLength(1);
      expect(toolsProvided[0].function.name).toBe('submit_draft');
    });

    it('should fallback to a proposal on repeated failures', async () => {
      const deps = createDeps({
        llmClient: {
          complete: vi.fn().mockResolvedValue(''),
          completeWithTools: vi.fn().mockRejectedValue(new Error('LLM error')),
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
      expect(deps.llmClient.completeWithTools).toHaveBeenCalledTimes(3);
    });

    it('should include theme context in system prompt when provided', async () => {
      const deps = createDeps({
        themeContext: createMockThemeContext({ emotion: '焦燥', tone: '鋭利' }),
      });
      const writer = createCollaborativeWriter(deps);

      await writer.participate(createEmptyState(), 'テスト');

      const systemPrompt = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(systemPrompt).toContain('焦燥');
      expect(systemPrompt).toContain('鋭利');
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

      const userPrompt = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userPrompt).toContain('ラウンド1の要約');
      expect(userPrompt).toContain('前回の提案');
    });
  });
});
