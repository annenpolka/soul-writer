import { describe, it, expect, vi } from 'vitest';
import type { ImprovementPlanRaw } from '../../src/schemas/improvement-plan.js';
import { ImprovementPlanSchema } from '../../src/schemas/improvement-plan.js';

/**
 * Test that ImprovementPlanSchema includes 'agency_boost' in action type enum.
 */

describe('ImprovementPlanSchema - agency_boost enum', () => {
  it('should include agency_boost in the actions type enum', () => {
    // Verify that agency_boost is a valid action type by parsing a plan with it
    const planWithAgencyBoost: ImprovementPlanRaw = {
      championAssessment: 'test',
      preserveElements: [],
      actions: [
        {
          section: 'test',
          type: 'agency_boost',
          description: 'Add character agency',
          source: 'writer_1',
          priority: 'high',
        },
      ],
      expressionSources: [],
    };

    const result = ImprovementPlanSchema.safeParse(planWithAgencyBoost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actions[0].type).toBe('agency_boost');
    }
  });

  it('should also include chapter_variation and repetition_elimination', () => {
    const testData: ImprovementPlanRaw = {
      championAssessment: 'test',
      preserveElements: [],
      actions: [
        { section: 's', type: 'chapter_variation', description: 'd', source: 'w', priority: 'medium' },
        { section: 's', type: 'repetition_elimination', description: 'd', source: 'w', priority: 'low' },
      ],
      expressionSources: [],
    };

    const result = ImprovementPlanSchema.safeParse(testData);
    expect(result.success).toBe(true);
  });
});
