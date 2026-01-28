import type { FragmentExtractor } from './fragment-extractor.js';
import type { SoulExpander } from './soul-expander.js';

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

/**
 * Pipeline for automatic learning from generated text
 * Extracts high-quality fragments and adds them as candidates for soul expansion
 */
export class LearningPipeline {
  private extractor: FragmentExtractor;
  private expander: SoulExpander;
  private thresholds: LearningThresholds;

  constructor(
    extractor: FragmentExtractor,
    expander: SoulExpander,
    thresholds: Partial<LearningThresholds> = {}
  ) {
    this.extractor = extractor;
    this.expander = expander;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Process generated text for potential soul expansion
   */
  async process(input: ProcessInput): Promise<ProcessResult> {
    // Check if text meets quality thresholds
    if (input.complianceScore < this.thresholds.minComplianceScore) {
      return {
        extracted: 0,
        added: 0,
        skipped: true,
        reason: `Compliance score ${input.complianceScore} below threshold ${this.thresholds.minComplianceScore}`,
        tokensUsed: 0,
      };
    }

    if (input.readerScore < this.thresholds.minReaderScore) {
      return {
        extracted: 0,
        added: 0,
        skipped: true,
        reason: `Reader score ${input.readerScore} below threshold ${this.thresholds.minReaderScore}`,
        tokensUsed: 0,
      };
    }

    // Extract fragments
    const extractionResult = await this.extractor.extract(input.text, {
      complianceScore: input.complianceScore,
      readerScore: input.readerScore,
    });

    // Filter high-quality fragments
    const highQualityFragments = this.extractor.filterHighQuality(
      extractionResult.fragments,
      this.thresholds.minFragmentScore
    );

    // Add as candidates
    const addResult = await this.expander.addCandidates(
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
  }

  /**
   * Get current thresholds
   */
  getThresholds(): LearningThresholds {
    return { ...this.thresholds };
  }
}
