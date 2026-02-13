import { describe, it, expect } from 'vitest';
import { buildSynthesisAnalyzerContext, type SynthesisAnalyzerContextInput } from '../../../src/agents/context/synthesis-analyzer-context.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import type { SynthesisAnalyzerInput, MacGuffinContext } from '../../../src/agents/types.js';
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

function createMockAnalyzerInput(overrides?: Partial<SynthesisAnalyzerInput>): SynthesisAnalyzerInput {
  return {
    championText: '勝者テキスト: 透心は窓の外を見た。',
    championId: 'writer_1',
    allGenerations: [
      { writerId: 'writer_1', text: '勝者テキスト: 透心は窓の外を見た。', tokensUsed: 100 },
      { writerId: 'writer_2', text: '敗者テキスト2: 月明かりが部屋を照らした。', tokensUsed: 100 },
      { writerId: 'writer_3', text: '敗者テキスト3: ARタグが点滅していた。', tokensUsed: 100 },
      { writerId: 'writer_4', text: '敗者テキスト4: つるぎは振り返った。', tokensUsed: 100 },
    ],
    rounds: [
      {
        matchName: 'semi_1',
        contestantA: 'writer_1',
        contestantB: 'writer_2',
        winner: 'writer_1',
        judgeResult: {
          winner: 'A',
          reasoning: 'Aの文体が一貫',
          scores: {
            A: { style: 0.8, compliance: 0.9, overall: 0.85 },
            B: { style: 0.6, compliance: 0.7, overall: 0.65 },
          },
          weaknesses: {
            A: [{ category: 'pacing', description: '中盤が冗長', suggestedFix: '展開を圧縮', severity: 'minor' }],
            B: [{ category: 'voice', description: '声が不安定', suggestedFix: '語調統一', severity: 'major' }],
          },
          axis_comments: [
            { axis: 'style', commentA: '短文リズムが安定', commentB: 'リズムにムラ', exampleA: '窓の外', exampleB: '月明かり' },
          ],
          section_analysis: [
            { section: '導入', ratingA: 'excellent', ratingB: 'good', commentA: '印象的', commentB: '標準的' },
          ],
        },
      },
      {
        matchName: 'semi_2',
        contestantA: 'writer_3',
        contestantB: 'writer_4',
        winner: 'writer_3',
        judgeResult: {
          winner: 'A',
          reasoning: 'Aの世界観描写が優秀',
          scores: {
            A: { style: 0.7, compliance: 0.8, overall: 0.75 },
            B: { style: 0.5, compliance: 0.6, overall: 0.55 },
          },
        },
      },
      {
        matchName: 'final',
        contestantA: 'writer_1',
        contestantB: 'writer_3',
        winner: 'writer_1',
        judgeResult: {
          winner: 'A',
          reasoning: 'Aが総合的に優れる',
          scores: {
            A: { style: 0.85, compliance: 0.9, overall: 0.88 },
            B: { style: 0.7, compliance: 0.8, overall: 0.75 },
          },
          weaknesses: {
            A: [{ category: 'imagery', description: '視覚描写が薄い', suggestedFix: 'AR要素を活用', severity: 'minor' }],
            B: [{ category: 'motif', description: 'モチーフ過多', suggestedFix: '絞り込み', severity: 'major' }],
          },
        },
      },
    ],
    ...overrides,
  };
}

