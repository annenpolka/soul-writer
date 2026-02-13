import { z } from 'zod';

const ScoreBreakdownSchema = z.object({
  style: z.number(),
  compliance: z.number(),
  overall: z.number(),
  voice_accuracy: z.number().optional(),
  originality: z.number().optional(),
  structure: z.number().optional(),
  amplitude: z.number().optional(),
  agency: z.number().optional(),
  stakes: z.number().optional(),
});

const TextWeaknessSchema = z.object({
  category: z.enum(['style', 'voice', 'pacing', 'imagery', 'motif', 'worldbuilding', 'agency', 'stakes']),
  description: z.string(),
  suggestedFix: z.string(),
  severity: z.enum(['critical', 'major', 'minor']),
});

const AxisCommentSchema = z.object({
  axis: z.enum(['style', 'voice_accuracy', 'originality', 'structure', 'amplitude', 'agency', 'stakes', 'compliance']),
  commentA: z.string(),
  commentB: z.string(),
  exampleA: z.string().optional(),
  exampleB: z.string().optional(),
});

const SectionAnalysisSchema = z.object({
  section: z.string(),
  ratingA: z.enum(['excellent', 'good', 'adequate', 'weak']),
  ratingB: z.enum(['excellent', 'good', 'adequate', 'weak']),
  commentA: z.string(),
  commentB: z.string(),
});

export const JudgeResponseSchema = z.object({
  winner: z.enum(['A', 'B']),
  reasoning: z.string(),
  scores: z.object({
    A: ScoreBreakdownSchema,
    B: ScoreBreakdownSchema,
  }),
  praised_excerpts: z.object({
    A: z.array(z.string()),
    B: z.array(z.string()),
  }).optional(),
  weaknesses: z.object({
    A: z.array(TextWeaknessSchema),
    B: z.array(TextWeaknessSchema),
  }).optional(),
  axis_comments: z.array(AxisCommentSchema).optional(),
  section_analysis: z.array(SectionAnalysisSchema).optional(),
});

export type JudgeRawResponse = z.infer<typeof JudgeResponseSchema>;
