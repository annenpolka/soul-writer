import { describe, it, expect } from 'vitest';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import { resolveNarrativeRules } from '../../../src/factory/narrative-rules.js';
import { DEFAULT_WRITERS } from '../../../src/agents/types.js';
import type { WriterContextInput } from '../../../src/agents/context/writer-context.js';
import {
  buildWriterContext,
  buildCriticalRules,
  buildConstitutionData,
  buildCharacterConstraintEntries,
  buildAntiSoulEntries,
  buildFragmentCategories,
} from '../../../src/agents/context/writer-context.js';

function makeInput(overrides?: Partial<WriterContextInput>): WriterContextInput {
  return {
    prompt: 'テストプロンプト',
    soulText: createMockSoulText(),
    config: DEFAULT_WRITERS[0],
    narrativeRules: resolveNarrativeRules(),
    ...overrides,
  };
}

describe('buildWriterContext', () => {
  it('should include criticalRules, constitution, narrativeRules, and prompt', () => {
    const input = makeInput();
    const ctx = buildWriterContext(input);

    expect(ctx).toHaveProperty('criticalRules');
    expect(ctx).toHaveProperty('constitution');
    expect(ctx).toHaveProperty('narrativeRules');
    expect(ctx).toHaveProperty('prompt', 'テストプロンプト');
  });

  it('should include terminologyEntries from worldBible', () => {
    const soulText = createMockSoulText({
      deep: {
        worldBible: {
          terminology: { 'ARタグ': '拡張現実タグ', 'MRフロア': '仮想闘技場' } as Record<string, string>,
        },
      },
    });
    const input = makeInput({ soulText });
    const ctx = buildWriterContext(input);

    expect(ctx.terminologyEntries).toEqual([
      { term: 'ARタグ', definition: '拡張現実タグ' },
      { term: 'MRフロア', definition: '仮想闘技場' },
    ]);
  });

  it('should include worldBibleCharacters when developedCharacters is absent', () => {
    const soulText = createMockSoulText({
      characters: {
        '透心': { role: '主人公', traits: ['孤独'], speech_pattern: '冷徹' },
      },
    });
    const input = makeInput({ soulText });
    const ctx = buildWriterContext(input);

    expect(ctx.worldBibleCharacters).toEqual([
      { name: '透心', role: '主人公', traits: ['孤独'], speech_pattern: '冷徹' },
    ]);
    expect(ctx).not.toHaveProperty('developedCharacters');
  });

  it('should include developedCharacters with displayName when provided', () => {
    const input = makeInput({
      developedCharacters: [
        { name: '透心', isNew: false, role: '主人公', description: 'desc', voice: 'voice' },
        { name: '新キャラ', isNew: true, role: '敵', description: 'desc2', voice: 'voice2' },
      ],
    });
    const ctx = buildWriterContext(input);

    expect(ctx.developedCharacters).toEqual([
      expect.objectContaining({ name: '透心', displayName: '透心（既存）' }),
      expect.objectContaining({ name: '新キャラ', displayName: '新キャラ（新規）' }),
    ]);
    expect(ctx).not.toHaveProperty('worldBibleCharacters');
  });

  it('should include isDefaultProtagonist when narrativeRules says so', () => {
    const rules = resolveNarrativeRules(); // default => isDefaultProtagonist = true
    const input = makeInput({ narrativeRules: rules });
    const ctx = buildWriterContext(input);

    expect(ctx.isDefaultProtagonist).toBe(true);
  });

  it('should not include isDefaultProtagonist when false', () => {
    const rules = resolveNarrativeRules('三人称', [{ name: '別キャラ', isNew: true }]);
    const input = makeInput({ narrativeRules: rules });
    const ctx = buildWriterContext(input);

    expect(ctx).not.toHaveProperty('isDefaultProtagonist');
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext();
    const input = makeInput({ themeContext });
    const ctx = buildWriterContext(input);

    expect(ctx.themeContext).toEqual(themeContext);
  });

  it('should not include themeContext when absent', () => {
    const input = makeInput();
    const ctx = buildWriterContext(input);

    expect(ctx).not.toHaveProperty('themeContext');
  });

  it('should include macGuffinContext when provided', () => {
    const macGuffinContext = { characterMacGuffins: [], plotMacGuffins: [] };
    const input = makeInput({ macGuffinContext });
    const ctx = buildWriterContext(input);

    expect(ctx.macGuffinContext).toEqual(macGuffinContext);
  });

  it('should not include macGuffinContext when absent', () => {
    const input = makeInput();
    const ctx = buildWriterContext(input);

    expect(ctx).not.toHaveProperty('macGuffinContext');
  });

  it('should include rawSoultext when present', () => {
    const soulText = createMockSoulText({ deep: { rawSoultext: 'raw text here' } });
    const input = makeInput({ soulText });
    const ctx = buildWriterContext(input);

    expect(ctx.rawSoultext).toBe('raw text here');
  });

  it('should include personaDirective when config has one', () => {
    const config = { ...DEFAULT_WRITERS[0], personaDirective: 'あなたは冷徹な語り手です' };
    const input = makeInput({ config });
    const ctx = buildWriterContext(input);

    expect(ctx.personaDirective).toBe('あなたは冷徹な語り手です');
  });
});

