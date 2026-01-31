import { describe, it, expect } from 'vitest';
import { resolveSoulRef } from '../../src/template/soul-resolver.js';
import type { PromptConfig } from '../../src/schemas/prompt-config.js';
import type { SoulText } from '../../src/soul/manager.js';

const mockPromptConfig: PromptConfig = {
  defaults: { protagonist_short: '透心', pronoun: 'わたし' },
  agents: {
    writer: {
      critical_rules: ['rule1', 'rule2'],
    },
    judge: {
      penalty_items: ['penalty1'],
    },
  },
  metaphor_rules: ['metaphor1'],
  character_constraints: {
    'つるぎ': ['constraint1'],
  },
};

const mockSoulText = {
  constitution: {
    universal: {
      thematic_constraints: {
        must_preserve: ['存在確認'],
        forbidden_resolutions: [],
      },
    },
  },
  worldBible: {
    characters: {
      '透心': { role: 'protagonist' },
    },
  },
} as unknown as SoulText;

describe('resolveSoulRef', () => {
  it('resolves agent-specific config: soul://writer.critical_rules', () => {
    const result = resolveSoulRef('soul://writer.critical_rules', mockPromptConfig, mockSoulText);
    expect(result).toEqual(['rule1', 'rule2']);
  });

  it('resolves top-level config: soul://metaphor_rules', () => {
    const result = resolveSoulRef('soul://metaphor_rules', mockPromptConfig, mockSoulText);
    expect(result).toEqual(['metaphor1']);
  });

  it('resolves nested agent config: soul://judge.penalty_items', () => {
    const result = resolveSoulRef('soul://judge.penalty_items', mockPromptConfig, mockSoulText);
    expect(result).toEqual(['penalty1']);
  });

  it('resolves defaults: soul://defaults.protagonist_short', () => {
    const result = resolveSoulRef('soul://defaults.protagonist_short', mockPromptConfig, mockSoulText);
    expect(result).toBe('透心');
  });

  it('resolves character_constraints: soul://character_constraints.つるぎ', () => {
    const result = resolveSoulRef('soul://character_constraints.つるぎ', mockPromptConfig, mockSoulText);
    expect(result).toEqual(['constraint1']);
  });

  it('returns undefined for missing ref', () => {
    const result = resolveSoulRef('soul://nonexistent', mockPromptConfig, mockSoulText);
    expect(result).toBeUndefined();
  });

  it('resolves soultext:// refs to SoulText data', () => {
    const result = resolveSoulRef('soultext://worldBible.characters', mockPromptConfig, mockSoulText);
    expect(result).toEqual({ '透心': { role: 'protagonist' } });
  });

  it('throws on invalid protocol', () => {
    expect(() => resolveSoulRef('http://invalid', mockPromptConfig, mockSoulText)).toThrow();
  });
});
