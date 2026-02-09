import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { WriterConfig, ThemeContext, MacGuffinContext } from '../agents/types.js';
import type { EnrichedCharacter } from '../factory/character-enricher.js';
import { createCollaborativeWriter, type CollaborativeWriterFn } from './collaborative-writer.js';
import { createModerator, type ModeratorFn } from './moderator.js';
import type {
  CollaborationConfig,
  CollaborationResult,
  CollaborationState,
  CollaborationAction,
  FeedbackAction,
} from './types.js';
import { DEFAULT_COLLABORATION_CONFIG, COLLABORATION_SAFETY_LIMIT } from './types.js';
import type { LoggerFn } from '../logger.js';

// --- FP interface ---

export interface CollaborationSessionFn {
  run: (prompt: string) => Promise<CollaborationResult>;
}

export interface CollaborationSessionDeps {
  llmClient: LLMClient;
  soulText: SoulText;
  writerConfigs: WriterConfig[];
  config?: Partial<CollaborationConfig>;
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
  enrichedCharacters?: EnrichedCharacter[];
  logger?: LoggerFn;
}

// --- Internal helpers ---

function summarizeAction(action: CollaborationAction): string {
  switch (action.type) {
    case 'proposal':
      return action.content;
    case 'feedback':
      return `→${action.targetWriterId} [${action.sentiment}]: ${action.feedback}`;
    case 'draft':
      return `[${action.section}] ${action.text}`;
    case 'volunteer':
      return `${action.section}に立候補: ${action.reason}`;
  }
}

// --- Factory function ---

export function createCollaborationSession(deps: CollaborationSessionDeps): CollaborationSessionFn {
  const { llmClient, soulText, writerConfigs, themeContext, macGuffinContext, enrichedCharacters, logger } = deps;
  const config: CollaborationConfig = { ...DEFAULT_COLLABORATION_CONFIG, ...deps.config };

  const writers: CollaborativeWriterFn[] = writerConfigs.map((wc) =>
    createCollaborativeWriter({ llmClient, soulText, config: wc, themeContext, macGuffinContext, enrichedCharacters }),
  );
  const moderator: ModeratorFn = createModerator({ llmClient, soulText });

  const run = async (prompt: string): Promise<CollaborationResult> => {
    const tokensBefore = llmClient.getTotalTokens();

    const state: CollaborationState = {
      rounds: [],
      currentPhase: 'proposal',
      sectionAssignments: {},
      currentDrafts: {},
      consensusReached: false,
    };

    let lastConsensusScore = 0;
    let remainingRounds = config.maxRounds;
    let totalRounds = 0;

    while (remainingRounds > 0 && totalRounds < COLLABORATION_SAFETY_LIMIT) {
      totalRounds++;
      remainingRounds--;
      logger?.section(`Collaboration Round ${totalRounds} (remaining: ${remainingRounds}) [${state.currentPhase}]`);

      // All writers participate in parallel (partial failures tolerated)
      const results = await Promise.allSettled(
        writers.map((w) => w.participate(state, prompt)),
      );
      const actions: CollaborationAction[] = results
        .filter((r): r is PromiseFulfilledResult<CollaborationAction[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

      // Log writer actions
      for (const action of actions) {
        logger?.debug(`[${action.type}] ${action.writerId}`, summarizeAction(action));
      }

      // Update drafts from draft actions
      for (const action of actions) {
        if (action.type === 'draft') {
          state.currentDrafts[action.section] = action.text;
        }
      }

      // Moderator facilitates
      const writerInfos = writers.map((w) => ({
        id: w.id,
        name: w.name,
        focusCategories: w.focusCategories,
      }));

      const facilitation = await moderator.facilitateRound(state, actions, writerInfos);

      logger?.debug('Moderator facilitation', {
        nextPhase: facilitation.nextPhase,
        consensusScore: facilitation.consensusScore,
        shouldTerminate: facilitation.shouldTerminate,
        assignments: facilitation.assignments,
        summary: facilitation.summary,
      });

      // Update state
      Object.assign(state.sectionAssignments, facilitation.assignments);
      state.currentPhase = facilitation.nextPhase;
      lastConsensusScore = facilitation.consensusScore;

      state.rounds.push({
        roundNumber: totalRounds,
        phase: state.currentPhase,
        actions,
        moderatorSummary: facilitation.summary,
      });

      const hasDrafts = Object.keys(state.currentDrafts).length > 0;
      const thresholdMet = facilitation.consensusScore >= config.earlyTerminationThreshold;

      if (facilitation.shouldTerminate && hasDrafts && thresholdMet) {
        logger?.debug('Early termination: consensus reached', {
          hasDrafts,
          consensusScore: facilitation.consensusScore,
          threshold: config.earlyTerminationThreshold,
        });
        state.consensusReached = true;
        break;
      }

      // Moderator requests additional rounds
      if (facilitation.continueRounds > 0) {
        const extension = Math.min(facilitation.continueRounds, COLLABORATION_SAFETY_LIMIT - totalRounds);
        if (extension > remainingRounds) {
          logger?.debug('Moderator extends rounds', {
            requested: facilitation.continueRounds,
            granted: extension,
            totalRounds,
          });
          remainingRounds = extension;
        }
      }
    }

    // Compose final text
    logger?.section('Collaboration: Composing Final Text');
    const feedbackActions = state.rounds
      .flatMap((r) => r.actions)
      .filter((a): a is FeedbackAction => a.type === 'feedback');

    logger?.debug('Composing final', {
      draftSections: Object.keys(state.currentDrafts),
      feedbackCount: feedbackActions.length,
      totalRounds: state.rounds.length,
    });

    const { text: finalText } = await moderator.composeFinal(
      state.currentDrafts,
      feedbackActions,
    );

    const totalTokensUsed = llmClient.getTotalTokens() - tokensBefore;

    logger?.debug('Collaboration complete', {
      finalTextLength: finalText.length,
      totalTokensUsed,
      consensusScore: lastConsensusScore,
      consensusReached: state.consensusReached,
    });

    return {
      finalText,
      rounds: state.rounds,
      participants: writers.map((w) => w.id),
      totalTokensUsed,
      consensusScore: lastConsensusScore,
    };
  };

  return { run };
}

