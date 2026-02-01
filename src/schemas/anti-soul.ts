import { z } from 'zod';

// Anti-soul entry (negative example)
export const AntiSoulEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  reason: z.string(),
  source: z.string(),
  added_at: z.string(),
});

// Violation type to anti-soul category mapping
export const ViolationMappingSchema = z.record(z.string(), z.string());

// Full Anti-Soul schema
export const AntiSoulSchema = z.object({
  categories: z.record(z.string(), z.array(AntiSoulEntrySchema)),
  violation_mapping: ViolationMappingSchema.optional(),
  default_category: z.string().optional(),
});

export type AntiSoulEntry = z.infer<typeof AntiSoulEntrySchema>;
export type AntiSoul = z.infer<typeof AntiSoulSchema>;
