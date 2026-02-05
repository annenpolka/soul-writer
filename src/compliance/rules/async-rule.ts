import type { Violation, ChapterContext } from '../../agents/types.js';

/**
 * Interface for async compliance rules (e.g., LLM-based detection)
 */
export interface AsyncComplianceRule {
  name: string;
  check(text: string, chapterContext?: ChapterContext): Promise<Violation[]>;
}
