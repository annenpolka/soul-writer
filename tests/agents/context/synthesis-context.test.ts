import { describe, it, expect } from 'vitest';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import { resolveNarrativeRules } from '../../../src/factory/narrative-rules.js';
import type { GenerationResult } from '../../../src/agents/types.js';
import type { MatchResult } from '../../../src/tournament/arena.js';
import {
  buildSynthesisSystemPrompt,
  buildSynthesisUserPrompt,
  collectLoserExcerpts,
  type SynthesisSystemPromptInput,
  type LoserExcerpt,
} from '../../../src/agents/context/synthesis-context.js';

// --- collectLoserExcerpts ---

function makeGenerations(): GenerationResult[] {
  return [
    { writerId: 'w1', text: '勝者テキスト', tokensUsed: 100 },
    { writerId: 'w2', text: '敗者テキスト2', tokensUsed: 100 },
    { writerId: 'w3', text: '敗者テキスト3', tokensUsed: 100 },
  ];
}

function makeRounds(): MatchResult[] {
  return [
    {
      matchName: 'match1',
      contestantA: 'w1',
      contestantB: 'w2',
      winner: 'w1',
      judgeResult: {
        winner: 'A',
        reasoning: 'w1の文体が良い',
        scores: {
          A: { style: 8, compliance: 9, overall: 8.5 },
          B: { style: 6, compliance: 7, overall: 6.5 },
        },
        praised_excerpts: {
          A: ['勝者の美しい表現'],
          B: ['敗者2の光る一文'],
        },
      },
    },
    {
      matchName: 'match2',
      contestantA: 'w1',
      contestantB: 'w3',
      winner: 'w1',
      judgeResult: {
        winner: 'A',
        reasoning: 'w1が総合的に優勢',
        scores: {
          A: { style: 9, compliance: 9, overall: 9 },
          B: { style: 7, compliance: 8, overall: 7.5 },
        },
        praised_excerpts: {
          A: ['勝者の力強い描写'],
          B: ['敗者3の独特な比喩'],
        },
      },
    },
  ];
}

describe('collectLoserExcerpts', () => {
  it('should collect excerpts from losers only (not champion)', () => {
    const result = collectLoserExcerpts('w1', makeGenerations(), makeRounds());

    const writerIds = result.map(r => r.writerId);
    expect(writerIds).toContain('w2');
    expect(writerIds).toContain('w3');
    expect(writerIds).not.toContain('w1');
  });

  it('should collect praised_excerpts from the correct side', () => {
    const result = collectLoserExcerpts('w1', makeGenerations(), makeRounds());

    const w2 = result.find(r => r.writerId === 'w2')!;
    expect(w2.excerpts).toEqual(['敗者2の光る一文']);

    const w3 = result.find(r => r.writerId === 'w3')!;
    expect(w3.excerpts).toEqual(['敗者3の独特な比喩']);
  });

  it('should include reasoning', () => {
    const result = collectLoserExcerpts('w1', makeGenerations(), makeRounds());

    const w2 = result.find(r => r.writerId === 'w2')!;
    expect(w2.reasoning).toContain('w1の文体が良い');
  });

  it('should return empty array when no losers exist', () => {
    const result = collectLoserExcerpts(
      'w1',
      [{ writerId: 'w1', text: 'text', tokensUsed: 100 }],
      [],
    );
    expect(result).toEqual([]);
  });

  it('should return empty array when losers have no excerpts and no reasoning', () => {
    const rounds: MatchResult[] = [
      {
        matchName: 'match1',
        contestantA: 'w1',
        contestantB: 'w2',
        winner: 'w1',
        judgeResult: {
          winner: 'A',
          reasoning: '',
          scores: {
            A: { style: 8, compliance: 9, overall: 8.5 },
            B: { style: 6, compliance: 7, overall: 6.5 },
          },
        },
      },
    ];
    const result = collectLoserExcerpts(
      'w1',
      [
        { writerId: 'w1', text: 'text', tokensUsed: 100 },
        { writerId: 'w2', text: 'text', tokensUsed: 100 },
      ],
      rounds,
    );
    expect(result).toEqual([]);
  });

  it('should combine reasoning from multiple rounds for the same loser', () => {
    // Create rounds where w2 appears in both matches
    const rounds: MatchResult[] = [
      {
        matchName: 'match1',
        contestantA: 'w2',
        contestantB: 'w1',
        winner: 'w1',
        judgeResult: {
          winner: 'B',
          reasoning: '第一ラウンドの評価',
          scores: {
            A: { style: 6, compliance: 7, overall: 6.5 },
            B: { style: 8, compliance: 9, overall: 8.5 },
          },
          praised_excerpts: { A: ['表現A'], B: [] },
        },
      },
      {
        matchName: 'match2',
        contestantA: 'w1',
        contestantB: 'w2',
        winner: 'w1',
        judgeResult: {
          winner: 'A',
          reasoning: '第二ラウンドの評価',
          scores: {
            A: { style: 9, compliance: 9, overall: 9 },
            B: { style: 7, compliance: 8, overall: 7.5 },
          },
          praised_excerpts: { A: [], B: ['表現B'] },
        },
      },
    ];

    const result = collectLoserExcerpts(
      'w1',
      [
        { writerId: 'w1', text: 'text', tokensUsed: 100 },
        { writerId: 'w2', text: 'text', tokensUsed: 100 },
      ],
      rounds,
    );

    const w2 = result.find(r => r.writerId === 'w2')!;
    expect(w2.excerpts).toEqual(['表現A', '表現B']);
    expect(w2.reasoning).toContain('第一ラウンドの評価');
    expect(w2.reasoning).toContain('第二ラウンドの評価');
  });
});

