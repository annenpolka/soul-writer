import { describe, it, expect } from 'vitest';
import { resolveNarrativeRules, buildPovRules } from './narrative-rules.js';
import type { Character } from '../schemas/generated-theme.js';

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
    expect(lines.some(l => l.includes('御鐘透心'))).toBe(true);
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
