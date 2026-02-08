import { describe, it, expect } from 'vitest';
import { buildSynthesisExecutorContext, type SynthesisExecutorContextInput } from '../../../src/agents/context/synthesis-executor-context.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import { createMockThemeContext } from '../../helpers/mock-deps.js';
import type { ImprovementPlan } from '../../../src/agents/types.js';
import type { NarrativeRules } from '../../../src/factory/narrative-rules.js';

function createMockNarrativeRules(overrides?: Partial<NarrativeRules>): NarrativeRules {
  return {
    pov: 'first-person',
    pronoun: 'わたし',
    protagonistName: null,
    povDescription: '一人称・わたし視点',
    isDefaultProtagonist: true,
    ...overrides,
  };
}

function createMockPlan(overrides?: Partial<ImprovementPlan>): ImprovementPlan {
  return {
    championAssessment: '勝者テキストの文体は安定している',
    preserveElements: ['冒頭の比喩', '透心の内面描写'],
    actions: [
      {
        section: '展開',
        type: 'expression_upgrade',
        description: 'writer_2の比喩を取り入れ',
        source: 'writer_2',
        priority: 'high',
      },
      {
        section: '結末',
        type: 'tension_enhancement',
        description: 'クライマックスの緊張感を強化',
        source: 'writer_3',
        priority: 'medium',
      },
      {
        section: '導入',
        type: 'imagery_injection',
        description: 'AR描写を追加',
        source: 'writer_4',
        priority: 'low',
      },
    ],
    expressionSources: [
      {
        writerId: 'writer_2',
        expressions: ['月光が砕けた', 'ARの残像が揺れる'],
        context: '情景描写',
      },
    ],
    ...overrides,
  };
}

describe('buildSynthesisExecutorContext', () => {
  it('should include championText and ImprovementPlan in context', () => {
    const input: SynthesisExecutorContextInput = {
      soulText: createMockSoulText(),
      championText: '勝者テキスト内容',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisExecutorContext(input);

    expect(ctx.championText).toBe('勝者テキスト内容');
    expect(ctx.plan).toBeDefined();
    const plan = ctx.plan as ImprovementPlan;
    expect(plan.championAssessment).toBeDefined();
    expect(plan.actions).toHaveLength(3);
  });

  it('should sort actions by priority (high -> medium -> low)', () => {
    const input: SynthesisExecutorContextInput = {
      soulText: createMockSoulText(),
      championText: 'text',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisExecutorContext(input);

    const sortedActions = ctx.sortedActions as Array<{ priority: string; section: string }>;
    expect(sortedActions[0].priority).toBe('high');
    expect(sortedActions[1].priority).toBe('medium');
    expect(sortedActions[2].priority).toBe('low');
  });

  it('should include constitution style rules (rhythm, forbidden_words, similes)', () => {
    const soulText = createMockSoulText();
    const input: SynthesisExecutorContextInput = {
      soulText,
      championText: 'text',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisExecutorContext(input);

    expect(ctx.styleRules).toBeDefined();
    const rules = ctx.styleRules as {
      rhythm: string;
      forbiddenWords: string[];
      forbiddenSimiles: string[];
      simileBase: string;
      povDescription: string;
      pronoun: string | null;
    };
    expect(rules.rhythm).toBeDefined();
    expect(rules.forbiddenWords).toBeDefined();
    expect(rules.forbiddenSimiles).toBeDefined();
    expect(rules.simileBase).toBeDefined();
    expect(rules.povDescription).toBe('一人称・わたし視点');
    expect(rules.pronoun).toBe('わたし');
  });

  it('should include themeContext when provided', () => {
    const themeContext = createMockThemeContext();
    const input: SynthesisExecutorContextInput = {
      soulText: createMockSoulText(),
      championText: 'text',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
      themeContext,
    };

    const ctx = buildSynthesisExecutorContext(input);

    expect(ctx.themeContext).toBeDefined();
    const tc = ctx.themeContext as { emotion: string };
    expect(tc.emotion).toBe('孤独');
  });

  it('should work without optional themeContext', () => {
    const input: SynthesisExecutorContextInput = {
      soulText: createMockSoulText(),
      championText: 'text',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisExecutorContext(input);

    expect(ctx.themeContext).toBeUndefined();
  });

  it('should include preserveElements', () => {
    const input: SynthesisExecutorContextInput = {
      soulText: createMockSoulText(),
      championText: 'text',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisExecutorContext(input);

    const preserve = ctx.preserveElements as string[];
    expect(preserve).toHaveLength(2);
    expect(preserve).toContain('冒頭の比喩');
  });

  it('should include expressionSources', () => {
    const input: SynthesisExecutorContextInput = {
      soulText: createMockSoulText(),
      championText: 'text',
      plan: createMockPlan(),
      narrativeRules: createMockNarrativeRules(),
    };

    const ctx = buildSynthesisExecutorContext(input);

    const sources = ctx.expressionSources as Array<{ writerId: string; expressions: string[] }>;
    expect(sources).toHaveLength(1);
    expect(sources[0].writerId).toBe('writer_2');
    expect(sources[0].expressions).toHaveLength(2);
  });
});
