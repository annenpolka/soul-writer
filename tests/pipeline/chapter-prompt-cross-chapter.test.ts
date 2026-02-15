import { describe, it, expect } from 'vitest';
import { buildChapterPrompt } from '../../src/pipeline/chapter-prompt.js';
import type { ChapterPromptInput } from '../../src/pipeline/chapter-prompt.js';
import type { CrossChapterState } from '../../src/agents/types.js';
import type { VariationAxis } from '../../src/schemas/plot.js';

function makeMinimalInput(overrides?: Partial<ChapterPromptInput>): ChapterPromptInput {
  return {
    chapter: {
      index: 2,
      title: 'テスト章',
      summary: 'テスト概要',
      key_events: ['イベント1'],
      target_length: 4000,
    },
    plot: {
      title: 'テスト物語',
      theme: 'テストテーマ',
      chapters: [],
    },
    ...overrides,
  };
}

describe('buildChapterPrompt — cross-chapter state', () => {
  it('should not include new sections when crossChapterState is absent', () => {
    const result = buildChapterPrompt(makeMinimalInput());
    expect(result).not.toContain('キャラクター状態の継続');
    expect(result).not.toContain('モチーフ摩耗警告');
    expect(result).not.toContain('この章の変奏軸');
  });

  it('should include character state continuity section', () => {
    const crossChapterState: CrossChapterState = {
      characterStates: [
        {
          characterName: '透心',
          emotionalState: '絶望',
          knowledgeGained: ['秘密を知った'],
          relationshipChanges: ['つるぎとの距離が縮まった'],
          physicalState: '右腕を負傷',
        },
      ],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterPrompt(makeMinimalInput({ crossChapterState }));
    expect(result).toContain('## キャラクター状態の継続（初見紹介禁止）');
    expect(result).toContain('外見描写の再紹介は禁止');
    expect(result).toContain('透心: 最終状態「絶望」');
    expect(result).toContain('身体状態「右腕を負傷」');
    expect(result).toContain('関係変化: つるぎとの距離が縮まった');
  });

  it('should not include character section when characterStates is empty', () => {
    const crossChapterState: CrossChapterState = {
      characterStates: [],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterPrompt(makeMinimalInput({ crossChapterState }));
    expect(result).not.toContain('キャラクター状態の継続');
  });

  it('should omit physicalState when not provided', () => {
    const crossChapterState: CrossChapterState = {
      characterStates: [
        {
          characterName: 'つるぎ',
          emotionalState: '冷静',
          knowledgeGained: [],
          relationshipChanges: [],
        },
      ],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterPrompt(makeMinimalInput({ crossChapterState }));
    expect(result).toContain('つるぎ: 最終状態「冷静」');
    expect(result).not.toContain('身体状態');
    expect(result).not.toContain('関係変化:');
  });

  it('should show all motif wear entries with 3-time budget', () => {
    const crossChapterState: CrossChapterState = {
      characterStates: [],
      motifWear: [
        { motif: 'ARタグ', usageCount: 1, lastUsedChapter: 1, wearLevel: 'fresh' },
        { motif: 'ノイズ', usageCount: 2, lastUsedChapter: 2, wearLevel: 'used' },
        { motif: '空白', usageCount: 3, lastUsedChapter: 3, wearLevel: 'used' },
        { motif: '殺意', usageCount: 5, lastUsedChapter: 4, wearLevel: 'worn' },
      ],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterPrompt(makeMinimalInput({ crossChapterState }));
    expect(result).toContain('## モチーフ使用状況（3回ルール）');
    // All motifs should appear with budget info
    expect(result).toContain('ARタグ: 1回使用済み → 残り2回');
    expect(result).toContain('ノイズ: 2回使用済み → 残り1回（クライマックス専用）');
    expect(result).toContain('空白: 3回使用済み → ★使用禁止（別のモチーフに切り替えよ）★');
    expect(result).toContain('殺意: 5回使用済み → ★使用禁止（別のモチーフに切り替えよ）★');
  });

  it('should not show motif section when motifWear is empty', () => {
    const crossChapterState: CrossChapterState = {
      characterStates: [],
      motifWear: [],
      variationHint: null,
      chapterSummaries: [],
    };

    const result = buildChapterPrompt(makeMinimalInput({ crossChapterState }));
    expect(result).not.toContain('モチーフ使用状況');
  });
});

describe('buildChapterPrompt — variation axis', () => {
  it('should include variation axis section', () => {
    const variationAxis: VariationAxis = {
      curve_type: 'escalation',
      intensity_target: 4,
      differentiation_technique: '対話による緊張の蓄積',
      internal_beats: ['静寂', '予兆', '爆発', '余韻'],
    };

    const result = buildChapterPrompt(makeMinimalInput({ variationAxis }));
    expect(result).toContain('## この章の変奏軸');
    expect(result).toContain('曲線タイプ: escalation');
    expect(result).toContain('強度目標: 4/5');
    expect(result).toContain('差別化技法: 対話による緊張の蓄積');
    expect(result).toContain('章内変化ポイント: 静寂 → 予兆 → 爆発 → 余韻');
  });

  it('should omit internal_beats when not provided', () => {
    const variationAxis: VariationAxis = {
      curve_type: 'descent_plateau',
      intensity_target: 2,
      differentiation_technique: '静的描写の連続',
    };

    const result = buildChapterPrompt(makeMinimalInput({ variationAxis }));
    expect(result).toContain('## この章の変奏軸');
    expect(result).toContain('曲線タイプ: descent_plateau');
    expect(result).not.toContain('章内変化ポイント');
  });

  it('should not include variation axis section when absent', () => {
    const result = buildChapterPrompt(makeMinimalInput());
    expect(result).not.toContain('この章の変奏軸');
  });
});