describe('buildSynthesisAnalyzerContext', () => {
  it('should include all 4 generation texts in context', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    // Should have all generation texts
    expect(ctx.allTexts).toBeDefined();
    const allTexts = ctx.allTexts as Array<{ writerId: string; text: string; isChampion: boolean }>;
    expect(allTexts).toHaveLength(4);
    expect(allTexts.find(t => t.writerId === 'writer_1')?.isChampion).toBe(true);
    expect(allTexts.find(t => t.writerId === 'writer_2')?.isChampion).toBe(false);
  });

  it('should include judge weaknesses from rounds', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    // Should have judge analysis summary
    expect(ctx.judgeAnalysis).toBeDefined();
    const analysis = ctx.judgeAnalysis as Array<{
      matchName: string;
      weaknesses?: unknown;
      axis_comments?: unknown;
      section_analysis?: unknown;
    }>;
    // semi_1 and final had weaknesses
    const withWeaknesses = analysis.filter(a => a.weaknesses);
    expect(withWeaknesses.length).toBeGreaterThanOrEqual(2);
  });

  it('should include axis_comments and section_analysis from judge', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    const analysis = ctx.judgeAnalysis as Array<{
      matchName: string;
      axis_comments?: unknown;
      section_analysis?: unknown;
    }>;
    const withAxisComments = analysis.filter(a => a.axis_comments);
    expect(withAxisComments.length).toBeGreaterThanOrEqual(1);
  });

  it('should include plotContext when provided', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput({
        plotContext: {
          chapter: {
            index: 1,
            title: '第一章: 始まり',
            summary: '透心の日常が描かれる',
            key_events: ['ARタグとの出会い'],
            target_length: 4000,
          },
        },
      }),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.plotContext).toBeDefined();
    const plotCtx = ctx.plotContext as { chapter?: { title: string } };
    expect(plotCtx.chapter?.title).toBe('第一章: 始まり');
  });

  it('should include macGuffinContext when provided', () => {
    const macGuffinContext: MacGuffinContext = {
      characterMacGuffins: [
        { characterName: 'つるぎ', secretGoal: '組織の裏切り', hiddenWeakness: '透心への執着', revelationTrigger: '最終章' },
      ],
      plotMacGuffins: [
        { name: '失われたARコード', description: '全てのタグを制御するコード', currentState: '断片化', connectionToTheme: '存在確認' },
      ],
    };

    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
      macGuffinContext,
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.macGuffinContext).toBeDefined();
  });

  it('should include chapterContext when provided (previous chapter texts)', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput({
        chapterContext: {
          previousChapterTexts: ['第一章のテキスト内容...'],
        },
      }),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.chapterContext).toBeDefined();
    const chapterCtx = ctx.chapterContext as { previousChapterTexts: string[] };
    expect(chapterCtx.previousChapterTexts).toHaveLength(1);
  });

  it('should work without optional plotContext, macGuffinContext, chapterContext', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput({
        plotContext: undefined,
        chapterContext: undefined,
      }),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.plotContext).toBeUndefined();
    expect(ctx.macGuffinContext).toBeUndefined();
    expect(ctx.chapterContext).toBeUndefined();
    // But core fields still present
    expect(ctx.allTexts).toBeDefined();
    expect(ctx.judgeAnalysis).toBeDefined();
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext();
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
      themeContext,
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.themeContext).toBeDefined();
    const tc = ctx.themeContext as { emotion: string };
    expect(tc.emotion).toBe('孤独');
  });

  it('should include constitution style rules', () => {
    const soulText = createMockSoulText();
    const input: SynthesisAnalyzerContextInput = {
      soulText,
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.styleRules).toBeDefined();
    const rules = ctx.styleRules as {
      rhythm: string;
      forbiddenWords: string[];
      forbiddenSimiles: string[];
    };
    expect(rules.forbiddenWords).toBeDefined();
    expect(rules.forbiddenSimiles).toBeDefined();
  });

  it('should include championId in context', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.championId).toBe('writer_1');
  });

  it('should include judgeReasoning when provided', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
      judgeReasoning: 'Judgeの推論プロセス: Aはリズムが安定している',
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx.judgeReasoning).toBe('Judgeの推論プロセス: Aはリズムが安定している');
  });

  it('should not include judgeReasoning when null', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
      judgeReasoning: null,
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx).not.toHaveProperty('judgeReasoning');
  });

  it('should not include judgeReasoning when not provided', () => {
    const input: SynthesisAnalyzerContextInput = {
      soulText: createMockSoulText(),
      input: createMockAnalyzerInput(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisAnalyzerContext(input);

    expect(ctx).not.toHaveProperty('judgeReasoning');
  });
});
