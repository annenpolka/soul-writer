import { z } from 'zod';

export const ReaderEvaluationResponseSchema = z.object({
  categoryScores: z.object({
    style: z.number(),
    plot: z.number(),
    character: z.number(),
    worldbuilding: z.number(),
    readability: z.number(),
  }),
  feedback: z.object({
    strengths: z.string(),
    weaknesses: z.string(),
    suggestion: z.string(),
  }),
});

export type ReaderEvaluationRawResponse = z.infer<typeof ReaderEvaluationResponseSchema>;
