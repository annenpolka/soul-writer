import { z } from 'zod';

// Anti-soul entry (negative example)
export const AntiSoulEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  reason: z.string(),
  source: z.enum(['manual', 'auto']),
  added_at: z.string(),
});

// Anti-soul categories
export const AntiSoulCategory = z.enum([
  'excessive_sentiment',
  'explanatory_worldbuilding',
  'character_normalization',
  'cliche_simile',
  'theme_violation',
]);

// Full Anti-Soul schema
export const AntiSoulSchema = z.object({
  categories: z.record(AntiSoulCategory, z.array(AntiSoulEntrySchema)),
});

export type AntiSoulEntry = z.infer<typeof AntiSoulEntrySchema>;
export type AntiSoulCategoryType = z.infer<typeof AntiSoulCategory>;
export type AntiSoul = z.infer<typeof AntiSoulSchema>;
