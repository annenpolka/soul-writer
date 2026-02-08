import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/template/composer.js';

/**
 * Snapshot tests for all 9 agent prompt templates.
 * These tests fix the buildPrompt() output for each agent,
 * ensuring YAML template changes are intentional and reviewed.
 */

// Shared mock data
const mockConstitution = {
  sentence_structure: {
    rhythm_pattern: '短-短-長(内省)-短(断定)',
    taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
    typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
  },
  vocabulary: {
    bracket_notations: [],
    bracket_notations_required: [],
    forbidden_words: ['絆', '希望の光'],
    characteristic_expressions: [],
    special_marks: { mark: '×', usage: '否定・拒絶の記号', forms: ['×。', '×、'] },
  },
  rhetoric: {
    simile_base: 'test',
    metaphor_density: 'low',
    forbidden_similes: ['死んだ魚のような'],
    personification_allowed_for: [],
  },
  narrative: {
    default_pov: 'first-person',
    pov_by_character: {},
    default_tense: 'present',
    tense_shift_allowed: 'flashback only',
    dialogue_ratio: '20-30%',
    dialogue_style_by_character: {
      透心: '短文、断定的',
      つるぎ: '挑発的、ハッカー口調',
    },
    dialogue_style_entries: [
      { name: '透心', style: '短文、断定的' },
      { name: 'つるぎ', style: '挑発的、ハッカー口調' },
    ],
  },
  thematic_constraints: {
    must_preserve: ['無関心な世界での存在確認', 'ARと現実の境界'],
    forbidden_resolutions: [],
  },
  scene_modes: {
    mundane: {
      description: '日常描写：淡々とした観察',
      style: '短文と中文が交互',
    },
    tension: {
      description: '緊迫：短文連打',
      style: '短文が連なる。体言止めで切る',
    },
  },
  dry_humor: {
    description: '冷笑的自嘲',
    techniques: ['内心の殺意と直後の丁寧な応対の並置'],
    frequency: '1章に2-3回',
  },
  new_character_guide: {
    description: '新キャラ主人公の最低限ガイド',
    rules: ['キャラクターの内面が語りのトーンに反映されること'],
  },
};

const mockNarrativeRules = {
  pov: 'first-person' as const,
  pronoun: 'わたし',
  protagonistName: null,
  povDescription: '一人称「わたし」視点',
  isDefaultProtagonist: true,
};

