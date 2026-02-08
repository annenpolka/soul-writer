import type { ToolCallResponse } from '../../llm/types.js';
import type { ImprovementPlan, ImprovementAction } from '../types.js';
import { parseToolArguments } from '../../llm/tooling.js';

const VALID_ACTION_TYPES = new Set([
  'expression_upgrade', 'pacing_adjustment', 'scene_reorder',
  'motif_fix', 'voice_refinement', 'imagery_injection', 'tension_enhancement',
]);

const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

/**
 * Parse a tool-call response into an ImprovementPlan (pure function).
 */
export function parseSynthesisAnalyzerResponse(response: ToolCallResponse): ImprovementPlan {
  let parsed: unknown;
  try {
    parsed = parseToolArguments<unknown>(response, 'submit_improvement_plan');
  } catch {
    return createFallbackPlan();
  }

  try {
    const candidate = parsed as {
      championAssessment?: string;
      preserveElements?: unknown;
      actions?: unknown;
      structuralChanges?: unknown;
      expressionSources?: unknown;
    };

    const actions = normalizeActions(candidate.actions);
    const expressionSources = normalizeExpressionSources(candidate.expressionSources);

    const plan: ImprovementPlan = {
      championAssessment: candidate.championAssessment || 'No assessment provided',
      preserveElements: Array.isArray(candidate.preserveElements) ? candidate.preserveElements as string[] : [],
      actions,
      expressionSources,
    };

    if (Array.isArray(candidate.structuralChanges) && candidate.structuralChanges.length > 0) {
      plan.structuralChanges = candidate.structuralChanges as string[];
    }

    return plan;
  } catch {
    return createFallbackPlan();
  }
}

/**
 * Normalize and validate actions array (pure function).
 */
function normalizeActions(raw: unknown): ImprovementAction[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
    .filter(a => VALID_ACTION_TYPES.has(a.type as string))
    .map(a => ({
      section: String(a.section || ''),
      type: a.type as ImprovementAction['type'],
      description: String(a.description || ''),
      source: String(a.source || ''),
      priority: VALID_PRIORITIES.has(a.priority as string) ? a.priority as ImprovementAction['priority'] : 'medium',
    }));
}

/**
 * Normalize expression sources array (pure function).
 */
function normalizeExpressionSources(raw: unknown): ImprovementPlan['expressionSources'] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
    .map(s => ({
      writerId: String(s.writerId || ''),
      expressions: Array.isArray(s.expressions) ? s.expressions as string[] : [],
      context: String(s.context || ''),
    }));
}

/**
 * Create a fallback ImprovementPlan when parsing fails (pure function).
 */
export function createFallbackPlan(): ImprovementPlan {
  return {
    championAssessment: 'Fallback: tool call parsing failed',
    preserveElements: [],
    actions: [],
    expressionSources: [],
  };
}
