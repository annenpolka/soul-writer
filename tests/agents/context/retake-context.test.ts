import { describe, it, expect } from 'vitest';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import { resolveNarrativeRules } from '../../../src/factory/narrative-rules.js';
import {
  buildRetakeSystemPrompt,
  buildRetakeUserPrompt,
  type RetakeSystemPromptInput,
} from '../../../src/agents/context/retake-context.js';

// --- buildRetakeSystemPrompt ---

describe('buildRetakeSystemPrompt', () => {
  function makeInput(overrides?: Partial<RetakeSystemPromptInput>): RetakeSystemPromptInput {
    return {
      soulText: createMockSoulText(),
      narrativeRules: resolveNarrativeRules(),
      ...overrides,
    };
  }

  it('should include core retake instructions', () => {
    const prompt = buildRetakeSystemPrompt(makeInput());

    expect(prompt).toContain('あなたはリテイク専門家です。');
    expect(prompt).toContain('【絶対厳守】');
    expect(prompt).toContain('Markdown記法は一切禁止');
    expect(prompt).toContain('【絶対ルール】');
    expect(prompt).toContain('冷徹・簡潔・乾いた語り口');
  });

  it('should include POV rules from narrativeRules', () => {
    const narrativeRules = resolveNarrativeRules(); // default: first-person, isDefaultProtagonist=true
    const prompt = buildRetakeSystemPrompt(makeInput({ narrativeRules }));

    expect(prompt).toContain('わたし');
  });

  it('should include default protagonist rule when isDefaultProtagonist is true', () => {
    const narrativeRules = resolveNarrativeRules(); // isDefaultProtagonist = true
    const prompt = buildRetakeSystemPrompt(makeInput({ narrativeRules }));

    expect(prompt).toContain('原作にない設定やキャラクターを捏造しない');
  });

  it('should include alternate rule when isDefaultProtagonist is false', () => {
    const narrativeRules = resolveNarrativeRules('三人称', [
      { name: '新キャラ', role: '主人公', isNew: true },
    ]);
    const prompt = buildRetakeSystemPrompt(makeInput({ narrativeRules }));

    expect(prompt).toContain('この世界観に存在し得る設定・キャラクターを使用すること');
  });

  it('should include constitution rules', () => {
    const soulText = createMockSoulText({ forbiddenWords: ['とても', '非常に'] });
    const prompt = buildRetakeSystemPrompt(makeInput({ soulText }));

    expect(prompt).toContain('リズム:');
    expect(prompt).toContain('とても, 非常に');
    expect(prompt).toContain('禁止比喩:');
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext();
    const prompt = buildRetakeSystemPrompt(makeInput({ themeContext }));

    expect(prompt).toContain('## テーマ・トーン');
    expect(prompt).toContain('孤独');
    expect(prompt).toContain('出会い前');
    expect(prompt).toContain('テスト前提');
    expect(prompt).toContain('冷徹');
  });

  it('should not include themeContext section when not provided', () => {
    const prompt = buildRetakeSystemPrompt(makeInput());

    expect(prompt).not.toContain('## テーマ・トーン');
  });

  it('should include character dialogue styles', () => {
    const prompt = buildRetakeSystemPrompt(makeInput());

    expect(prompt).toContain('## キャラクター対話スタイル');
  });

  it('should include reference fragments from soulText', () => {
    const soulText = createMockSoulText();
    soulText.fragments.set('opening', [
      { text: '冒頭の断片テキスト', source: 'test' },
    ]);
    const prompt = buildRetakeSystemPrompt(makeInput({ soulText }));

    expect(prompt).toContain('## 原作の文体参考');
    expect(prompt).toContain('冒頭の断片テキスト');
  });

  it('should limit fragments to first 3 categories', () => {
    const soulText = createMockSoulText();
    soulText.fragments.set('cat1', [{ text: 'frag1', source: 'test' }]);
    soulText.fragments.set('cat2', [{ text: 'frag2', source: 'test' }]);
    soulText.fragments.set('cat3', [{ text: 'frag3', source: 'test' }]);
    soulText.fragments.set('cat4', [{ text: 'frag4', source: 'test' }]);
    const prompt = buildRetakeSystemPrompt(makeInput({ soulText }));

    expect(prompt).toContain('frag1');
    expect(prompt).toContain('frag2');
    expect(prompt).toContain('frag3');
    expect(prompt).not.toContain('frag4');
  });
});

// --- buildRetakeUserPrompt ---

describe('buildRetakeUserPrompt', () => {
  it('should include original text and feedback', () => {
    const prompt = buildRetakeUserPrompt('元テキスト', '文体が弱い');

    expect(prompt).toContain('## 書き直し対象テキスト');
    expect(prompt).toContain('元テキスト');
    expect(prompt).toContain('## フィードバック（修正すべき問題）');
    expect(prompt).toContain('文体が弱い');
  });

  it('should include character count constraints', () => {
    const originalText = 'あ'.repeat(1000);
    const prompt = buildRetakeUserPrompt(originalText, 'フィードバック');

    expect(prompt).toContain('【文字数厳守】');
    expect(prompt).toContain('1000文字');
    expect(prompt).toContain('900');
    expect(prompt).toContain('1100');
  });

  it('should include closing instruction', () => {
    const prompt = buildRetakeUserPrompt('テキスト', 'フィードバック');

    expect(prompt).toContain('テキスト全体を原作の文体に忠実に書き直してください');
    expect(prompt).toContain('元のプロット・シーン展開は維持');
  });
});
