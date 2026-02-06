import { describe, it, expect } from 'vitest';
import type { ReaderPersona } from '../../../src/schemas/reader-personas.js';
import type { PersonaEvaluation } from '../../../src/agents/types.js';
import { buildReaderEvalContext } from '../../../src/agents/context/reader-eval-context.js';

const mockPersona: ReaderPersona = {
  id: 'sf_fan',
  name: 'SF愛好家',
  description: 'SFの技術的整合性を重視する読者',
  preferences: ['世界設定の緻密さ', 'SF的整合性'],
  evaluation_weights: {
    style: 0.2,
    plot: 0.2,
    character: 0.2,
    worldbuilding: 0.3,
    readability: 0.1,
  },
};

describe('buildReaderEvalContext', () => {
  it('should build context with persona info and text', () => {
    const context = buildReaderEvalContext({
      persona: mockPersona,
      text: 'テスト小説テキスト',
    });

    expect(context.personaName).toBe('SF愛好家');
    expect(context.personaDescription).toBe('SFの技術的整合性を重視する読者');
    expect(context.text).toBe('テスト小説テキスト');
  });

  it('should format preferences as a list', () => {
    const context = buildReaderEvalContext({
      persona: mockPersona,
      text: 'テスト',
    });

    expect(context.preferencesList).toBe('- 世界設定の緻密さ\n- SF的整合性');
  });

  it('should include previousFeedback when provided', () => {
    const previousEvaluation: PersonaEvaluation = {
      personaId: 'sf_fan',
      personaName: 'SF愛好家',
      categoryScores: { style: 0.7, plot: 0.6, character: 0.5, worldbuilding: 0.8, readability: 0.7 },
      weightedScore: 0.68,
      feedback: {
        strengths: '世界観が良い',
        weaknesses: 'テンポが遅い',
        suggestion: '改善する',
      },
    };

    const context = buildReaderEvalContext({
      persona: mockPersona,
      text: 'テスト',
      previousEvaluation,
    });

    expect(context.previousFeedback).toContain('世界観が良い');
    expect(context.previousFeedback).toContain('テンポが遅い');
    expect(context.previousFeedback).toContain('改善する');
  });

  it('should include previousScores when previous evaluation is provided', () => {
    const previousEvaluation: PersonaEvaluation = {
      personaId: 'sf_fan',
      personaName: 'SF愛好家',
      categoryScores: { style: 0.7, plot: 0.6, character: 0.5, worldbuilding: 0.8, readability: 0.7 },
      weightedScore: 0.68,
      feedback: {
        strengths: '良い',
        weaknesses: '課題',
        suggestion: '提案',
      },
    };

    const context = buildReaderEvalContext({
      persona: mockPersona,
      text: 'テスト',
      previousEvaluation,
    });

    expect(context.previousScores).toContain('style');
    expect(context.previousScores).toContain('0.7');
  });

  it('should have empty previousFeedback and previousScores when no previous evaluation', () => {
    const context = buildReaderEvalContext({
      persona: mockPersona,
      text: 'テスト',
    });

    expect(context.previousFeedback).toBe('');
    expect(context.previousScores).toBe('');
  });
});
