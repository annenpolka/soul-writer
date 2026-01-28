import { z } from 'zod';

/**
 * Schema for factory batch generation configuration
 */
export const FactoryConfigSchema = z.object({
  /** Number of stories to generate */
  count: z.number().int().positive().default(10),
  /** Number of parallel executions (1-8) */
  parallel: z.number().int().min(1).max(8).default(4),
  /** Number of chapters per story */
  chaptersPerStory: z.number().int().positive().default(5),
  /** Path to soul text directory */
  soulPath: z.string().default('soul'),
  /** Output directory for generated files */
  outputDir: z.string().default('output'),
  /** Path to SQLite database */
  dbPath: z.string().default('factory.db'),
});

export type FactoryConfig = z.infer<typeof FactoryConfigSchema>;

/** Default factory configuration with all default values applied */
export const DEFAULT_FACTORY_CONFIG: FactoryConfig = FactoryConfigSchema.parse({});
