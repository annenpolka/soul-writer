import { z } from 'zod';

export const ImprovementActionSchema = z.object({
  section: z.string(),
  type: z.enum([
    'expression_upgrade', 'pacing_adjustment', 'scene_reorder',
    'motif_fix', 'voice_refinement', 'imagery_injection',
    'tension_enhancement', 'agency_boost', 'chapter_variation', 'repetition_elimination',
  ]),
  description: z.string(),
  source: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
});

export const ImprovementPlanSchema = z.object({
  championAssessment: z.string(),
  preserveElements: z.array(z.string()),
  actions: z.array(ImprovementActionSchema),
  structuralChanges: z.array(z.string()).optional(),
  expressionSources: z.array(z.object({
    writerId: z.string(),
    expressions: z.array(z.string()),
    context: z.string(),
  })),
});

export type ImprovementPlanRaw = z.infer<typeof ImprovementPlanSchema>;
