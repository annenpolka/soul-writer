import { describe, it, expect } from 'vitest';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import { resolveNarrativeRules } from '../../../src/factory/narrative-rules.js';
import type { JudgeContextInput } from '../../../src/agents/context/judge-context.js';
import { buildJudgeContext } from '../../../src/agents/context/judge-context.js';

function makeInput(overrides?: Partial<JudgeContextInput>): JudgeContextInput {
  return {
    soulText: createMockSoulText(),
    narrativeRules: resolveNarrativeRules(),
    textA: 'テキストA',
    textB: 'テキストB',
    ...overrides,
  };
}

describe('buildJudgeContext', () => {
  it('should include textA and textB', () => {
    const ctx = buildJudgeContext(makeInput());

    expect(ctx.textA).toBe('テキストA');
    expect(ctx.textB).toBe('テキストB');
  });

  it('should include narrativeRules', () => {
    const ctx = buildJudgeContext(makeInput());

    expect(ctx.narrativeRules).toBeDefined();
  });

  it('should include constitution', () => {
    const ctx = buildJudgeContext(makeInput());

    expect(ctx.constitution).toBeDefined();
  });

  describe('criteriaEntries', () => {
    it('should include 6 criteria entries', () => {
      const ctx = buildJudgeContext(makeInput());
      const entries = ctx.criteriaEntries as Array<{ text: string }>;

      expect(entries).toHaveLength(6);
    });

    it('should use default protagonist criteria when isDefaultProtagonist and first-person', () => {
      const narrativeRules = resolveNarrativeRules(); // default: first-person, isDefaultProtagonist=true
      const ctx = buildJudgeContext(makeInput({ narrativeRules }));
      const entries = ctx.criteriaEntries as Array<{ text: string }>;

      expect(entries[0].text).toContain('語り声の再現');
      expect(entries[0].text).toContain('一人称「わたし」');
      expect(entries[1].text).toContain('世界観忠実度');
      expect(entries[1].text).toContain('新規キャラクターの登場は減点対象ではない');
    });

    it('should use generic criteria when not default protagonist', () => {
      const narrativeRules = resolveNarrativeRules('三人称', [{ name: '別キャラ', isNew: true }]);
      const ctx = buildJudgeContext(makeInput({ narrativeRules }));
      const entries = ctx.criteriaEntries as Array<{ text: string }>;

      expect(entries[0].text).toContain('語り声の一貫性');
      expect(entries[1].text).toContain('世界観忠実度');
    });
  });

  describe('penaltyEntries', () => {
    it('should include default protagonist penalties when isDefaultProtagonist and first-person', () => {
      const ctx = buildJudgeContext(makeInput());
      const entries = ctx.penaltyEntries as Array<{ text: string }>;

      expect(entries.some(e => e.text.includes('「私」表記'))).toBe(true);
      // 「原作にない設定やキャラクターの捏造」ペナルティは削除済み
      expect(entries.some(e => e.text.includes('原作にない設定やキャラクターの捏造'))).toBe(false);
    });

    it('should include generic penalties when not default protagonist', () => {
      const narrativeRules = resolveNarrativeRules('三人称', [{ name: '別キャラ', isNew: true }]);
      const ctx = buildJudgeContext(makeInput({ narrativeRules }));
      const entries = ctx.penaltyEntries as Array<{ text: string }>;

      expect(entries.some(e => e.text.includes('視点の一貫性'))).toBe(true);
      expect(entries.some(e => e.text.includes('世界観に存在し得ない'))).toBe(true);
    });

    it('should include promptConfig penalty_items', () => {
      const soulText = createMockSoulText({
        deep: {
          promptConfig: {
            defaults: { protagonist_short: '透心', pronoun: 'わたし' },
            agents: {
              judge: {
                penalty_items: ['カスタムペナルティ1'],
              },
            },
          },
        },
      });
      const ctx = buildJudgeContext(makeInput({ soulText }));
      const entries = ctx.penaltyEntries as Array<{ text: string }>;

      expect(entries.some(e => e.text === 'カスタムペナルティ1')).toBe(true);
    });

    it('should always include cliche and verbosity penalties at the end', () => {
      const ctx = buildJudgeContext(makeInput());
      const entries = ctx.penaltyEntries as Array<{ text: string }>;

      expect(entries.some(e => e.text.includes('陳腐な比喩'))).toBe(true);
      expect(entries.some(e => e.text.includes('装飾過多'))).toBe(true);
    });
  });

  describe('voiceEntries', () => {
    it('should use character_voice_rules from promptConfig when available', () => {
      const soulText = createMockSoulText({
        deep: {
          promptConfig: {
            defaults: { protagonist_short: '透心', pronoun: 'わたし' },
            agents: {
              judge: {
                character_voice_rules: {
                  '透心': '冷徹',
                  'つるぎ': '皮肉',
                },
              },
            },
          },
        },
      });
      const ctx = buildJudgeContext(makeInput({ soulText }));
      const entries = ctx.voiceEntries as Array<{ name: string; style: string }>;

      expect(entries).toEqual([
        { name: '透心', style: '冷徹' },
        { name: 'つるぎ', style: '皮肉' },
      ]);
    });

    it('should fall back to constitution dialogue_style_by_character', () => {
      const soulText = createMockSoulText({
        deep: {
          constitution: {
            protagonist_specific: {
              sentence_structure: { rhythm_pattern: 'test', taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] }, typical_lengths: { short: 'test', long: 'test', forbidden: 'test' } },
              narrative: {
                default_pov: 'test', pov_by_character: {}, default_tense: 'test',
                tense_shift_allowed: 'test', dialogue_ratio: 'test',
                dialogue_style_by_character: { '御鐘透心': 'ぶっきらぼう' },
              },
              scene_modes: { mundane: { description: 'test', style: 'test' }, tension: { description: 'test', style: 'test' } },
              dry_humor: { description: 'test', techniques: [], frequency: 'test' },
            },
          },
        },
      });
      const ctx = buildJudgeContext(makeInput({ soulText }));
      const entries = ctx.voiceEntries as Array<{ name: string; style: string }>;

      expect(entries).toEqual([
        { name: '御鐘透心', style: 'ぶっきらぼう' },
      ]);
    });
  });

  describe('antiSoulCompactEntries', () => {
    it('should be undefined when no anti-soul entries exist', () => {
      const ctx = buildJudgeContext(makeInput());

      expect(ctx.antiSoulCompactEntries).toBeUndefined();
    });

    it('should limit to 1 example per category and 100 chars', () => {
      const longText = 'あ'.repeat(200);
      const soulText = createMockSoulText({
        deep: {
          antiSoul: {
            categories: {
              theme_violation: [
                { text: longText, reason: 'r1' },
                { text: 'second', reason: 'r2' },
              ],
            },
          },
        },
      });
      const ctx = buildJudgeContext(makeInput({ soulText }));
      const entries = ctx.antiSoulCompactEntries as Array<{ category: string; text: string; reason: string }>;

      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('theme_violation');
      expect(entries[0].text).toHaveLength(100);
      expect(entries[0].reason).toBe('r1');
    });
  });

  describe('fragmentCompactCategories', () => {
    it('should be undefined when no fragments exist', () => {
      const ctx = buildJudgeContext(makeInput());

      expect(ctx.fragmentCompactCategories).toBeUndefined();
    });

    it('should include max 4 categories with 1 fragment each', () => {
      const soulText = createMockSoulText();
      soulText.fragments.set('opening', [{ text: 'open1' }, { text: 'open2' }]);
      soulText.fragments.set('dialogue', [{ text: 'dial1' }]);
      soulText.fragments.set('killing', [{ text: 'kill1' }]);
      soulText.fragments.set('introspection', [{ text: 'intro1' }]);
      soulText.fragments.set('symbolism', [{ text: 'sym1' }]);

      const ctx = buildJudgeContext(makeInput({ soulText }));
      const entries = ctx.fragmentCompactCategories as Array<{ name: string; text: string }>;

      expect(entries).toHaveLength(4);
      // Each entry has only 1 text (first fragment)
      expect(entries[0].text).toBe('open1');
    });

    it('should skip categories with zero fragments', () => {
      const soulText = createMockSoulText();
      soulText.fragments.set('opening', []);
      soulText.fragments.set('dialogue', [{ text: 'dial1' }]);

      const ctx = buildJudgeContext(makeInput({ soulText }));
      const entries = ctx.fragmentCompactCategories as Array<{ name: string; text: string }>;

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('dialogue');
    });
  });

  describe('themeContext', () => {
    it('should include themeContext when provided', () => {
      const themeContext = createMockThemeContext();
      const ctx = buildJudgeContext(makeInput({ themeContext }));

      expect(ctx.themeContext).toEqual(themeContext);
    });

    it('should not include themeContext when absent', () => {
      const ctx = buildJudgeContext(makeInput());

      expect(ctx).not.toHaveProperty('themeContext');
    });
  });
});
