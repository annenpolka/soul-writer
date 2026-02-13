import { z } from 'zod';

export const CollaborationActionResponseSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('proposal'),
    content: z.string(),
    targetSection: z.string().optional(),
  }),
  z.object({
    action: z.literal('feedback'),
    targetWriterId: z.string(),
    feedback: z.string(),
    sentiment: z.enum(['agree', 'disagree', 'suggest_revision', 'challenge']),
    counterProposal: z.string().optional(),
  }),
  z.object({
    action: z.literal('draft'),
    section: z.string(),
    text: z.string(),
  }),
  z.object({
    action: z.literal('volunteer'),
    section: z.string(),
    reason: z.string(),
  }),
]);

export type CollaborationActionRaw = z.infer<typeof CollaborationActionResponseSchema>;
