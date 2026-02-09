import { z } from 'zod';

// Fragment categories
export const FragmentCategory = z.enum([
  'opening',
  'killing',
  'introspection',
  'dialogue',
  'world_building',
  'character_voice',
  'symbolism',
  'action',
]);

// Single fragment
export const FragmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.string().optional(),
  tags: z.array(z.string()),
  added_at: z.string(),
});

// Fragment collection for a category
export const FragmentCollectionSchema = z.object({
  category: FragmentCategory,
  fragments: z.array(FragmentSchema),
});

export type FragmentCategoryType = z.infer<typeof FragmentCategory>;
export type Fragment = z.infer<typeof FragmentSchema>;
export type FragmentCollection = z.infer<typeof FragmentCollectionSchema>;
