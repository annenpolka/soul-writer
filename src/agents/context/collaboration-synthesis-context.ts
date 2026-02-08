import type { SoulText } from '../../soul/manager.js';
import type { ThemeContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';
import type { CollaborationResult, FeedbackAction, DraftAction } from '../../collaboration/types.js';

/**
 * Input for buildCollaborationSynthesisContext
 */
export interface CollaborationSynthesisContextInput {
  soulText: SoulText;
  collaborationResult: CollaborationResult;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
}

/**
 * Build the full template context for a collaboration-synthesis prompt (pure function).
 *
 * Extracts feedback sentiments and drafts from collaboration rounds,
 * producing a context suitable for generating an ImprovementPlan.
 */
export function buildCollaborationSynthesisContext(input: CollaborationSynthesisContextInput): Record<string, unknown> {
  const { soulText, collaborationResult, narrativeRules, themeContext } = input;

  // Extract feedback actions from discussion/review rounds
  const feedbackSummary: Array<{
    writerId: string;
    targetWriterId: string;
    sentiment: string;
    feedback: string;
    counterProposal?: string;
  }> = [];

  for (const round of collaborationResult.rounds) {
    for (const action of round.actions) {
      if (action.type === 'feedback') {
        const fa = action as FeedbackAction;
        feedbackSummary.push({
          writerId: fa.writerId,
          targetWriterId: fa.targetWriterId,
          sentiment: fa.sentiment,
          feedback: fa.feedback,
          counterProposal: fa.counterProposal,
        });
      }
    }
  }

  // Extract draft actions from drafting rounds
  const drafts: Array<{ writerId: string; section: string; text: string }> = [];
  for (const round of collaborationResult.rounds) {
    for (const action of round.actions) {
      if (action.type === 'draft') {
        const da = action as DraftAction;
        drafts.push({
          writerId: da.writerId,
          section: da.section,
          text: da.text,
        });
      }
    }
  }

  // Round summaries
  const rounds = collaborationResult.rounds.map(r => ({
    roundNumber: r.roundNumber,
    phase: r.phase,
    moderatorSummary: r.moderatorSummary,
    actionCount: r.actions.length,
  }));

  // Constitution style rules
  const constitution = soulText.constitution;
  const u = constitution.universal;
  const ps = constitution.protagonist_specific;
  const styleRules = {
    rhythm: ps.sentence_structure.rhythm_pattern,
    forbiddenWords: u.vocabulary.forbidden_words,
    forbiddenSimiles: u.rhetoric.forbidden_similes,
    simileBase: u.rhetoric.simile_base,
    povDescription: narrativeRules.povDescription,
    pronoun: narrativeRules.pronoun,
  };

  const ctx: Record<string, unknown> = {
    finalText: collaborationResult.finalText,
    rounds,
    feedbackSummary,
    drafts,
    participants: collaborationResult.participants,
    consensusScore: collaborationResult.consensusScore,
    styleRules,
  };

  if (themeContext) {
    ctx.themeContext = themeContext;
  }

  return ctx;
}
