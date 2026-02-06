import type {
  SoulCandidateRepository,
  SoulCandidateRepo,
  SoulCandidate,
} from '../storage/soul-candidate-repository.js';
import type { ExtractedFragment } from './fragment-extractor.js';

export interface AddCandidatesResult {
  added: number;
  candidates: SoulCandidate[];
}

export interface SoulExpanderFn {
  addCandidates(soulId: string, workId: string, fragments: ExtractedFragment[], chapterId?: string): Promise<AddCandidatesResult>;
  getPendingCandidates(soulId: string): Promise<SoulCandidate[]>;
  approveCandidate(candidateId: string, notes?: string): Promise<SoulCandidate | undefined>;
  rejectCandidate(candidateId: string, notes?: string): Promise<SoulCandidate | undefined>;
  getApprovedCandidates(soulId: string): Promise<SoulCandidate[]>;
  getCountsByStatus(soulId: string): Promise<{ pending: number; approved: number; rejected: number }>;
}

export function createSoulExpander(candidateRepo: SoulCandidateRepo | SoulCandidateRepository): SoulExpanderFn {
  return {
    async addCandidates(
      soulId: string,
      workId: string,
      fragments: ExtractedFragment[],
      chapterId?: string
    ): Promise<AddCandidatesResult> {
      const candidates: SoulCandidate[] = [];

      for (const fragment of fragments) {
        const candidate = await candidateRepo.create({
          soulId,
          sourceWorkId: workId,
          sourceChapterId: chapterId,
          fragmentText: fragment.text,
          suggestedCategory: fragment.category,
          autoScore: fragment.score,
        });
        candidates.push(candidate);
      }

      return {
        added: candidates.length,
        candidates,
      };
    },

    async getPendingCandidates(soulId: string): Promise<SoulCandidate[]> {
      return candidateRepo.findPendingBySoulId(soulId);
    },

    async approveCandidate(candidateId: string, notes?: string): Promise<SoulCandidate | undefined> {
      return candidateRepo.approve(candidateId, notes);
    },

    async rejectCandidate(candidateId: string, notes?: string): Promise<SoulCandidate | undefined> {
      return candidateRepo.reject(candidateId, notes);
    },

    async getApprovedCandidates(soulId: string): Promise<SoulCandidate[]> {
      return candidateRepo.findApprovedBySoulId(soulId);
    },

    async getCountsByStatus(soulId: string): Promise<{ pending: number; approved: number; rejected: number }> {
      return candidateRepo.countByStatus(soulId);
    },
  };
}

