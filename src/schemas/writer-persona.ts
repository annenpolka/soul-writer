import { z } from 'zod';

// Single writer persona
export const WriterPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  directive: z.string().optional(),
  focusCategories: z.array(z.string()).optional(),
});

// Collection of writer personas
export const WriterPersonasSchema = z.object({
  personas: z.array(WriterPersonaSchema).min(1),
});

export type WriterPersona = z.infer<typeof WriterPersonaSchema>;
export type WriterPersonas = z.infer<typeof WriterPersonasSchema>;
