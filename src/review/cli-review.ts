import type { SoulExpanderFn } from '../learning/soul-expander.js';
import type { SoulCandidate } from '../storage/soul-candidate-repository.js';
import type {
  FragmentIntegratorFn,
  IntegrateOneResult,
} from '../learning/fragment-integrator.js';

export interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface ReviewResult extends SoulCandidate {
  integrationResult?: IntegrateOneResult;
}

export interface CLIReviewOptions {
  integrator?: FragmentIntegratorFn;
  soulDir?: string;
}

// =====================
// FP API
// =====================

export interface CLIReviewFn {
  getPendingCandidates: (soulId: string) => Promise<SoulCandidate[]>;
  reviewCandidate: (candidateId: string, decision: 'approve' | 'reject', notes?: string) => Promise<ReviewResult | undefined>;
  formatCandidateForDisplay: (candidate: SoulCandidate) => string;
  getReviewStats: (soulId: string) => Promise<ReviewStats>;
}

export function createCLIReview(
  expander: SoulExpanderFn,
  options?: CLIReviewOptions
): CLIReviewFn {
  const { integrator, soulDir } = options ?? {};

  return {
    getPendingCandidates: async (soulId) => {
      return expander.getPendingCandidates(soulId);
    },

    reviewCandidate: async (candidateId, decision, notes?) => {
      if (decision === 'approve') {
        const candidate = await expander.approveCandidate(candidateId, notes);
        if (!candidate) return undefined;

        let integrationResult: IntegrateOneResult | undefined;
        if (integrator && soulDir) {
          integrationResult = await integrator.integrateOne(candidate, soulDir);
        }

        return { ...candidate, integrationResult };
      } else {
        const candidate = await expander.rejectCandidate(candidateId, notes);
        return candidate ? { ...candidate } : undefined;
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

