import { z } from 'zod';

// Defaults: protagonist name, pronoun, etc.
export const PromptConfigDefaultsSchema = z.object({
  protagonist_short: z.string().min(1),
  protagonist_full: z.string().optional(),
  pronoun: z.string().min(1),
  prohibited_pronouns: z.array(z.string()).optional(),
});

// POV rules per narrative type
export const PovRulesSchema = z.record(
  z.string(),
  z.object({
    description: z.string(),
    rules: z.array(z.string()),
  }),
);

// Agent-specific config (flexible per agent)
export const AgentPromptConfigSchema = z.object({
  critical_rules: z.array(z.string()).optional(),
  penalty_items: z.array(z.string()).optional(),
  character_voice_rules: z.record(z.string(), z.string()).optional(),
  casting_rules: z.array(z.string()).optional(),
  world_description: z.string().optional(),
}).catchall(z.unknown());

// Temperature slot configuration for tournament
export const TemperatureSlotSchema = z.object({
  label: z.string(),
  range: z.tuple([z.number(), z.number()]),
  topP_range: z.tuple([z.number(), z.number()]),
});

// Tournament configuration
export const TournamentConfigSchema = z.object({
  temperature_slots: z.array(TemperatureSlotSchema).optional(),
});

// Tone axis keys for 5-axis orthogonal tone directive system
export const TONE_AXIS_KEYS = [
  'emotional_distance',
  'structural_constraint',
  'aesthetic_direction',
  'tempo_rhythm',
  'perspective_operation',
] as const;

export type ToneAxisKey = typeof TONE_AXIS_KEYS[number];

export const ToneAxesSchema = z.object({
  emotional_distance: z.array(z.string()).optional(),
  structural_constraint: z.array(z.string()).optional(),
  aesthetic_direction: z.array(z.string()).optional(),
  tempo_rhythm: z.array(z.string()).optional(),
  perspective_operation: z.array(z.string()).optional(),
});

export type ToneAxes = z.infer<typeof ToneAxesSchema>;

// Full prompt config
export const PromptConfigSchema = z.object({
  defaults: PromptConfigDefaultsSchema,
  metaphor_rules: z.array(z.string()).optional(),
  character_constraints: z.record(z.string(), z.array(z.string())).optional(),
  scene_catalog: z.array(z.string()).optional(),
  timeline_catalog: z.array(z.string()).optional(),
  ideation_strategies: z.array(z.string()).optional(),
  tone_directives: z.array(z.string()).optional(),
  tone_axes: ToneAxesSchema.optional(),
  pov_rules: PovRulesSchema.optional(),
  tournament: TournamentConfigSchema.optional(),
  agents: z.record(z.string(), AgentPromptConfigSchema).optional(),
});

export type PromptConfigDefaults = z.infer<typeof PromptConfigDefaultsSchema>;
export type PovRules = z.infer<typeof PovRulesSchema>;
export type AgentPromptConfig = z.infer<typeof AgentPromptConfigSchema>;
export type TournamentConfig = z.infer<typeof TournamentConfigSchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;

// Default empty config for when prompt-config.yaml doesn't exist
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  defaults: {
    protagonist_short: '',
    pronoun: '',
  },
};