describe('buildCriticalRules', () => {
  it('should start with 最重要ルール header', () => {
    const input = makeInput();
    const rules = buildCriticalRules(input.soulText, input.narrativeRules);

    expect(rules).toContain('【最重要ルール】');
  });

  it('should include default protagonist rules when isDefaultProtagonist is true', () => {
    const narrativeRules = resolveNarrativeRules();
    const rules = buildCriticalRules(createMockSoulText(), narrativeRules);

    expect(rules).toContain('原作にない設定やキャラクターを捏造しない');
    expect(rules).toContain('「ライオン」は透心固有の内面シンボル');
  });

  it('should include non-default protagonist rules when isDefaultProtagonist is false', () => {
    const narrativeRules = resolveNarrativeRules('三人称', [{ name: '別キャラ', isNew: true }]);
    const rules = buildCriticalRules(createMockSoulText(), narrativeRules);

    expect(rules).toContain('この世界観に存在し得る設定・キャラクターを使用すること');
    expect(rules).not.toContain('原作にない設定やキャラクターを捏造しない');
  });

  it('should include promptConfig critical_rules when present', () => {
    const soulText = createMockSoulText({
      deep: {
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          agents: { writer: { critical_rules: ['カスタムルール1', 'カスタムルール2'] } },
        },
      },
    });
    const rules = buildCriticalRules(soulText, resolveNarrativeRules());

    expect(rules).toContain('- カスタムルール1');
    expect(rules).toContain('- カスタムルール2');
  });

  it('should include markdown prohibition rules', () => {
    const rules = buildCriticalRules(createMockSoulText(), resolveNarrativeRules());

    expect(rules).toContain('マークダウン記法は一切使用禁止');
    expect(rules).toContain('**太字**');
  });
});

