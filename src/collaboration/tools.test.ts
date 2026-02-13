import { describe, it, expect } from 'vitest';
import { parseStructuredAction } from './tools.js';
import { CollaborationActionSchema } from './types.js';
import type { CollaborationActionRaw } from '../schemas/collaboration-action.js';

describe('parseStructuredAction', () => {
  it('should parse proposal action', () => {
    const data: CollaborationActionRaw = {
      action: 'proposal',
      content: '透心の独白から始める',
      targetSection: 'opening',
    };
    const action = parseStructuredAction('writer_1', data);

    expect(action).toEqual({
      type: 'proposal',
      writerId: 'writer_1',
      content: '透心の独白から始める',
      targetSection: 'opening',
    });
    expect(() => CollaborationActionSchema.parse(action)).not.toThrow();
  });

  it('should parse proposal action without optional targetSection', () => {
    const data: CollaborationActionRaw = {
      action: 'proposal',
      content: '全体の構成を提案する',
    };
    const action = parseStructuredAction('writer_1', data);

    expect(action.type).toBe('proposal');
    if (action.type === 'proposal') {
      expect(action.targetSection).toBeUndefined();
    }
  });

  it('should parse feedback action', () => {
    const data: CollaborationActionRaw = {
      action: 'feedback',
      targetWriterId: 'writer_1',
      feedback: '緊張感が足りない',
      sentiment: 'suggest_revision',
    };
    const action = parseStructuredAction('writer_2', data);

    expect(action).toEqual({
      type: 'feedback',
      writerId: 'writer_2',
      targetWriterId: 'writer_1',
      feedback: '緊張感が足りない',
      sentiment: 'suggest_revision',
    });
  });

  it('should parse feedback action with counterProposal', () => {
    const data: CollaborationActionRaw = {
      action: 'feedback',
      targetWriterId: 'writer_1',
      feedback: 'もっと具体的に',
      sentiment: 'disagree',
      counterProposal: '代替案として情景描写を強化する',
    };
    const action = parseStructuredAction('writer_3', data);

    expect(action.type).toBe('feedback');
    if (action.type === 'feedback') {
      expect(action.counterProposal).toBe('代替案として情景描写を強化する');
    }
  });

  it('should parse feedback action without counterProposal when empty string', () => {
    const data: CollaborationActionRaw = {
      action: 'feedback',
      targetWriterId: 'writer_1',
      feedback: '問題なし',
      sentiment: 'agree',
      counterProposal: '',
    };
    const action = parseStructuredAction('writer_2', data);

    expect(action.type).toBe('feedback');
    if (action.type === 'feedback') {
      expect(action.counterProposal).toBeUndefined();
    }
  });

  it('should parse draft action', () => {
    const data: CollaborationActionRaw = {
      action: 'draft',
      section: 'opening',
      text: '透心は窓の外を見つめていた。',
    };
    const action = parseStructuredAction('writer_1', data);

    expect(action).toEqual({
      type: 'draft',
      writerId: 'writer_1',
      section: 'opening',
      text: '透心は窓の外を見つめていた。',
    });
  });

  it('should parse volunteer action', () => {
    const data: CollaborationActionRaw = {
      action: 'volunteer',
      section: 'climax',
      reason: '殺害シーンは得意です',
    };
    const action = parseStructuredAction('writer_3', data);

    expect(action).toEqual({
      type: 'volunteer',
      writerId: 'writer_3',
      section: 'climax',
      reason: '殺害シーンは得意です',
    });
  });

  it('should validate all sentiment types for feedback', () => {
    const sentiments = ['agree', 'disagree', 'suggest_revision', 'challenge'] as const;

    for (const sentiment of sentiments) {
      const data: CollaborationActionRaw = {
        action: 'feedback',
        targetWriterId: 'writer_1',
        feedback: 'test',
        sentiment,
      };
      const action = parseStructuredAction('writer_2', data);
      expect(action.type).toBe('feedback');
      if (action.type === 'feedback') {
        expect(action.sentiment).toBe(sentiment);
      }
    }
  });

  it('should produce actions that pass CollaborationActionSchema validation', () => {
    const testCases: CollaborationActionRaw[] = [
      { action: 'proposal', content: 'test proposal' },
      { action: 'feedback', targetWriterId: 'w1', feedback: 'test', sentiment: 'agree' },
      { action: 'draft', section: 'opening', text: 'test text' },
      { action: 'volunteer', section: 'climax', reason: 'test reason' },
    ];

    for (const data of testCases) {
      const action = parseStructuredAction('writer_1', data);
      expect(() => CollaborationActionSchema.parse(action)).not.toThrow();
    }
  });
});
