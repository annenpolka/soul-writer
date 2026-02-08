import { describe, it, expect } from 'vitest';
import {
  buildCollaborationSynthesisContext,
  type CollaborationSynthesisContextInput,
} from '../../../src/agents/context/collaboration-synthesis-context.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import type { CollaborationResult, CollaborationRound } from '../../../src/collaboration/types.js';
import type { NarrativeRules } from '../../../src/factory/narrative-rules.js';

function createMockNarrativeRules(overrides?: Partial<NarrativeRules>): NarrativeRules {
  return {
    pov: 'first-person',
    pronoun: 'わたし',
    protagonistName: null,
    povDescription: '一人称・わたし視点',
    isDefaultProtagonist: true,
    ...overrides,
  };
}

function createMockRounds(): CollaborationRound[] {
  return [
    {
      roundNumber: 1,
      phase: 'proposal',
      actions: [
        { type: 'proposal', writerId: 'writer_1', content: '冒頭はAR世界の描写から始める' },
        { type: 'proposal', writerId: 'writer_2', content: '透心の内面独白から始める' },
      ],
      moderatorSummary: 'writer_1はAR描写、writer_2は内面独白を提案',
    },
    {
      roundNumber: 2,
      phase: 'discussion',
      actions: [
        {
          type: 'feedback',
          writerId: 'writer_1',
          targetWriterId: 'writer_2',
          feedback: '内面独白の後にAR描写を入れるのが良い',
          sentiment: 'suggest_revision',
          counterProposal: 'AR描写を中盤に配置',
        },
        {
          type: 'feedback',
          writerId: 'writer_2',
          targetWriterId: 'writer_1',
          feedback: 'AR描写は効果的だが冒頭には不向き',
          sentiment: 'disagree',
        },
        {
          type: 'feedback',
          writerId: 'writer_3',
          targetWriterId: 'writer_1',
          feedback: 'writer_1の提案に同意',
          sentiment: 'agree',
        },
      ],
      moderatorSummary: '内面独白先行でコンセンサスに向かう',
    },
    {
      roundNumber: 3,
      phase: 'drafting',
      actions: [
        { type: 'draft', writerId: 'writer_1', section: '導入', text: '透心は窓の外を見た。ARタグが点滅していた。' },
        { type: 'draft', writerId: 'writer_2', section: '展開', text: 'つるぎの声が聞こえた。「見てるよ」' },
        { type: 'draft', writerId: 'writer_3', section: '結末', text: '透心は笑った。初めて。' },
      ],
      moderatorSummary: '各セクションのドラフトが完成',
    },
    {
      roundNumber: 4,
      phase: 'review',
      actions: [
        {
          type: 'feedback',
          writerId: 'writer_1',
          targetWriterId: 'writer_2',
          feedback: '展開部のテンポが良い',
          sentiment: 'agree',
        },
        {
          type: 'feedback',
          writerId: 'writer_2',
          targetWriterId: 'writer_3',
          feedback: '結末が唐突、もう少し余韻が欲しい',
          sentiment: 'challenge',
        },
      ],
      moderatorSummary: '全体的に肯定的、結末に改善の余地あり',
    },
  ];
}

function createMockCollaborationResult(overrides?: Partial<CollaborationResult>): CollaborationResult {
  return {
    finalText: '完成テキスト: 透心は窓の外を見た。ARタグが点滅していた。つるぎの声が聞こえた。',
    rounds: createMockRounds(),
    participants: ['writer_1', 'writer_2', 'writer_3'],
    totalTokensUsed: 500,
    consensusScore: 0.85,
    ...overrides,
  };
}

describe('buildCollaborationSynthesisContext', () => {
  it('should include collaboration round information', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.rounds).toBeDefined();
    const rounds = ctx.rounds as Array<{ roundNumber: number; phase: string }>;
    expect(rounds).toHaveLength(4);
    expect(rounds[0].phase).toBe('proposal');
    expect(rounds[1].phase).toBe('discussion');
    expect(rounds[2].phase).toBe('drafting');
    expect(rounds[3].phase).toBe('review');
  });

  it('should include consensus score', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult({ consensusScore: 0.92 }),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.consensusScore).toBe(0.92);
  });

  it('should include feedback sentiments from discussion/review rounds', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.feedbackSummary).toBeDefined();
    const feedback = ctx.feedbackSummary as Array<{
      writerId: string;
      targetWriterId: string;
      sentiment: string;
      feedback: string;
    }>;
    // 5 feedback actions across rounds 2 and 4
    expect(feedback).toHaveLength(5);
    const sentiments = feedback.map(f => f.sentiment);
    expect(sentiments).toContain('agree');
    expect(sentiments).toContain('disagree');
    expect(sentiments).toContain('suggest_revision');
    expect(sentiments).toContain('challenge');
  });

  it('should include drafts from drafting rounds', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.drafts).toBeDefined();
    const drafts = ctx.drafts as Array<{ writerId: string; section: string; text: string }>;
    expect(drafts).toHaveLength(3);
    expect(drafts[0].section).toBe('導入');
    expect(drafts[1].section).toBe('展開');
    expect(drafts[2].section).toBe('結末');
  });

  it('should include finalText', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.finalText).toContain('透心は窓の外を見た');
  });

  it('should include participants', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.participants).toEqual(['writer_1', 'writer_2', 'writer_3']);
  });

  it('should work when rounds are empty', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult({ rounds: [] }),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.rounds).toEqual([]);
    expect(ctx.feedbackSummary).toEqual([]);
    expect(ctx.drafts).toEqual([]);
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext();
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
      themeContext,
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.themeContext).toBeDefined();
    const tc = ctx.themeContext as { emotion: string };
    expect(tc.emotion).toBe('孤独');
  });

  it('should work without optional themeContext', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.themeContext).toBeUndefined();
  });

  it('should include style rules from constitution', () => {
    const input: CollaborationSynthesisContextInput = {
      soulText: createMockSoulText(),
      collaborationResult: createMockCollaborationResult(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildCollaborationSynthesisContext(input);

    expect(ctx.styleRules).toBeDefined();
    const rules = ctx.styleRules as { rhythm: string; forbiddenWords: string[] };
    expect(rules.rhythm).toBeDefined();
    expect(rules.forbiddenWords).toBeDefined();
  });
});
