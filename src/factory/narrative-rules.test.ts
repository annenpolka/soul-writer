import { describe, it, expect } from 'vitest';
import { resolveNarrativeRules, buildPovRules } from './narrative-rules.js';
import type { Character } from '../schemas/generated-theme.js';
import type { PromptConfig } from '../schemas/prompt-config.js';

describe('resolveNarrativeRules', () => {
  it('defaults to first-person わたし with 透心', () => {
    const rules = resolveNarrativeRules();
    expect(rules.pov).toBe('first-person');
    expect(rules.pronoun).toBe('わたし');
    expect(rules.isDefaultProtagonist).toBe(true);
  });

  it('detects 透心 absence from characters', () => {
    const chars: Character[] = [{ name: '山田太郎', isNew: true, description: 'モブ' }];
    const rules = resolveNarrativeRules(undefined, chars);
    expect(rules.isDefaultProtagonist).toBe(false);
    expect(rules.pronoun).toBeNull();
  });

  it('detects 透心 presence from characters', () => {
    const chars: Character[] = [
      { name: '御鐘透心', isNew: false },
      { name: '愛原つるぎ', isNew: false },
    ];
    const rules = resolveNarrativeRules(undefined, chars);
    expect(rules.isDefaultProtagonist).toBe(true);
    expect(rules.pronoun).toBe('わたし');
  });

  it('resolves 三人称限定視点', () => {
    const rules = resolveNarrativeRules('三人称限定視点');
    expect(rules.pov).toBe('third-person-limited');
    expect(rules.pronoun).toBeNull();
    expect(rules.protagonistName).toBe('透心');
  });

  it('resolves 三人称 without default protagonist', () => {
    const chars: Character[] = [{ name: '新キャラ', isNew: true, description: 'test' }];
    const rules = resolveNarrativeRules('三人称限定視点', chars);
    expect(rules.protagonistName).toBeNull();
    expect(rules.isDefaultProtagonist).toBe(false);
  });

  it('resolves 群像劇', () => {
    const rules = resolveNarrativeRules('群像劇（複数視点の交差）');
    expect(rules.pov).toBe('mixed');
    expect(rules.pronoun).toBeNull();
  });

  it('resolves 書簡体・ログ形式', () => {
    const rules = resolveNarrativeRules('書簡体・ログ形式');
    expect(rules.pov).toBe('first-person');
    expect(rules.pronoun).toBeNull();
  });

  it('resolves 断片的叙述', () => {
    const rules = resolveNarrativeRules('断片的叙述（記憶の欠落）');
    expect(rules.pov).toBe('mixed');
  });

  it('resolves 時系列逆転', () => {
    const rules = resolveNarrativeRules('時系列逆転（結末から始まる）');
    expect(rules.pov).toBe('first-person');
    expect(rules.pronoun).toBe('わたし');
  });

  it('resolves 反復構造', () => {
    const rules = resolveNarrativeRules('反復構造（同じシーンの変奏）');
    expect(rules.pov).toBe('first-person');
  });

  it('falls back to first-person for unknown type', () => {
    const rules = resolveNarrativeRules('未知の型');
    expect(rules.pov).toBe('first-person');
  });
});

describe('buildPovRules', () => {
  it('generates first-person rules with pronoun for default protagonist', () => {
    const rules = resolveNarrativeRules();
    const lines = buildPovRules(rules);
    expect(lines.some(l => l.includes('わたし'))).toBe(true);
  });

  it('generates third-person rules', () => {
    const rules = resolveNarrativeRules('三人称限定視点');
    const lines = buildPovRules(rules);
    expect(lines.some(l => l.includes('三人称限定視点'))).toBe(true);
    expect(lines.some(l => l.includes('一人称は地の文で使用禁止'))).toBe(true);
  });

  it('generates mixed rules', () => {
    const rules = resolveNarrativeRules('群像劇');
    const lines = buildPovRules(rules);
    expect(lines.some(l => l.includes('複数視点'))).toBe(true);
  });

  it('generates first-person rules without fixed pronoun', () => {
    const rules = resolveNarrativeRules('書簡体');
    const lines = buildPovRules(rules);
    expect(lines.some(l => l.includes('一人称視点で語る'))).toBe(true);
  });

  it('omits 透心 references for non-default protagonist', () => {
    const chars: Character[] = [{ name: '新キャラ', isNew: true, description: 'test' }];
    const rules = resolveNarrativeRules(undefined, chars);
    const lines = buildPovRules(rules);
    expect(lines.every(l => !l.includes('透心'))).toBe(true);
  });
});

