import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { WriterConfig, ThemeContext } from '../agents/types.js';
import { CollaborativeWriter } from './collaborative-writer.js';
import { ModeratorAgent } from './moderator.js';
import type {
  CollaborationConfig,
  CollaborationResult,
  CollaborationState,
  CollaborationAction,
  FeedbackAction,
} from './types.js';
import { DEFAULT_COLLABORATION_CONFIG, COLLABORATION_SAFETY_LIMIT } from './types.js';
import type { Logger } from '../logger.js';

export class CollaborationSession {
  private writers: CollaborativeWriter[];
  private moderator: ModeratorAgent;
  private config: CollaborationConfig;
  private llmClient: LLMClient;
  private logger?: Logger;

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    writerConfigs: WriterConfig[],
    config?: Partial<CollaborationConfig>,
    themeContext?: ThemeContext,
    logger?: Logger,
  ) {
    this.llmClient = llmClient;
    this.config = { ...DEFAULT_COLLABORATION_CONFIG, ...config };
    this.writers = writerConfigs.map((wc) => new CollaborativeWriter(llmClient, soulText, wc, themeContext));
    this.moderator = new ModeratorAgent(llmClient, soulText);
    this.logger = logger;
  }

  async run(prompt: string): Promise<CollaborationResult> {
    const tokensBefore = this.llmClient.getTotalTokens();

    const state: CollaborationState = {
      rounds: [],
      currentPhase: 'proposal',
      sectionAssignments: {},
      currentDrafts: {},
      consensusReached: false,
    };

    let lastConsensusScore = 0;
    let remainingRounds = this.config.maxRounds;
    let totalRounds = 0;

    while (remainingRounds > 0 && totalRounds < COLLABORATION_SAFETY_LIMIT) {
      totalRounds++;
      remainingRounds--;
      this.logger?.section(`Collaboration Round ${totalRounds} (remaining: ${remainingRounds}) [${state.currentPhase}]`);

      // All writers participate in parallel (partial failures tolerated)
      const results = await Promise.allSettled(
        this.writers.map((w) => w.participate(state, prompt)),
      );
      const actions: CollaborationAction[] = results
        .filter((r): r is PromiseFulfilledResult<CollaborationAction[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

      // Log writer actions
      for (const action of actions) {
        this.logger?.debug(`[${action.type}] ${action.writerId}`, this.summarizeAction(action));
      }

      // Update drafts from draft actions
      for (const action of actions) {
        if (action.type === 'draft') {
          state.currentDrafts[action.section] = action.text;
        }
      }

      // Moderator facilitates
      const writerInfos = this.writers.map((w) => ({
        id: w.id,
        name: w.name,
        focusCategories: w.focusCategories,
      }));

      const facilitation = await this.moderator.facilitateRound(state, actions, writerInfos);

      this.logger?.debug('Moderator facilitation', {
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
      const thresholdMet = facilitation.consensusScore >= this.config.earlyTerminationThreshold;

      if (facilitation.shouldTerminate && hasDrafts && thresholdMet) {
        this.logger?.debug('Early termination: consensus reached', {
          hasDrafts,
          consensusScore: facilitation.consensusScore,
          threshold: this.config.earlyTerminationThreshold,
        });
        state.consensusReached = true;
        break;
      }

      // Moderator requests additional rounds
      if (facilitation.continueRounds > 0) {
        const extension = Math.min(facilitation.continueRounds, COLLABORATION_SAFETY_LIMIT - totalRounds);
        if (extension > remainingRounds) {
          this.logger?.debug('Moderator extends rounds', {
            requested: facilitation.continueRounds,
            granted: extension,
            totalRounds,
          });
          remainingRounds = extension;
        }
      }
    }

    // Compose final text
    this.logger?.section('Collaboration: Composing Final Text');
    const feedbackActions = state.rounds
      .flatMap((r) => r.actions)
      .filter((a): a is FeedbackAction => a.type === 'feedback');

    this.logger?.debug('Composing final', {
      draftSections: Object.keys(state.currentDrafts),
      feedbackCount: feedbackActions.length,
      totalRounds: state.rounds.length,
    });

    const { text: finalText } = await this.moderator.composeFinal(
      state.currentDrafts,
      feedbackActions,
    );

    const totalTokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    this.logger?.debug('Collaboration complete', {
      finalTextLength: finalText.length,
      totalTokensUsed,
      consensusScore: lastConsensusScore,
      consensusReached: state.consensusReached,
    });

    return {
      finalText,
      rounds: state.rounds,
      participants: this.writers.map((w) => w.id),
      totalTokensUsed,
      consensusScore: lastConsensusScore,
    };
  }

  private summarizeAction(action: CollaborationAction): string {
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
}
