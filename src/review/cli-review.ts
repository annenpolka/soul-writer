import type { SoulExpander, SoulExpanderFn } from '../learning/soul-expander.js';
import type { SoulCandidate } from '../storage/soul-candidate-repository.js';

export interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// =====================
// FP API
// =====================

export interface CLIReviewFn {
  getPendingCandidates: (soulId: string) => Promise<SoulCandidate[]>;
  reviewCandidate: (candidateId: string, decision: 'approve' | 'reject', notes?: string) => Promise<SoulCandidate | undefined>;
  formatCandidateForDisplay: (candidate: SoulCandidate) => string;
  getReviewStats: (soulId: string) => Promise<ReviewStats>;
}

export function createCLIReview(expander: SoulExpanderFn | SoulExpander): CLIReviewFn {
  return {
    getPendingCandidates: async (soulId) => {
      return expander.getPendingCandidates(soulId);
    },

    reviewCandidate: async (candidateId, decision, notes?) => {
      if (decision === 'approve') {
        return expander.approveCandidate(candidateId, notes);
      } else {
        return expander.rejectCandidate(candidateId, notes);
      }
    },

    formatCandidateForDisplay: (candidate) => {
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
    },

    getReviewStats: async (soulId) => {
      const counts = await expander.getCountsByStatus(soulId);
      return {
        pending: counts.pending,
        approved: counts.approved,
        rejected: counts.rejected,
        total: counts.pending + counts.approved + counts.rejected,
      };
    },
  };
}