describe('Prompt Snapshots', () => {
  // 1. Writer
  describe('writer', () => {
    it('should match snapshot', () => {
      const context = {
        criticalRules: '- 一人称「わたし」のみ使用\n- 「私」は禁止',
        constitution: mockConstitution,
        narrativeRules: mockNarrativeRules,
        developedCharacters: [
          { name: '透心', isNew: false, role: '主人公', displayName: '透心（既存）', voice: '短文、断定的' },
          { name: '新キャラ', isNew: true, role: 'サブ', displayName: '新キャラ（新規）', description: 'テスト用' },
        ],
        terminologyEntries: [
          { term: 'ARタグ', definition: '個人識別タグ' },
        ],
        antiSoulEntries: [
          { category: 'theme_violation', text: 'テスト反魂テキスト', reason: '理由' },
        ],
        fragmentCategories: [
          { name: 'opening', fragments: [{ text: 'テスト断片テキスト' }] },
        ],
        prompt: 'テスト用のシーンを書いてください。',
      };

      const result = buildPrompt('writer', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 2. Judge
  describe('judge', () => {
    it('should match snapshot', () => {
      const context = {
        soulName: 'テストソウル',
        criteriaEntries: [
          { text: '1. **語り声の再現** (voice_accuracy): 一人称「わたし」' },
          { text: '2. **独自性** (originality): 独自のアプローチで原作を拡張' },
          { text: '3. **文体の一貫性** (style): 短文リズム' },
        ],
        penaltyEntries: [
          { text: '「私」表記 → 大幅減点' },
          { text: '陳腐な比喩の多用 → 減点' },
        ],
        constitution: mockConstitution,
        narrativeRules: mockNarrativeRules,
        voiceEntries: [
          { name: '透心', style: '短文、断定的' },
          { name: 'つるぎ', style: '挑発的、ハッカー口調' },
        ],
        antiSoulCompactEntries: [
          { category: 'theme_violation', text: '安易な希望描写', reason: 'テーマ違反' },
        ],
        fragmentCompactCategories: [
          { name: 'opening', text: '教室の蛍光灯が、まただれかの名前を消した。' },
        ],
        textA: 'テキストAのサンプル内容。',
        textB: 'テキストBのサンプル内容。',
      };

      const result = buildPrompt('judge', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 3. Plotter
  describe('plotter', () => {
    it('should match snapshot', () => {
      const context = {
        thematicMustPreserve: ['無関心な世界での存在確認', 'ARと現実の境界'],
        developedCharacters: [
          { name: '透心', isNew: false, role: '主人公', tag: '（既存）', descriptionLine: '' },
          { name: '新キャラ', isNew: true, role: 'サブ', tag: '（新規）', descriptionLine: '\n  背景: テスト説明' },
        ],
        technologyEntries: [
          { name: 'ARタグ', description: '個人識別タグ' },
        ],
        themeInfo: {
          emotion: '孤独',
          timeline: '出会い前',
          premise: 'テスト前提文',
          characters: [
            { name: '透心', tag: '', descSuffix: '' },
            { name: '新キャラ', tag: '（新規）', descSuffix: ': テスト用キャラ' },
          ],
          scene_types: ['教室独白', '通学路'],
          narrative_type: '一人称内面独白',
        },
        chapterInstruction: '3章構成の物語を設計してください。\n総文字数の目安: 20000字',
      };

      const result = buildPrompt('plotter', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 4. Character Developer
  describe('character-developer', () => {
    it('should match snapshot', () => {
      const context = {
        existingCharacters: [
          { name: '透心', role: '主人公', voiceSuffix: '（口調: 短文、断定的）' },
          { name: 'つるぎ', role: 'ハッカー', voiceSuffix: '（口調: 挑発的）' },
        ],
        castingRules: [
          { text: '既存キャラクターを使う義務はない' },
          { text: '「叔父」は物語に不可欠な場合のみ' },
        ],
        themeInfo: {
          emotion: '渇望',
          timeline: '出会い後',
          premise: 'テスト前提',
          narrative_type: '一人称内面独白',
        },
        themeCharacters: [
          { name: '透心', isNew: false, tag: '（既存）', descSuffix: '' },
          { name: '新キャラ', isNew: true, tag: '（新規）', descSuffix: ': テスト用の新キャラクター' },
        ],
      };

      const result = buildPrompt('character-developer', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 5. Theme Generator Stage 1
  describe('theme-generator-stage1', () => {
    it('should match snapshot', () => {
      const context = {
        strategy: '逆転の発想: 結末から逆算して物語を構築する',
        concept: '鏡像',
        worldDescription: 'AR/MRテクノロジーが浸透した近未来。',
        emotion: '孤独',
        timeline: '出会い前',
        tone: '常識的な展開や安全な選択を避け、予想外で挑発的なアイデアを出してください。',
      };

      const result = buildPrompt('theme-generator-stage1', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 6. Theme Generator Stage 2
  describe('theme-generator-stage2', () => {
    it('should match snapshot', () => {
      const context = {
        thematicConstraints: ['無関心な世界での存在確認', 'ARと現実の境界'],
        characters: [
          { name: '透心', role: '主人公', description: '孤児の学級委員長' },
        ],
        technologyEntries: [
          { name: 'ARタグ', description: '個人識別タグ' },
        ],
        societyEntries: [
          { name: '教育制度', state: '形骸化した管理教育' },
        ],
        sceneCatalog: ['教室での内面描写', '屋上での非公式な対話', 'MRフロアでの仮想体験'],
        wildIdea: 'テスト用の原案アイデア。予想外の展開を含む。',
        narrative: '一人称内面独白',
        opening: '日常の中の違和感から始める',
        recentThemes: [
          { emotion: '怒り', timeline: '事件後', premise: '過去のテーマ' },
        ],
      };

      const result = buildPrompt('theme-generator-stage2', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 7. Corrector
  describe('corrector', () => {
    it('should match snapshot', () => {
      const context = {
        forbiddenWords: ['絆', '希望の光'],
        forbiddenSimiles: ['死んだ魚のような'],
        specialMark: '×',
        specialMarkForms: ['×。', '×、'],
        text: 'テスト用の修正対象テキスト。',
        violationList: '- 禁止語彙「絆」が使用されています\n- 禁止比喩「死んだ魚のような」が使用されています',
      };

      const result = buildPrompt('corrector', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 8. Reader Evaluator
  describe('reader-evaluator', () => {
    it('should match snapshot', () => {
      const context = {
        personaName: 'SF愛好家',
        personaDescription: 'ハードSFを好む読者。科学的整合性を重視する。',
        preferencesList: '- 世界観の整合性\n- 技術的ディテール\n- 論理的なプロット展開',
        text: 'テスト用の評価対象テキスト。',
      };

      const result = buildPrompt('reader-evaluator', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });

  // 9. Fragment Extractor
  describe('fragment-extractor', () => {
    it('should match snapshot', () => {
      const context = {
        text: 'テスト用の断片抽出対象テキスト。',
        complianceScore: '0.85',
        readerScore: '0.72',
      };

      const result = buildPrompt('fragment-extractor', context);
      expect(result.system).toMatchSnapshot();
      expect(result.user).toMatchSnapshot();
    });
  });
});
