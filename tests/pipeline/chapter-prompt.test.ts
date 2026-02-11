import { describe, it, expect } from 'vitest';
import { buildChapterPrompt, type ChapterPromptInput } from '../../src/pipeline/chapter-prompt.js';
import type { Chapter, Plot } from '../../src/schemas/plot.js';

const mockChapter: Chapter = {
  index: 1,
  title: 'テスト章',
  summary: 'テスト概要',
  key_events: ['イベント1', 'イベント2'],
  target_length: 5000,
};

const mockPlot: Plot = {
  title: 'テスト作品',
  theme: 'テストテーマ',
  chapters: [mockChapter],
};

describe('buildChapterPrompt', () => {
  it('基本プロンプト生成（chapter + plot のみ）', () => {
    const input: ChapterPromptInput = { chapter: mockChapter, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('# テスト作品');
    expect(result).toContain('テーマ: テストテーマ');
    expect(result).toContain('## テスト章（第1章）');
    expect(result).toContain('概要: テスト概要');
    expect(result).toContain('- イベント1');
    expect(result).toContain('- イベント2');
    expect(result).toContain('目標文字数: 5000字');
    expect(result).toContain('この章を執筆してください。');
    // ナラティブセクションが無い
    expect(result).not.toContain('## ナラティブ');
  });

  it('ナラティブルール注入時のプロンプト', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      narrativeType: 'first-person',
      narrativeRules: {
        pov: 'first-person',
        pronoun: 'わたし',
        protagonistName: null,
        povDescription: '一人称（わたし）視点。御鐘透心の内面から語る',
        isDefaultProtagonist: true,
      },
    };
    const result = buildChapterPrompt(input);

    expect(result).toContain('## ナラティブ');
    expect(result).toContain('- 型: first-person');
    expect(result).toContain('- 一人称（わたし）視点。御鐘透心の内面から語る');
  });

  it('developedCharacters 注入時のプロンプト（新規/既存キャラの区別）', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      developedCharacters: [
        { name: '御鐘透心', isNew: false, role: '主人公', description: '孤児の学級委員長', voice: '冷淡で内省的' },
        { name: '新キャラ', isNew: true, role: '敵対者', description: '謎の人物', voice: '威圧的' },
      ],
    };
    const result = buildChapterPrompt(input);

    expect(result).toContain('## 登場人物');
    expect(result).toContain('- 御鐘透心（既存）: 主人公');
    expect(result).toContain('  背景: 孤児の学級委員長');
    expect(result).toContain('  口調: 冷淡で内省的');
    expect(result).toContain('- 新キャラ（新規）: 敵対者');
    expect(result).toContain('  背景: 謎の人物');
    expect(result).toContain('  口調: 威圧的');
  });

  it('characterMacGuffins 注入時のプロンプト', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      characterMacGuffins: [
        {
          characterName: '御鐘透心',
          secret: '秘密',
          surfaceSigns: ['微かな震え', '視線の揺れ'],
          narrativeFunction: 'テスト用',
        },
      ],
    };
    const result = buildChapterPrompt(input);

    expect(result).toContain('## キャラクターの秘密（表出サインとして描写に織り込むこと）');
    expect(result).toContain('- 御鐘透心: 微かな震え、視線の揺れ');
  });

  it('plotMacGuffins 注入時のプロンプト', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      plotMacGuffins: [
        {
          name: '消えた記録',
          surfaceAppearance: '表面',
          hiddenLayer: '隠れ層',
          tensionQuestions: ['なぜ消えたのか', '誰が消したのか'],
          presenceHint: '背景に漂わせる',
        },
      ],
    };
    const result = buildChapterPrompt(input);

    expect(result).toContain('## 物語の謎（解決不要、雰囲気として漂わせること）');
    expect(result).toContain('- 消えた記録: なぜ消えたのか、誰が消したのか（背景に漂わせる）');
  });

  it('variation_constraints 注入時のプロンプト', () => {
    const chapterWithVariation: Chapter = {
      ...mockChapter,
      variation_constraints: {
        structure_type: 'parallel_montage',
        emotional_arc: 'ascending',
        pacing: 'slow_burn',
        deviation_from_previous: '前章より静的な展開',
        motif_budget: [
          { motif: '光', max_uses: 3 },
          { motif: '影', max_uses: 2 },
        ],
      },
    };
    const input: ChapterPromptInput = { chapter: chapterWithVariation, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('### バリエーション制約');
    expect(result).toContain('- 構造型: parallel_montage');
    expect(result).toContain('- 感情曲線: ascending');
    expect(result).toContain('- テンポ: slow_burn');
    expect(result).toContain('- 前章との差分: 前章より静的な展開');
    expect(result).toContain('- モチーフ使用上限:');
    expect(result).toContain('  - 「光」: 最大3回');
    expect(result).toContain('  - 「影」: 最大2回');
  });

  it('epistemic_constraints 注入時のプロンプト', () => {
    const chapterWithEpistemic: Chapter = {
      ...mockChapter,
      epistemic_constraints: [
        { perspective: '御鐘透心', constraints: ['愛原の正体を知らない', '組織の存在を知らない'] },
      ],
    };
    const input: ChapterPromptInput = { chapter: chapterWithEpistemic, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('### 認識制約（epistemic constraints）');
    expect(result).toContain('この章の各視点キャラクターは以下を知らない/見ない。厳守すること:');
    expect(result).toContain('- 御鐘透心: 愛原の正体を知らない / 組織の存在を知らない');
  });

  it('全要素結合時のプロンプト', () => {
    const fullChapter: Chapter = {
      ...mockChapter,
      variation_constraints: {
        structure_type: 'single_scene',
        emotional_arc: 'descending',
        pacing: 'rapid_cuts',
      },
      epistemic_constraints: [
        { perspective: '御鐘透心', constraints: ['裏切りを知らない'] },
      ],
    };
    const input: ChapterPromptInput = {
      chapter: fullChapter,
      plot: mockPlot,
      narrativeType: 'third-person-limited',
      narrativeRules: {
        pov: 'third-person-limited',
        pronoun: null,
        protagonistName: '御鐘透心',
        povDescription: '三人称限定視点。御鐘透心を中心に描写',
        isDefaultProtagonist: true,
      },
      developedCharacters: [
        { name: '御鐘透心', isNew: false, role: '主人公', description: '孤児', voice: '冷淡' },
      ],
      characterMacGuffins: [
        { characterName: '愛原つるぎ', secret: '二重スパイ', surfaceSigns: ['不自然な笑顔'], narrativeFunction: '伏線' },
      ],
      plotMacGuffins: [
        { name: 'ARタグの異常', surfaceAppearance: 'ノイズ', hiddenLayer: 'バグではない', tensionQuestions: ['なぜ起きる'], presenceHint: '背景描写で匂わせる' },
      ],
    };
    const result = buildChapterPrompt(input);

    // 全セクションが含まれている
    expect(result).toContain('# テスト作品');
    expect(result).toContain('## ナラティブ');
    expect(result).toContain('## 登場人物');
    expect(result).toContain('## キャラクターの秘密');
    expect(result).toContain('## 物語の謎');
    expect(result).toContain('### バリエーション制約');
    expect(result).toContain('### 認識制約');
    expect(result).toContain('この章を執筆してください。');
  });

  it('description/voiceが空のキャラクターはそれらの行を出力しない', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      developedCharacters: [
        { name: 'テストキャラ', isNew: false, role: 'サブ', description: '', voice: '' },
      ],
    };
    const result = buildChapterPrompt(input);

    expect(result).toContain('- テストキャラ（既存）: サブ');
    expect(result).not.toContain('  背景:');
    expect(result).not.toContain('  口調:');
  });

  it('空の配列は対応セクションを出力しない', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      developedCharacters: [],
      characterMacGuffins: [],
      plotMacGuffins: [],
    };
    const result = buildChapterPrompt(input);

    expect(result).not.toContain('## 登場人物');
    expect(result).not.toContain('## キャラクターの秘密');
    expect(result).not.toContain('## 物語の謎');
  });

  it('dramaturgy 注入時のプロンプト', () => {
    const chapterWithDramaturgy: Chapter = {
      ...mockChapter,
      dramaturgy: '透心の内なる殺意が初めて外界に漏れ出す瞬間',
    };
    const input: ChapterPromptInput = { chapter: chapterWithDramaturgy, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('### ドラマトゥルギー（起動装置）');
    expect(result).toContain('透心の内なる殺意が初めて外界に漏れ出す瞬間');
  });

  it('arc_role 注入時のプロンプト', () => {
    const chapterWithArcRole: Chapter = {
      ...mockChapter,
      arc_role: '序破急の「序」— 日常の提示と違和感の種蒔き',
    };
    const input: ChapterPromptInput = { chapter: chapterWithArcRole, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('### 物語的機能');
    expect(result).toContain('序破急の「序」— 日常の提示と違和感の種蒔き');
  });

  it('emotional_beats 注入時のプロンプト', () => {
    const chapterWithEmotionalBeats: Chapter = {
      ...mockChapter,
      variation_constraints: {
        structure_type: 'single_scene',
        emotional_arc: 'ascending',
        pacing: 'slow_burn',
        emotional_beats: ['疎外', '怒り', '麻痺', '微かな希望'],
      },
    };
    const input: ChapterPromptInput = { chapter: chapterWithEmotionalBeats, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('- 感情ビート（この順序で遷移させること）: 疎外 → 怒り → 麻痺 → 微かな希望');
  });

  it('forbidden_patterns 注入時のプロンプト', () => {
    const chapterWithForbidden: Chapter = {
      ...mockChapter,
      variation_constraints: {
        structure_type: 'parallel_montage',
        emotional_arc: 'descending',
        pacing: 'rapid_cuts',
        forbidden_patterns: ['冒頭の独白', '夢オチ', '説明的な回想'],
      },
    };
    const input: ChapterPromptInput = { chapter: chapterWithForbidden, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).toContain('- 禁止パターン（以下は使用禁止）:');
    expect(result).toContain('  - 冒頭の独白');
    expect(result).toContain('  - 夢オチ');
    expect(result).toContain('  - 説明的な回想');
  });

  it('previousChapterAnalysis 注入時のプロンプト', () => {
    const input: ChapterPromptInput = {
      chapter: mockChapter,
      plot: mockPlot,
      previousChapterAnalysis: {
        storySummary: '透心が教室で静かに怒りを溜め込む場面',
        avoidanceDirective: {
          emotionalBeats: ['孤独', '怒り', '麻痺'],
          dominantImagery: ['灰色', '金属', '冷たさ'],
          rhythmProfile: '短文連打のスタッカート',
          structuralPattern: '観察→異常発見→内省→未解決',
        },
      },
    };
    const result = buildChapterPrompt(input);

    expect(result).toContain('## 前章からの接続と変奏');
    expect(result).toContain('### 前章の概要');
    expect(result).toContain('透心が教室で静かに怒りを溜め込む場面');
    expect(result).toContain('### この章で避けるべきパターン（前章で使用済み）');
    expect(result).toContain('- 感情遷移: 孤独 → 怒り → 麻痺');
    expect(result).toContain('- 支配的イメージ: 灰色、金属、冷たさ');
    expect(result).toContain('- リズム: 短文連打のスタッカート');
    expect(result).toContain('- 構造: 観察→異常発見→内省→未解決');
    expect(result).toContain('上記と異なるアプローチで執筆すること。');
  });

  it('previousChapterAnalysis なしの場合は前章セクションを出力しない', () => {
    const input: ChapterPromptInput = { chapter: mockChapter, plot: mockPlot };
    const result = buildChapterPrompt(input);

    expect(result).not.toContain('## 前章からの接続と変奏');
    expect(result).not.toContain('### 前章の概要');
    expect(result).not.toContain('この章で避けるべきパターン');
  });

  describe('drama_blueprint', () => {
    it('should include drama blueprint section when plot has drama_blueprint', () => {
      const plotWithBlueprint: Plot = {
        ...mockPlot,
        drama_blueprint: 'descent',
        turning_point: 'the moment she crosses the line',
        stakes_description: 'her humanity',
        protagonist_choice: 'keep going or stop',
        point_of_no_return: 'the murder',
      };
      const input: ChapterPromptInput = { chapter: mockChapter, plot: plotWithBlueprint };
      const result = buildChapterPrompt(input);

      expect(result).toContain('### ドラマブループリント');
      expect(result).toContain('- 構造型: descent');
      expect(result).toContain('- 転機: the moment she crosses the line');
      expect(result).toContain('- 賭け金: her humanity');
      expect(result).toContain('- 主人公の選択: keep going or stop');
      expect(result).toContain('- 引き返せないポイント: the murder');
    });

    it('should include only blueprint type when optional fields are missing', () => {
      const plotWithBlueprintOnly: Plot = {
        ...mockPlot,
        drama_blueprint: 'confrontation',
      };
      const input: ChapterPromptInput = { chapter: mockChapter, plot: plotWithBlueprintOnly };
      const result = buildChapterPrompt(input);

      expect(result).toContain('### ドラマブループリント');
      expect(result).toContain('- 構造型: confrontation');
      expect(result).not.toContain('- 転機:');
      expect(result).not.toContain('- 賭け金:');
    });

    it('should not include drama blueprint section when plot has no drama_blueprint', () => {
      const input: ChapterPromptInput = { chapter: mockChapter, plot: mockPlot };
      const result = buildChapterPrompt(input);

      expect(result).not.toContain('### ドラマブループリント');
    });
  });

  describe('toneDirective', () => {
    it('should include tone directive in prompt when provided', () => {
      const input: ChapterPromptInput = {
        chapter: mockChapter,
        plot: mockPlot,
        toneDirective: '脆い温もり — 不器用な優しさや壊れやすい親密さ',
      };
      const result = buildChapterPrompt(input);

      expect(result).toContain('文体トーン: 脆い温もり — 不器用な優しさや壊れやすい親密さ');
    });

    it('should not include tone directive when not provided', () => {
      const input: ChapterPromptInput = { chapter: mockChapter, plot: mockPlot };
      const result = buildChapterPrompt(input);

      expect(result).not.toContain('文体トーン:');
    });
  });

  describe('motifAvoidanceList', () => {
    it('should include motif avoidance section when list is provided', () => {
      const input: ChapterPromptInput = {
        chapter: mockChapter,
        plot: mockPlot,
        motifAvoidanceList: ['鏡', '月光', '廃墟'],
      };
      const result = buildChapterPrompt(input);

      expect(result).toContain('### 回避すべきモチーフ（過去作品で頻出のため使用禁止）');
      expect(result).toContain('- 鏡');
      expect(result).toContain('- 月光');
      expect(result).toContain('- 廃墟');
    });

    it('should not include motif avoidance section when list is empty', () => {
      const input: ChapterPromptInput = {
        chapter: mockChapter,
        plot: mockPlot,
        motifAvoidanceList: [],
      };
      const result = buildChapterPrompt(input);

      expect(result).not.toContain('回避すべきモチーフ');
    });

    it('should not include motif avoidance section when undefined', () => {
      const input: ChapterPromptInput = { chapter: mockChapter, plot: mockPlot };
      const result = buildChapterPrompt(input);

      expect(result).not.toContain('回避すべきモチーフ');
    });
  });
});
