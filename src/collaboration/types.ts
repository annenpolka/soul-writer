import { z } from 'zod';

// --- Phase definitions ---
export const CollaborationPhase = z.enum(['proposal', 'discussion', 'drafting', 'review']);
export type CollaborationPhase = z.infer<typeof CollaborationPhase>;

// --- Action schemas ---
export const ProposalActionSchema = z.object({
  type: z.literal('proposal'),
  writerId: z.string(),
  content: z.string(),
  targetSection: z.string().optional(),
});

export const FeedbackActionSchema = z.object({
  type: z.literal('feedback'),
  writerId: z.string(),
  targetWriterId: z.string(),
  feedback: z.string(),
  sentiment: z.enum(['agree', 'disagree', 'suggest_revision', 'challenge']),
  counterProposal: z.string().optional(),
});

export const DraftActionSchema = z.object({
  type: z.literal('draft'),
  writerId: z.string(),
  section: z.string(),
  text: z.string(),
});

export const VolunteerActionSchema = z.object({
  type: z.literal('volunteer'),
  writerId: z.string(),
  section: z.string(),
  reason: z.string(),
});

export const CollaborationActionSchema = z.discriminatedUnion('type', [
  ProposalActionSchema,
  FeedbackActionSchema,
  DraftActionSchema,
  VolunteerActionSchema,
]);

export type ProposalAction = z.infer<typeof ProposalActionSchema>;
export type FeedbackAction = z.infer<typeof FeedbackActionSchema>;
export type DraftAction = z.infer<typeof DraftActionSchema>;
export type VolunteerAction = z.infer<typeof VolunteerActionSchema>;
export type CollaborationAction = z.infer<typeof CollaborationActionSchema>;

// --- Round ---
export const CollaborationRoundSchema = z.object({
  roundNumber: z.number().int().positive(),
  phase: CollaborationPhase,
  actions: z.array(CollaborationActionSchema),
  moderatorSummary: z.string(),
});

export type CollaborationRound = z.infer<typeof CollaborationRoundSchema>;

// --- Session state ---
export const CollaborationStateSchema = z.object({
  rounds: z.array(CollaborationRoundSchema),
  currentPhase: CollaborationPhase,
  sectionAssignments: z.record(z.string(), z.string()),
  currentDrafts: z.record(z.string(), z.string()),
  consensusReached: z.boolean(),
});

export type CollaborationState = z.infer<typeof CollaborationStateSchema>;

// --- Config ---
export const CollaborationConfigSchema = z.object({
  maxRounds: z.number().int().positive(),
  writerCount: z.number().int().positive(),
  earlyTerminationThreshold: z.number().min(0).max(1),
});

export type CollaborationConfig = z.infer<typeof CollaborationConfigSchema>;

export const DEFAULT_COLLABORATION_CONFIG: CollaborationConfig = {
  maxRounds: 5,
  writerCount: 3,
  earlyTerminationThreshold: 0.8,
};

// --- Result ---
export const CollaborationResultSchema = z.object({
  finalText: z.string(),
  rounds: z.array(CollaborationRoundSchema),
  participants: z.array(z.string()),
  totalTokensUsed: z.number(),
  consensusScore: z.number().min(0).max(1),
});

export type CollaborationResult = z.infer<typeof CollaborationResultSchema>;

// --- Moderator facilitation result ---
export const FacilitationResultSchema = z.object({
  nextPhase: CollaborationPhase,
  assignments: z.record(z.string(), z.string()),
  summary: z.string(),
  shouldTerminate: z.boolean(),
  consensusScore: z.number().min(0).max(1),
  continueRounds: z.number().int().min(0).max(5).default(0),
});

export type FacilitationResult = z.infer<typeof FacilitationResultSchema>;

export const COLLABORATION_SAFETY_LIMIT = 20;
