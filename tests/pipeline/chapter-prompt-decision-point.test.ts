import { describe, it, expect } from 'vitest';
import { buildChapterPrompt, type ChapterPromptInput } from '../../src/pipeline/chapter-prompt.js';
import type { Chapter, Plot } from '../../src/schemas/plot.js';

function makeMinimalPlot(overrides?: Partial<Plot>): Plot {
  return {
    title: 'テスト物語',
    theme: 'テストテーマ',
    chapters: [],
    ...overrides,
  };
}

function makeMinimalChapter(overrides?: Partial<Chapter>): Chapter {
  return {
    index: 1,
    title: '第一章',
    summary: '概要テスト',
    key_events: ['イベント1'],
    target_length: 4000,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<ChapterPromptInput>): ChapterPromptInput {
  return {
    chapter: makeMinimalChapter(),
    plot: makeMinimalPlot(),
    ...overrides,
  };
}

describe('buildChapterPrompt - decision_point', () => {
  it('should include decision_point section when chapter has decision_point', () => {
    const chapter = makeMinimalChapter({
      decision_point: {
        action: '名前を呼ぶ',
        stakes: '関係の崩壊',
        irreversibility: '一度口にした言葉は取り消せない',
      },
    });
    const result = buildChapterPrompt(makeInput({ chapter }));

    expect(result).toContain('決定的行動');
    expect(result).toContain('名前を呼ぶ');
    expect(result).toContain('関係の崩壊');
    expect(result).toContain('一度口にした言葉は取り消せない');
  });

  it('should not include decision_point section when chapter lacks decision_point', () => {
    const chapter = makeMinimalChapter();
    const result = buildChapterPrompt(makeInput({ chapter }));

    expect(result).not.toContain('決定的行動');
  });

  it('should include action, stakes, and irreversibility labels', () => {
    const chapter = makeMinimalChapter({
      decision_point: {
        action: 'データを消す',
        stakes: '証拠の永久消失',
        irreversibility: '復元不可能になる',
      },
    });
    const result = buildChapterPrompt(makeInput({ chapter }));

    expect(result).toContain('行動: データを消す');
    expect(result).toContain('賭け金: 証拠の永久消失');
    expect(result).toContain('不可逆な変化: 復元不可能になる');
  });

  it('should include instruction to incorporate the action into the story', () => {
    const chapter = makeMinimalChapter({
      decision_point: {
        action: '手を引く',
        stakes: '信頼の喪失',
        irreversibility: '距離が生まれる',
      },
    });
    const result = buildChapterPrompt(makeInput({ chapter }));

    expect(result).toContain('この行動を必ず物語に組み込むこと');
  });
});
