import type { StructuredResponse } from '../../llm/types.js';
import type { ImprovementPlan } from '../types.js';
import type { ImprovementPlanRaw } from '../../schemas/improvement-plan.js';

/**
 * Parse a structured response into an ImprovementPlan (pure function).
 */
export function parseSynthesisAnalyzerResponse(response: StructuredResponse<ImprovementPlanRaw>): ImprovementPlan {
  const data = response.data;
  const plan: ImprovementPlan = {
    championAssessment: data.championAssessment || 'No assessment provided',
    preserveElements: data.preserveElements ?? [],
    actions: data.actions ?? [],
    expressionSources: data.expressionSources ?? [],
  };

  if (data.structuralChanges && data.structuralChanges.length > 0) {
    plan.structuralChanges = data.structuralChanges;
  }

  return plan;
}

/**
 * Create a fallback ImprovementPlan when parsing fails (pure function).
 */
export function createFallbackPlan(): ImprovementPlan {
  return {
    championAssessment: 'Fallback: structured output parsing failed',
    preserveElements: [],
    actions: [],
    expressionSources: [],
  };
}
