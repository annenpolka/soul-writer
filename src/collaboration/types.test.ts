import { describe, it, expect } from 'vitest';
import {
  ProposalActionSchema,
  FeedbackActionSchema,
  DraftActionSchema,
  VolunteerActionSchema,
  CollaborationActionSchema,
  CollaborationRoundSchema,
  CollaborationStateSchema,
  CollaborationConfigSchema,
  CollaborationResultSchema,
  DEFAULT_COLLABORATION_CONFIG,
} from './types.js';

describe('CollaborationAction schemas', () => {
  it('should validate ProposalAction', () => {
    const action = {
      type: 'proposal',
      writerId: 'writer_1',
      content: 'この章は透心の内面独白から始めるべきだ',
    };
    expect(ProposalActionSchema.parse(action)).toEqual(action);
  });

  it('should validate ProposalAction with targetSection', () => {
    const action = {
      type: 'proposal',
      writerId: 'writer_1',
      content: '冒頭のシーンを提案する',
      targetSection: 'opening',
    };
    expect(ProposalActionSchema.parse(action)).toEqual(action);
  });

  it('should validate FeedbackAction', () => {
    const action = {
      type: 'feedback',
      writerId: 'writer_2',
      targetWriterId: 'writer_1',
      feedback: '緊張感が足りない。もっと短文で刻むべき',
      sentiment: 'suggest_revision',
    };
    expect(FeedbackActionSchema.parse(action)).toEqual(action);
  });

  it('should reject FeedbackAction with invalid sentiment', () => {
    const action = {
      type: 'feedback',
      writerId: 'writer_2',
      targetWriterId: 'writer_1',
      feedback: 'test',
      sentiment: 'invalid',
    };
    expect(() => FeedbackActionSchema.parse(action)).toThrow();
  });

  it('should validate DraftAction', () => {
    const action = {
      type: 'draft',
      writerId: 'writer_1',
      section: 'opening',
      text: '透心は窓の外を見つめていた。ARタグが剥がれかけた空が、嘘みたいに青い。',
    };
    expect(DraftActionSchema.parse(action)).toEqual(action);
  });

  it('should validate VolunteerAction', () => {
    const action = {
      type: 'volunteer',
      writerId: 'writer_3',
      section: 'climax',
      reason: '殺害シーンの描写は私の得意カテゴリです',
    };
    expect(VolunteerActionSchema.parse(action)).toEqual(action);
  });

  it('should discriminate CollaborationAction union', () => {
    const proposal = {
      type: 'proposal',
      writerId: 'writer_1',
      content: 'test proposal',
    };
    const draft = {
      type: 'draft',
      writerId: 'writer_2',
      section: 'opening',
      text: 'test text',
    };
    expect(CollaborationActionSchema.parse(proposal).type).toBe('proposal');
    expect(CollaborationActionSchema.parse(draft).type).toBe('draft');
  });

  it('should reject unknown action type', () => {
    const invalid = {
      type: 'unknown',
      writerId: 'writer_1',
    };
    expect(() => CollaborationActionSchema.parse(invalid)).toThrow();
  });
});

describe('CollaborationRound schema', () => {
  it('should validate a round', () => {
    const round = {
      roundNumber: 1,
      phase: 'proposal',
      actions: [
        { type: 'proposal', writerId: 'writer_1', content: 'test' },
      ],
      moderatorSummary: 'Writer 1が冒頭の方向性を提案',
    };
    expect(CollaborationRoundSchema.parse(round)).toEqual(round);
  });
});

describe('CollaborationConfig schema', () => {
  it('should validate config with defaults', () => {
    expect(DEFAULT_COLLABORATION_CONFIG).toEqual({
      maxRounds: 5,
      writerCount: 3,
      earlyTerminationThreshold: 0.8,
    });
  });

  it('should validate custom config', () => {
    const config = {
      maxRounds: 10,
      writerCount: 4,
      earlyTerminationThreshold: 0.9,
    };
    expect(CollaborationConfigSchema.parse(config)).toEqual(config);
  });

  it('should reject invalid threshold', () => {
    const config = {
      maxRounds: 5,
      writerCount: 3,
      earlyTerminationThreshold: 1.5,
    };
    expect(() => CollaborationConfigSchema.parse(config)).toThrow();
  });
});

describe('CollaborationResult schema', () => {
  it('should validate a result', () => {
    const result = {
      finalText: '完成したテキスト',
      rounds: [
        {
          roundNumber: 1,
          phase: 'proposal',
          actions: [{ type: 'proposal', writerId: 'w1', content: 'test' }],
          moderatorSummary: 'summary',
        },
      ],
      participants: ['writer_1', 'writer_2', 'writer_3'],
      totalTokensUsed: 5000,
      consensusScore: 0.85,
    };
    expect(CollaborationResultSchema.parse(result)).toEqual(result);
  });
});
