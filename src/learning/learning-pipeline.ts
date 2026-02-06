import type { FragmentExtractorFn } from './fragment-extractor.js';
import type { SoulExpanderFn } from './soul-expander.js';

export interface LearningThresholds {
  minComplianceScore: number;
  minReaderScore: number;
  minFragmentScore: number;
}

export interface ProcessInput {
  soulId: string;
  workId: string;
  text: string;
  complianceScore: number;
  readerScore: number;
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
  minComplianceScore: 0.85,
  minReaderScore: 0.80,
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
      if (input.complianceScore < thresholds.minComplianceScore) {
        return {
          extracted: 0,
          added: 0,
          skipped: true,
          reason: `Compliance score ${input.complianceScore} below threshold ${thresholds.minComplianceScore}`,
          tokensUsed: 0,
        };
      }

      if (input.readerScore < thresholds.minReaderScore) {
        return {
          extracted: 0,
          added: 0,
          skipped: true,
          reason: `Reader score ${input.readerScore} below threshold ${thresholds.minReaderScore}`,
          tokensUsed: 0,
        };
      }

      const extractionResult = await extractor.extract(input.text, {
        complianceScore: input.complianceScore,
        readerScore: input.readerScore,
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