// --- buildSynthesisSystemPrompt ---

describe('buildSynthesisSystemPrompt', () => {
  function makeInput(overrides?: Partial<SynthesisSystemPromptInput>): SynthesisSystemPromptInput {
    return {
      soulText: createMockSoulText(),
      narrativeRules: resolveNarrativeRules(),
      ...overrides,
    };
  }

  it('should include core synthesis rules', () => {
    const prompt = buildSynthesisSystemPrompt(makeInput());

    expect(prompt).toContain('あなたは合成編集者です。');
    expect(prompt).toContain('【合成ルール】');
    expect(prompt).toContain('ベーステキスト（勝者作品）の構造');
    expect(prompt).toContain('±10%以内');
    expect(prompt).toContain('出力はテキスト本文のみ');
  });

  it('should include constitution style rules', () => {
    const soulText = createMockSoulText({ forbiddenWords: ['とても', '非常に'] });
    const prompt = buildSynthesisSystemPrompt(makeInput({ soulText }));

    expect(prompt).toContain('【文体基準】');
    expect(prompt).toContain('リズム:');
    expect(prompt).toContain('とても, 非常に');
  });

  it('should include narrativeRules POV info', () => {
    const narrativeRules = resolveNarrativeRules();
    const prompt = buildSynthesisSystemPrompt(makeInput({ narrativeRules }));

    expect(prompt).toContain('視点:');
    expect(prompt).toContain(narrativeRules.povDescription);
  });

  it('should include pronoun when present in narrativeRules', () => {
    const narrativeRules = resolveNarrativeRules(); // default has pronoun='わたし'
    const prompt = buildSynthesisSystemPrompt(makeInput({ narrativeRules }));

    expect(prompt).toContain('人称代名詞: 「わたし」');
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext();
    const prompt = buildSynthesisSystemPrompt(makeInput({ themeContext }));

    expect(prompt).toContain('【テーマ・トーン】');
    expect(prompt).toContain('孤独');
    expect(prompt).toContain('出会い前');
    expect(prompt).toContain('テスト前提');
    expect(prompt).toContain('冷徹');
  });

  it('should not include themeContext section when not provided', () => {
    const prompt = buildSynthesisSystemPrompt(makeInput());

    expect(prompt).not.toContain('【テーマ・トーン】');
  });
});

// --- buildSynthesisUserPrompt ---

describe('buildSynthesisUserPrompt', () => {
  it('should include champion text', () => {
    const loserExcerpts: LoserExcerpt[] = [
      { writerId: 'w2', excerpts: ['良い表現'], reasoning: 'テスト' },
    ];
    const prompt = buildSynthesisUserPrompt('勝者テキスト', loserExcerpts);

    expect(prompt).toContain('## ベーステキスト（勝者作品）');
    expect(prompt).toContain('勝者テキスト');
  });

  it('should include loser excerpts with reasoning', () => {
    const loserExcerpts: LoserExcerpt[] = [
      { writerId: 'w2', excerpts: ['美しい表現', '光る一文'], reasoning: '審査員の評価' },
    ];
    const prompt = buildSynthesisUserPrompt('勝者テキスト', loserExcerpts);

    expect(prompt).toContain('## 落選テキストから抽出された優良表現');
    expect(prompt).toContain('### w2');
    expect(prompt).toContain('審査員コメント: 審査員の評価');
    expect(prompt).toContain('「美しい表現」');
    expect(prompt).toContain('「光る一文」');
  });

  it('should include closing instruction', () => {
    const prompt = buildSynthesisUserPrompt('テキスト', []);

    expect(prompt).toContain('上記の優良表現のエッセンスをベーステキストに自然に織り込んでください');
    expect(prompt).toContain('構造やプロットは変えず');
  });

  it('should handle multiple losers', () => {
    const loserExcerpts: LoserExcerpt[] = [
      { writerId: 'w2', excerpts: ['表現A'], reasoning: '評価A' },
      { writerId: 'w3', excerpts: ['表現B'], reasoning: '評価B' },
    ];
    const prompt = buildSynthesisUserPrompt('勝者テキスト', loserExcerpts);

    expect(prompt).toContain('### w2');
    expect(prompt).toContain('### w3');
    expect(prompt).toContain('「表現A」');
    expect(prompt).toContain('「表現B」');
  });
});
