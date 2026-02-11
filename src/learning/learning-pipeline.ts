import type { VerdictLevel } from '../agents/types.js';
import { isVerdictPassing } from '../evaluation/verdict-utils.js';
import type { FragmentExtractorFn } from './fragment-extractor.js';
import type { SoulExpanderFn } from './soul-expander.js';

export interface LearningThresholds {
  minFragmentScore: number;
  /** @deprecated use verdict-based gating */
  minComplianceScore?: number;
  /** @deprecated use verdict-based gating */
  minReaderScore?: number;
}

export interface ProcessInput {
  soulId: string;
  workId: string;
  text: string;
  isCompliant: boolean;
  verdictLevel: VerdictLevel;
  chapterId?: string;
}

export interface ProcessResult {
  extracted: number;
  added: number;
  skipped: boolean;
  reason?: string;
  tokensUsed: number;
}

const DEFAULT_THRESHOLDS: LearningThresholds = {
  minFragmentScore: 0.85,
};

export interface LearningRunner {
  process(input: ProcessInput): Promise<ProcessResult>;
  getThresholds(): LearningThresholds;
}

export function createLearningPipeline(
  extractor: FragmentExtractorFn,
  expander: SoulExpanderFn,
  thresholdsOverride: Partial<LearningThresholds> = {}
): LearningRunner {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...thresholdsOverride };

  return {
    async process(input: ProcessInput): Promise<ProcessResult> {
      // Gate 1: Compliance must pass (no error violations)
      if (!input.isCompliant) {
        return {
          extracted: 0,
          added: 0,
          skipped: true,
          reason: 'Compliance check failed (error violations present)',
          tokensUsed: 0,
        };
      }

      // Gate 2: Verdict must be publishable or exceptional
      if (!isVerdictPassing(input.verdictLevel)) {
        return {
          extracted: 0,
          added: 0,
          skipped: true,
          reason: `Verdict level '${input.verdictLevel}' below publishable threshold`,
          tokensUsed: 0,
        };
      }

      const extractionResult = await extractor.extract(input.text, {
        verdictLevel: input.verdictLevel,
      });

      const highQualityFragments = extractor.filterHighQuality(
        extractionResult.fragments,
        thresholds.minFragmentScore
      );

      const addResult = await expander.addCandidates(
        input.soulId,
        input.workId,
        highQualityFragments,
        input.chapterId
      );

      return {
        extracted: extractionResult.fragments.length,
        added: addResult.added,
        skipped: false,
        tokensUsed: extractionResult.tokensUsed,
      };
    },

    getThresholds(): LearningThresholds {
      return { ...thresholds };
    },
  };
}

