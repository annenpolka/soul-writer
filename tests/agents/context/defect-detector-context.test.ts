import { describe, it, expect } from 'vitest';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import type { DefectDetectorContextInput } from '../../../src/agents/context/defect-detector-context.js';
import { buildDefectDetectorContext } from '../../../src/agents/context/defect-detector-context.js';
import type { TextWeakness, AxisComment, Violation } from '../../../src/agents/types.js';

function makeInput(overrides?: Partial<DefectDetectorContextInput>): DefectDetectorContextInput {
  return {
    soulText: createMockSoulText(),
    text: 'テスト対象テキスト',
    ...overrides,
  };
}

describe('buildDefectDetectorContext', () => {
  it('should include the target text', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    expect(ctx.text).toBe('テスト対象テキスト');
  });

  it('should include constitution rules summary', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    expect(ctx.constitutionRules).toBeDefined();
    const rules = ctx.constitutionRules as Record<string, unknown>;
    expect(rules.forbiddenWords).toBeDefined();
    expect(rules.forbiddenSimiles).toBeDefined();
    expect(rules.thematicMustPreserve).toBeDefined();
    expect(rules.forbiddenResolutions).toBeDefined();
  });

  it('should extract forbidden words from constitution', () => {
    const soulText = createMockSoulText({
      forbiddenWords: ['literally', 'basically'],
    });
    const ctx = buildDefectDetectorContext(makeInput({ soulText }));
    const rules = ctx.constitutionRules as Record<string, unknown>;
    expect(rules.forbiddenWords).toEqual(['literally', 'basically']);
  });

  it('should extract forbidden similes from constitution', () => {
    const soulText = createMockSoulText({
      forbiddenSimiles: ['like a dead fish'],
    });
    const ctx = buildDefectDetectorContext(makeInput({ soulText }));
    const rules = ctx.constitutionRules as Record<string, unknown>;
    expect(rules.forbiddenSimiles).toEqual(['like a dead fish']);
  });

  it('should extract thematic must_preserve from constitution', () => {
    const soulText = createMockSoulText({
      thematicMustPreserve: ['isolation', 'yearning'],
    });
    const ctx = buildDefectDetectorContext(makeInput({ soulText }));
    const rules = ctx.constitutionRules as Record<string, unknown>;
    expect(rules.thematicMustPreserve).toEqual(['isolation', 'yearning']);
  });

  it('should include anti-soul patterns', () => {
    const soulText = createMockSoulText({
      deep: {
        antiSoul: {
          categories: {
            theme_violation: [
              { text: 'bad text 1', reason: 'violates theme' },
              { text: 'bad text 2', reason: 'also bad' },
            ],
            cliche_simile: [
              { text: 'cliche 1', reason: 'overused' },
            ],
          },
        },
      },
    });
    const ctx = buildDefectDetectorContext(makeInput({ soulText }));
    const patterns = ctx.antiSoulPatterns as Array<{ category: string; text: string; reason: string }>;
    expect(patterns).toBeDefined();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.category === 'theme_violation')).toBe(true);
    expect(patterns.some(p => p.category === 'cliche_simile')).toBe(true);
  });

  it('should limit anti-soul patterns to 2 per category', () => {
    const soulText = createMockSoulText({
      deep: {
        antiSoul: {
          categories: {
            theme_violation: [
              { text: 'bad 1', reason: 'r1' },
              { text: 'bad 2', reason: 'r2' },
              { text: 'bad 3', reason: 'r3' },
            ],
          },
        },
      },
    });
    const ctx = buildDefectDetectorContext(makeInput({ soulText }));
    const patterns = ctx.antiSoulPatterns as Array<{ category: string; text: string; reason: string }>;
    const themePatterns = patterns.filter(p => p.category === 'theme_violation');
    expect(themePatterns).toHaveLength(2);
  });

  it('should return empty antiSoulPatterns when no anti-soul entries exist', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    const patterns = ctx.antiSoulPatterns as Array<{ category: string; text: string; reason: string }>;
    expect(patterns).toEqual([]);
  });

  it('should include defect category list', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    const categories = ctx.defectCategories as Array<{ name: string; description: string }>;
    expect(categories).toBeDefined();
    expect(categories.length).toBeGreaterThan(0);
    // Should include common defect categories
    const names = categories.map(c => c.name);
    expect(names).toContain('character_inconsistency');
    expect(names).toContain('plot_contradiction');
    expect(names).toContain('pacing_issue');
    expect(names).toContain('motif_fatigue');
    expect(names).toContain('style_deviation');
  });

  it('should include tone_drift in defect categories', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    const categories = ctx.defectCategories as Array<{ name: string; description: string }>;
    const names = categories.map(c => c.name);
    expect(names).toContain('tone_drift');
  });

  it('should include motif_overuse in defect categories', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    const categories = ctx.defectCategories as Array<{ name: string; description: string }>;
    const names = categories.map(c => c.name);
    expect(names).toContain('motif_overuse');
  });

  it('should include toneDirective when provided', () => {
    const ctx = buildDefectDetectorContext(makeInput({ toneDirective: 'ドライユーモアのトーン' }));
    expect(ctx.toneDirective).toBe('ドライユーモアのトーン');
  });

  it('should not include toneDirective when not provided', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    expect(ctx).not.toHaveProperty('toneDirective');
  });

  it('should include character names from world bible', () => {
    const soulText = createMockSoulText({
      characters: {
        '御鐘透心': { role: '主人公' },
        '愛原つるぎ': { role: 'ハッカー' },
      },
    });
    const ctx = buildDefectDetectorContext(makeInput({ soulText }));
    const characters = ctx.characters as Array<{ name: string; role: string }>;
    expect(characters).toBeDefined();
    expect(characters).toHaveLength(2);
    expect(characters.some(c => c.name === '御鐘透心')).toBe(true);
    expect(characters.some(c => c.name === '愛原つるぎ')).toBe(true);
  });

  it('should include judgeAnalysis when judgeWeaknesses are provided', () => {
    const weaknesses: TextWeakness[] = [
      { category: 'pacing', severity: 'major', description: 'テンポが遅い', suggestedFix: 'シーンを削減' },
    ];
    const ctx = buildDefectDetectorContext(makeInput({ judgeWeaknesses: weaknesses }));
    const analysis = ctx.judgeAnalysis as { weaknesses: Array<{ category: string; description: string }> };
    expect(analysis).toBeDefined();
    expect(analysis.weaknesses).toHaveLength(1);
    expect(analysis.weaknesses[0].category).toBe('pacing');
    expect(analysis.weaknesses[0].description).toBe('テンポが遅い');
  });

  it('should include judgeAnalysis when judgeAxisComments are provided', () => {
    const axisComments: AxisComment[] = [
      { axis: 'style', commentA: '文体が優れている', commentB: '文体に難あり' },
    ];
    const ctx = buildDefectDetectorContext(makeInput({ judgeAxisComments: axisComments }));
    const analysis = ctx.judgeAnalysis as { axisComments: Array<{ axis: string; comment: string }> };
    expect(analysis).toBeDefined();
    expect(analysis.axisComments).toHaveLength(1);
    expect(analysis.axisComments[0].axis).toBe('style');
  });

  it('should not include judgeAnalysis when no judge data provided', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    expect(ctx).not.toHaveProperty('judgeAnalysis');
  });

  it('should include complianceWarnings when provided', () => {
    const warnings: Violation[] = [
      { type: 'self_repetition', position: { start: 0, end: 10 }, context: '繰り返しあり', rule: '自己反復チェック', severity: 'warning' },
    ];
    const ctx = buildDefectDetectorContext(makeInput({ complianceWarnings: warnings }));
    const cw = ctx.complianceWarnings as Array<{ type: string; context: string; rule: string }>;
    expect(cw).toBeDefined();
    expect(cw).toHaveLength(1);
    expect(cw[0].type).toBe('self_repetition');
    expect(cw[0].context).toBe('繰り返しあり');
  });

  it('should not include complianceWarnings when not provided', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    expect(ctx).not.toHaveProperty('complianceWarnings');
  });

  it('should not include complianceWarnings when empty array provided', () => {
    const ctx = buildDefectDetectorContext(makeInput({ complianceWarnings: [] }));
    expect(ctx).not.toHaveProperty('complianceWarnings');
  });

  it('should include judgeReasoning when provided', () => {
    const ctx = buildDefectDetectorContext(makeInput({ judgeReasoning: 'Judge推論: テキストの構成に問題あり' }));
    expect(ctx.judgeReasoning).toBe('Judge推論: テキストの構成に問題あり');
  });

  it('should not include judgeReasoning when null', () => {
    const ctx = buildDefectDetectorContext(makeInput({ judgeReasoning: null }));
    expect(ctx).not.toHaveProperty('judgeReasoning');
  });

  it('should not include judgeReasoning when not provided', () => {
    const ctx = buildDefectDetectorContext(makeInput());
    expect(ctx).not.toHaveProperty('judgeReasoning');
  });
});