describe('buildConstitutionData', () => {
  it('should include vocabulary, rhetoric, and thematic_constraints always', () => {
    const soulText = createMockSoulText();
    const result = buildConstitutionData(soulText, true);

    expect(result).toHaveProperty('vocabulary');
    expect(result).toHaveProperty('rhetoric');
    expect(result).toHaveProperty('thematic_constraints');
  });

  it('should include protagonist-specific fields when isDefaultProtagonist is true', () => {
    const soulText = createMockSoulText();
    const result = buildConstitutionData(soulText, true);

    expect(result).toHaveProperty('sentence_structure');
    expect(result).toHaveProperty('narrative');
    expect(result).toHaveProperty('scene_modes');
    expect(result).toHaveProperty('dry_humor');
    expect(result).not.toHaveProperty('new_character_guide');
  });

  it('should include new_character_guide when isDefaultProtagonist is false', () => {
    const soulText = createMockSoulText();
    const result = buildConstitutionData(soulText, false);

    expect(result).toHaveProperty('new_character_guide');
    expect(result).not.toHaveProperty('sentence_structure');
    expect(result).not.toHaveProperty('narrative');
    expect(result).not.toHaveProperty('scene_modes');
    expect(result).not.toHaveProperty('dry_humor');
  });

  it('should filter bracket_notations to required-only', () => {
    const soulText = createMockSoulText({
      deep: {
        constitution: {
          universal: {
            vocabulary: {
              bracket_notations: [
                { notation: '【】', required: true, usage: 'test' },
                { notation: '〈〉', required: false, usage: 'test' },
              ],
              forbidden_words: [],
              characteristic_expressions: [],
              special_marks: { mark: '×', usage: 'test', forms: [] },
            },
            rhetoric: { simile_base: 'test', metaphor_density: 'low', forbidden_similes: [], personification_allowed_for: [] },
            thematic_constraints: { must_preserve: [], forbidden_resolutions: [] },
            new_character_guide: { description: 'test', rules: [] },
          },
        },
      },
    });
    const result = buildConstitutionData(soulText, true);
    const vocab = result.vocabulary as Record<string, unknown>;

    expect(vocab.bracket_notations_required).toEqual([
      { notation: '【】', required: true, usage: 'test' },
    ]);
  });

  it('should produce dialogue_style_entries from dialogue_style_by_character', () => {
    const soulText = createMockSoulText({
      deep: {
        constitution: {
          protagonist_specific: {
            sentence_structure: { rhythm_pattern: 'test', taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] }, typical_lengths: { short: 'test', long: 'test', forbidden: 'test' } },
            narrative: {
              default_pov: 'test',
              pov_by_character: {},
              default_tense: 'test',
              tense_shift_allowed: 'test',
              dialogue_ratio: 'test',
              dialogue_style_by_character: { '透心': 'ぶっきらぼう', 'つるぎ': '皮肉っぽい' },
            },
            scene_modes: { mundane: { description: 'test', style: 'test' }, tension: { description: 'test', style: 'test' } },
            dry_humor: { description: 'test', techniques: [], frequency: 'test' },
          },
        },
      },
    });
    const result = buildConstitutionData(soulText, true);
    const narrative = result.narrative as Record<string, unknown>;

    expect(narrative.dialogue_style_entries).toEqual([
      { name: '透心', style: 'ぶっきらぼう' },
      { name: 'つるぎ', style: '皮肉っぽい' },
    ]);
  });
});

describe('buildCharacterConstraintEntries', () => {
  it('should return empty array when no character_constraints in promptConfig', () => {
    const soulText = createMockSoulText();
    const result = buildCharacterConstraintEntries(soulText);

    expect(result).toEqual([]);
  });

  it('should return all entries when no developedCharacters filter', () => {
    const soulText = createMockSoulText({
      deep: {
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          character_constraints: {
            '透心': ['ルール1', 'ルール2'],
            'つるぎ': ['ルール3'],
          },
        },
      },
    });
    const result = buildCharacterConstraintEntries(soulText);

    expect(result).toEqual([
      { name: '透心', rules: ['ルール1', 'ルール2'] },
      { name: 'つるぎ', rules: ['ルール3'] },
    ]);
  });

  it('should filter entries by developedCharacters when provided', () => {
    const soulText = createMockSoulText({
      deep: {
        promptConfig: {
          defaults: { protagonist_short: '透心', pronoun: 'わたし' },
          character_constraints: {
            '透心': ['ルール1'],
            'つるぎ': ['ルール3'],
            '別キャラ': ['ルール4'],
          },
        },
      },
    });
    const devChars = [
      { name: '御鐘透心', isNew: false, role: '主人公', description: 'desc', voice: 'voice' },
    ];
    const result = buildCharacterConstraintEntries(soulText, devChars);

    expect(result).toEqual([
      { name: '透心', rules: ['ルール1'] },
    ]);
  });
});

