import type {
  SoulCandidateRepository,
  SoulCandidate,
} from '../storage/soul-candidate-repository.js';
import type { ExtractedFragment } from './fragment-extractor.js';

export interface AddCandidatesResult {
  added: number;
  candidates: SoulCandidate[];
}

/**
 * Manages the expansion of soul text through new candidate fragments
 */
export class SoulExpander {
  private candidateRepo: SoulCandidateRepository;

  constructor(candidateRepo: SoulCandidateRepository) {
    this.candidateRepo = candidateRepo;
  }

  /**
   * Add extracted fragments as candidates for soul expansion
   */
  async addCandidates(
    soulId: string,
    workId: string,
    fragments: ExtractedFragment[],
    chapterId?: string
  ): Promise<AddCandidatesResult> {
    const candidates: SoulCandidate[] = [];

    for (const fragment of fragments) {
      const candidate = await this.candidateRepo.create({
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
  }

  /**
   * Get pending candidates for a soul
   */
  async getPendingCandidates(soulId: string): Promise<SoulCandidate[]> {
    return this.candidateRepo.findPendingBySoulId(soulId);
  }

  /**
   * Approve a candidate for addition to the soul
   */
  async approveCandidate(
    candidateId: string,
    notes?: string
  ): Promise<SoulCandidate | undefined> {
    return this.candidateRepo.approve(candidateId, notes);
  }

  /**
   * Reject a candidate
   */
  async rejectCandidate(
    candidateId: string,
    notes?: string
  ): Promise<SoulCandidate | undefined> {
    return this.candidateRepo.reject(candidateId, notes);
  }

  /**
   * Get approved candidates ready to be added to the soul
   */
  async getApprovedCandidates(soulId: string): Promise<SoulCandidate[]> {
    return this.candidateRepo.findApprovedBySoulId(soulId);
  }

  /**
   * Get counts by status for a soul
   */
  async getCountsByStatus(soulId: string): Promise<{ pending: number; approved: number; rejected: number }> {
    return this.candidateRepo.countByStatus(soulId);
  }
}