describe('prompt-config integration', () => {
  const promptConfig: PromptConfig = {
    defaults: {
      protagonist_short: '透心',
      protagonist_full: '御鐘透心',
      pronoun: 'わたし',
      prohibited_pronouns: ['私', '僕', '俺'],
    },
    pov_rules: {
      'first-person': {
        description: '一人称（わたし）視点。御鐘透心の内面から語る',
        rules: [
          '一人称は必ず「わたし」（ひらがな）を使用。「私」「僕」「俺」は禁止',
        ],
      },
      'third-person': {
        description: '三人称限定視点。透心を「透心」と呼び、彼女の内面に限定して描写する',
        rules: [
          '三人称限定視点で「透心」を中心に描写',
          '「透心」の内面のみ描写可。他キャラの心理は行動・台詞から推測させる',
        ],
      },
    },
  };

  it('should use pov_rules description from promptConfig for first-person', () => {
    const customConfig: PromptConfig = {
      ...promptConfig,
      pov_rules: {
        'first-person': {
          description: 'カスタム一人称視点の説明',
          rules: ['カスタムルール1'],
        },
      },
    };
    const rules = resolveNarrativeRules(undefined, undefined, customConfig);
    expect(rules.povDescription).toBe('カスタム一人称視点の説明');
  });

  it('should use pov_rules description from promptConfig for third-person', () => {
    const customConfig: PromptConfig = {
      ...promptConfig,
      pov_rules: {
        'third-person': {
          description: 'カスタム三人称視点の説明',
          rules: ['カスタムルール2'],
        },
      },
    };
    const rules = resolveNarrativeRules('三人称限定視点', undefined, customConfig);
    expect(rules.povDescription).toBe('カスタム三人称視点の説明');
  });

  it('should use protagonist_short from promptConfig defaults', () => {
    const rules = resolveNarrativeRules('三人称限定視点', undefined, promptConfig);
    expect(rules.protagonistName).toBe('透心');
  });

  it('should use pronoun from promptConfig defaults', () => {
    const rules = resolveNarrativeRules(undefined, undefined, promptConfig);
    expect(rules.pronoun).toBe('わたし');
  });

  it('should use pov_rules for buildPovRules', () => {
    const rules = resolveNarrativeRules(undefined, undefined, promptConfig);
    const lines = buildPovRules(rules, promptConfig);
    expect(lines).toContain('- 一人称は必ず「わたし」（ひらがな）を使用。「私」「僕」「俺」は禁止');
  });

  it('should use custom pov_rules for buildPovRules', () => {
    const customConfig: PromptConfig = {
      ...promptConfig,
      pov_rules: {
        'first-person': {
          description: 'カスタム',
          rules: ['カスタムPOVルール1', 'カスタムPOVルール2'],
        },
      },
    };
    const rules = resolveNarrativeRules(undefined, undefined, customConfig);
    const lines = buildPovRules(rules, customConfig);
    expect(lines).toContain('- カスタムPOVルール1');
    expect(lines).toContain('- カスタムPOVルール2');
  });

  it('should use pov_rules for buildPovRules with third-person', () => {
    const rules = resolveNarrativeRules('三人称限定視点', undefined, promptConfig);
    const lines = buildPovRules(rules, promptConfig);
    expect(lines).toContain('- 三人称限定視点で「透心」を中心に描写');
    expect(lines).toContain('- 「透心」の内面のみ描写可。他キャラの心理は行動・台詞から推測させる');
  });
});