describe('buildAntiSoulEntries', () => {
  it('should return empty array for empty categories', () => {
    const soulText = createMockSoulText();
    const result = buildAntiSoulEntries(soulText);

    expect(result).toEqual([]);
  });

  it('should limit to 2 examples per category', () => {
    const soulText = createMockSoulText({
      deep: {
        antiSoul: {
          categories: {
            theme_violation: [
              { text: 'example1', reason: 'reason1' },
              { text: 'example2', reason: 'reason2' },
              { text: 'example3', reason: 'reason3' },
            ],
          },
        },
      },
    });
    const result = buildAntiSoulEntries(soulText);

    expect(result).toHaveLength(1);
    expect(result[0].examples).toHaveLength(2);
  });

  it('should truncate text at 150 characters', () => {
    const longText = 'あ'.repeat(200);
    const soulText = createMockSoulText({
      deep: {
        antiSoul: {
          categories: {
            theme_violation: [
              { text: longText, reason: 'reason1' },
            ],
          },
        },
      },
    });
    const result = buildAntiSoulEntries(soulText);

    expect(result[0].examples[0].text).toHaveLength(150);
  });

  it('should skip empty categories', () => {
    const soulText = createMockSoulText({
      deep: {
        antiSoul: {
          categories: {
            theme_violation: [],
            mentor_tsurgi: [{ text: 'example', reason: 'reason' }],
          },
        },
      },
    });
    const result = buildAntiSoulEntries(soulText);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('mentor_tsurgi');
  });
});

describe('buildFragmentCategories', () => {
  it('should return empty array when no fragments', () => {
    const soulText = createMockSoulText();
    const result = buildFragmentCategories(soulText, DEFAULT_WRITERS[0]);

    expect(result).toEqual([]);
  });

  it('should include 1 item per non-focus category', () => {
    const soulText = createMockSoulText();
    soulText.fragments.set('dialogue', [
      { text: 'frag1' },
      { text: 'frag2' },
      { text: 'frag3' },
    ]);
    // writer_1 focusCategories = ['opening', 'introspection'] — dialogue is not a focus
    const result = buildFragmentCategories(soulText, DEFAULT_WRITERS[0]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('dialogue');
    expect(result[0].focusLabel).toBe('');
    expect(result[0].items).toHaveLength(1);
  });

  it('should include up to 3 items for focus categories', () => {
    const soulText = createMockSoulText();
    soulText.fragments.set('opening', [
      { text: 'frag1' },
      { text: 'frag2' },
      { text: 'frag3' },
      { text: 'frag4' },
    ]);
    // writer_1 focusCategories = ['opening', 'introspection']
    const result = buildFragmentCategories(soulText, DEFAULT_WRITERS[0]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('opening');
    expect(result[0].focusLabel).toBe('（重点）');
    expect(result[0].items).toHaveLength(3);
  });

  it('should skip categories with zero fragments', () => {
    const soulText = createMockSoulText();
    soulText.fragments.set('opening', []);
    soulText.fragments.set('dialogue', [{ text: 'frag1' }]);
    const result = buildFragmentCategories(soulText, DEFAULT_WRITERS[0]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('dialogue');
  });

  it('should handle config without focusCategories', () => {
    const soulText = createMockSoulText();
    soulText.fragments.set('opening', [
      { text: 'frag1' },
      { text: 'frag2' },
      { text: 'frag3' },
    ]);
    const config = { ...DEFAULT_WRITERS[0], focusCategories: undefined };
    const result = buildFragmentCategories(soulText, config);

    // Without focus, should return 1 item
    expect(result[0].items).toHaveLength(1);
    expect(result[0].focusLabel).toBe('');
  });
});
