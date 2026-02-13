import type { CollaborationAction } from './types.js';
import type { CollaborationActionRaw } from '../schemas/collaboration-action.js';

/**
 * Parse a structured action response into a CollaborationAction (pure function).
 */
export function parseStructuredAction(
  writerId: string,
  data: CollaborationActionRaw,
): CollaborationAction {
  switch (data.action) {
    case 'proposal':
      return {
        type: 'proposal',
        writerId,
        content: data.content,
        targetSection: data.targetSection,
      };
    case 'feedback':
      return {
        type: 'feedback',
        writerId,
        targetWriterId: data.targetWriterId,
        feedback: data.feedback,
        sentiment: data.sentiment,
        ...(data.counterProposal && data.counterProposal !== '' ? { counterProposal: data.counterProposal } : {}),
      };
    case 'draft':
      return {
        type: 'draft',
        writerId,
        section: data.section,
        text: data.text,
      };
    case 'volunteer':
      return {
        type: 'volunteer',
        writerId,
        section: data.section,
        reason: data.reason,
      };
  }
}
