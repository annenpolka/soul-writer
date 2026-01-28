import { z } from 'zod';

// Evaluation weights for reader personas
export const EvaluationWeightsSchema = z.object({
  style: z.number().min(0).max(1),
  plot: z.number().min(0).max(1),
  character: z.number().min(0).max(1),
  worldbuilding: z.number().min(0).max(1),
  readability: z.number().min(0).max(1),
});

// Single reader persona
export const ReaderPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  preferences: z.array(z.string()),
  evaluation_weights: EvaluationWeightsSchema,
});

// Collection of reader personas
export const ReaderPersonasSchema = z.object({
  personas: z.array(ReaderPersonaSchema),
});

export type EvaluationWeights = z.infer<typeof EvaluationWeightsSchema>;
export type ReaderPersona = z.infer<typeof ReaderPersonaSchema>;
export type ReaderPersonas = z.infer<typeof ReaderPersonasSchema>;
