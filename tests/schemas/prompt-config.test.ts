import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import {
  PromptConfigSchema,
  DEFAULT_PROMPT_CONFIG,
} from '../../src/schemas/prompt-config.js';

describe('PromptConfigSchema', () => {
  it('should validate a minimal config with only defaults', () => {
    const minimal = {
      defaults: {
        protagonist_short: '透心',
        pronoun: 'わたし',
      },
    };
    const result = PromptConfigSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should validate a full config with all fields', () => {
    const full = {
      defaults: {
        protagonist_short: '透心',
        protagonist_full: '御鐘透心',
        pronoun: 'わたし',
        prohibited_pronouns: ['私', '僕', '俺'],
      },
      metaphor_rules: [
        '「ライオン」はタイトルのメタファーであり、作中世界には存在しない',
        'ライオンという語は内面の比喩としてのみ使用可。具現化・実体化は禁止',
      ],
      character_constraints: {
        '愛原つるぎ': [
          'つるぎは透心の案内役やメンターではない',
          'つるぎは解説しない。行動と沈黙で語る',
        ],
      },
      scene_catalog: [
        '教室での内面描写',
        '屋上での非公式な対話',
      ],
      timeline_catalog: [
        '出会い前（孤立期）',
        '出会い直後（衝撃と混乱）',
      ],
      ideation_strategies: [
        'What if：ARタグが全員から消えた日',
      ],
      pov_rules: {
        'first-person': {
          description: '一人称（わたし）視点。御鐘透心の内面から語る',
          rules: [
            '一人称は必ず「わたし」（ひらがな）を使用。「私」「僕」「俺」は禁止',
            '視点は御鐘透心の一人称のみ。三人称的な外部描写は禁止',
          ],
        },
        'third-person': {
          description: '三人称限定視点。透心を中心に描写',
          rules: [
            '三人称限定視点で「透心」を中心に描写',
          ],
        },
      },
      agents: {
        writer: {
          critical_rules: [
            'Markdown記法は絶対に使用しない',
          ],
        },
        judge: {
          penalty_items: [
            'つるぎの台詞が説明的 → 減点',
          ],
          character_voice_rules: {
            '愛原つるぎ': '短い台詞、皮肉混じり、哲学的',
          },
        },
        character_developer: {
          casting_rules: [
            '「叔父」は物語に不可欠な場合のみ登場',
          ],
        },
      },
    };
    const result = PromptConfigSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults.protagonist_short).toBe('透心');
      expect(result.data.character_constraints?.['愛原つるぎ']).toHaveLength(2);
      expect(result.data.pov_rules?.['first-person']?.rules).toHaveLength(2);
      expect(result.data.agents?.judge?.penalty_items).toHaveLength(1);
    }
  });

  it('should reject config without defaults', () => {
    const invalid = {
      metaphor_rules: ['test'],
    };
    const result = PromptConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject config with empty protagonist_short', () => {
    const invalid = {
      defaults: {
        protagonist_short: '',
        pronoun: 'わたし',
      },
    };
    const result = PromptConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept agent configs with unknown extra fields via catchall', () => {
    const config = {
      defaults: {
        protagonist_short: '透心',
        pronoun: 'わたし',
      },
      agents: {
        theme_generator: {
          world_description: 'AR/MRテクノロジーが浸透した近未来',
          custom_field: 'any value',
        },
      },
    };
    const result = PromptConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should validate DEFAULT_PROMPT_CONFIG as empty defaults', () => {
    // DEFAULT_PROMPT_CONFIG has empty strings, which fail min(1) validation
    // This is intentional - it's a fallback, not a valid config
    const result = PromptConfigSchema.safeParse(DEFAULT_PROMPT_CONFIG);
    expect(result.success).toBe(false);
  });

  it('should validate the actual soul/prompt-config.yaml file', () => {
    const raw = readFileSync('soul/prompt-config.yaml', 'utf-8');
    const data = yaml.load(raw);
    const result = PromptConfigSchema.safeParse(data);

    expect(result.success).toBe(true);
    if (result.success) {
      // 基本構造の存在確認のみ（要素数はsoul設定の変更に伴い変わるためチェックしない）
      expect(result.data.defaults.protagonist_short).toBe('透心');
      expect(result.data.defaults.pronoun).toBe('わたし');
      expect(result.data.character_constraints?.['愛原つるぎ']?.length).toBeGreaterThan(0);
      expect(result.data.scene_catalog?.length).toBeGreaterThan(0);
      expect(result.data.timeline_catalog?.length).toBeGreaterThan(0);
      expect(result.data.ideation_strategies?.length).toBeGreaterThan(0);
      expect(result.data.pov_rules?.['first-person']?.rules?.length).toBeGreaterThan(0);
      expect(result.data.agents?.writer?.critical_rules?.length).toBeGreaterThan(0);
      expect(result.data.agents?.judge?.penalty_items?.length).toBeGreaterThan(0);
      expect(result.data.agents?.character_developer?.casting_rules?.length).toBeGreaterThan(0);
    }
  });
});
