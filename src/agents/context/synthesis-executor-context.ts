import type { SoulText } from '../../soul/manager.js';
import type { ImprovementPlan, ImprovementAction, ThemeContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';

/**
 * Input for buildSynthesisExecutorContext
 */
export interface SynthesisExecutorContextInput {
  soulText: SoulText;
  championText: string;
  plan: ImprovementPlan;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
}

const PRIORITY_ORDER: Record<ImprovementAction['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Build the full template context for a synthesis-executor prompt (pure function).
 *
 * Produces a context object containing:
 * - championText: the text to improve
 * - plan: the full ImprovementPlan
 * - sortedActions: actions sorted by priority (high -> medium -> low)
 * - preserveElements: elements to preserve
 * - expressionSources: expressions to incorporate
 * - styleRules: constitution style constraints
 * - themeContext (optional)
 */
export function buildSynthesisExecutorContext(input: SynthesisExecutorContextInput): Record<string, unknown> {
  const { soulText, championText, plan, narrativeRules, themeContext } = input;

  // Sort actions by priority
  const sortedActions = [...plan.actions].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  // Constitution style rules
  const constitution = soulText.constitution;
  const u = constitution.universal;
  const ps = constitution.protagonist_specific;
  const styleRules = {
    rhythm: ps.sentence_structure.rhythm_pattern,
    forbiddenWords: u.vocabulary.forbidden_words,
    forbiddenSimiles: u.rhetoric.forbidden_similes,
    simileBase: u.rhetoric.simile_base,
    povDescription: narrativeRules.povDescription,
    pronoun: narrativeRules.pronoun,
  };

  const ctx: Record<string, unknown> = {
    championText,
    plan,
    sortedActions,
    preserveElements: plan.preserveElements,
    expressionSources: plan.expressionSources,
    styleRules,
  };

  if (themeContext) {
    ctx.themeContext = themeContext;
  }

  return ctx;
}
