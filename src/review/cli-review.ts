import type { SoulExpander } from '../learning/soul-expander.js';
import type { SoulCandidate } from '../storage/soul-candidate-repository.js';

export interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

/**
 * CLI interface for reviewing soul candidates
 */
export class CLIReview {
  private expander: SoulExpander;

  constructor(expander: SoulExpander) {
    this.expander = expander;
  }

  /**
   * Get pending candidates for a soul
   */
  async getPendingCandidates(soulId: string): Promise<SoulCandidate[]> {
    return this.expander.getPendingCandidates(soulId);
  }

  /**
   * Review a candidate (approve or reject)
   */
  async reviewCandidate(
    candidateId: string,
    decision: 'approve' | 'reject',
    notes?: string
  ): Promise<SoulCandidate | undefined> {
    if (decision === 'approve') {
      return this.expander.approveCandidate(candidateId, notes);
    } else {
      return this.expander.rejectCandidate(candidateId, notes);
    }
  }

  /**
   * Format a candidate for CLI display
   */
  formatCandidateForDisplay(candidate: SoulCandidate): string {
    const lines = [
      `ID: ${candidate.id}`,
      `Category: ${candidate.suggestedCategory}`,
      `Score: ${candidate.autoScore}`,
      ``,
      `--- Fragment ---`,
      candidate.fragmentText,
      `----------------`,
    ];

    return lines.join('\n');
  }

  /**
   * Get review statistics for a soul
   */
  async getReviewStats(soulId: string): Promise<ReviewStats> {
    const counts = await this.expander.getCountsByStatus(soulId);

    return {
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      total: counts.pending + counts.approved + counts.rejected,
    };
  }
}
