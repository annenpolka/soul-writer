import { z } from 'zod';

/**
 * Chapter schema - represents a single chapter in a plot
 */
export const ChapterSchema = z.object({
  index: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  key_events: z.array(z.string()).min(1),
  target_length: z.number().int().positive().default(4000),
});

/**
 * Plot schema - represents a complete plot structure
 */
export const PlotSchema = z.object({
  title: z.string().min(1),
  theme: z.string().min(1),
  chapters: z.array(ChapterSchema).min(1),
});

export type Chapter = z.infer<typeof ChapterSchema>;
export type Plot = z.infer<typeof PlotSchema>;
