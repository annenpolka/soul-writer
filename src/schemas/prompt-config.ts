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

// Tone directive for structured tone catalog
export const ToneDirectiveSchema = z.object({
  label: z.string().min(1),
  directive: z.string().min(1),
});

// Narrative type prerequisites - what each narrative form needs to function
export const NarrativePrerequisiteSchema = z.object({
  /** Minimum chapters needed for this narrative type */
  required_chapter_count: z.number().int().min(1).optional(),
  /** Required structure types */
  required_structure_types: z.array(z.string()).optional(),
  /** Adjacent chapters should not share these curve types */
  forbidden_adjacent_curves: z.array(z.string()).optional(),
  /** Recommended intensity profile across chapters */
  recommended_intensity_profile: z.array(z.number()).optional(),
  /** Free-form prerequisite requirements (passed directly to Plotter) */
  mystery_anchor: z.string().optional(),
  revelation_gradient: z.string().optional(),
  temporal_markers: z.string().optional(),
  memory_decay_rule: z.string().optional(),
  variation_mandate: z.string().optional(),
  format_consistency: z.string().optional(),
}).catchall(z.unknown());

// Full prompt config
export const PromptConfigSchema = z.object({
  defaults: PromptConfigDefaultsSchema,
  metaphor_rules: z.array(z.string()).optional(),
  character_constraints: z.record(z.string(), z.array(z.string())).optional(),
  scene_catalog: z.array(z.string()).optional(),
  timeline_catalog: z.array(z.string()).optional(),
  ideation_strategies: z.array(z.string()).optional(),
  tone_directives: z.array(z.string()).optional(),
  tone_catalog: z.array(ToneDirectiveSchema).optional(),
  pov_rules: PovRulesSchema.optional(),
  tournament: TournamentConfigSchema.optional(),
  agents: z.record(z.string(), AgentPromptConfigSchema).optional(),
  /** Narrative type prerequisites - defines what each narrative form needs to work */
  narrative_prerequisites: z.record(z.string(), NarrativePrerequisiteSchema).optional(),
});

export type PromptConfigDefaults = z.infer<typeof PromptConfigDefaultsSchema>;
export type PovRules = z.infer<typeof PovRulesSchema>;
export type AgentPromptConfig = z.infer<typeof AgentPromptConfigSchema>;
export type TournamentConfig = z.infer<typeof TournamentConfigSchema>;
export type NarrativePrerequisite = z.infer<typeof NarrativePrerequisiteSchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;

// Default empty config for when prompt-config.yaml doesn't exist
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  defaults: {
    protagonist_short: '',
    pronoun: '',
  },
};
