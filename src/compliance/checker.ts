import type { ComplianceResult, Violation, ChapterContext } from '../agents/types.js';
import type { ComplianceRule } from './rules/forbidden-words.js';
import type { AsyncComplianceRule } from './rules/async-rule.js';
import { ForbiddenWordsRule } from './rules/forbidden-words.js';
import { ForbiddenSimilesRule } from './rules/forbidden-similes.js';
import { SpecialMarksRule } from './rules/special-marks.js';
import { PovConsistencyRule } from './rules/pov-consistency.js';
import { RhythmCheckRule } from './rules/rhythm-check.js';
import { MarkdownContaminationRule } from './rules/markdown-contamination.js';
import { QuoteOriginalityRule } from './rules/quote-originality.js';
import { SelfRepetitionRule } from './rules/self-repetition.js';
import type { SoulText } from '../soul/manager.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { LLMClient } from '../llm/types.js';

const COMPLIANCE_THRESHOLD = 0.75;

/**
 * ComplianceChecker aggregates multiple rules and checks text for violations
 */
export class ComplianceChecker {
  private rules: ComplianceRule[];
  private asyncRules: AsyncComplianceRule[];

  constructor(rules: ComplianceRule[], asyncRules: AsyncComplianceRule[] = []) {
    this.rules = rules;
    this.asyncRules = asyncRules;
  }

  /**
   * Create a ComplianceChecker from SoulText configuration
   */
  static fromSoulText(soulText: SoulText, narrativeRules?: NarrativeRules, llmClient?: LLMClient): ComplianceChecker {
    const rules: ComplianceRule[] = [];

    const { constitution } = soulText;
    const u = constitution.universal;
    const ps = constitution.protagonist_specific;
    const isDefault = narrativeRules?.isDefaultProtagonist ?? true;

    // Add forbidden words rule (universal)
    if (u.vocabulary.forbidden_words.length > 0) {
      rules.push(new ForbiddenWordsRule(u.vocabulary.forbidden_words));
    }

    // Add forbidden similes rule (universal)
    if (u.rhetoric.forbidden_similes.length > 0) {
      rules.push(new ForbiddenSimilesRule(u.rhetoric.forbidden_similes));
    }

    // Add special marks rule (universal)
    if (u.vocabulary.special_marks.mark) {
      rules.push(
        new SpecialMarksRule(
          u.vocabulary.special_marks.mark,
          u.vocabulary.special_marks.forms
        )
      );
    }

    // Add POV consistency rule
    rules.push(new PovConsistencyRule(narrativeRules));

    // Add rhythm check rule (protagonist-specific: skip for new characters)
    if (isDefault) {
      const maxLen = parseInt(ps.sentence_structure.typical_lengths.forbidden.replace(/[^0-9]/g, '')) || 100;
      rules.push(new RhythmCheckRule(maxLen));
    }

    // Add markdown contamination rule
    rules.push(new MarkdownContaminationRule());

    // Add quote originality rule (extracts quotes from fragments)
    rules.push(new QuoteOriginalityRule(soulText.fragments));

    // Add async rules (LLM-based)
    const asyncRules: AsyncComplianceRule[] = [];
    if (llmClient) {
      asyncRules.push(new SelfRepetitionRule(llmClient));
    }

    return new ComplianceChecker(rules, asyncRules);
  }

  /**
   * Check text for compliance violations
   */
  check(text: string): ComplianceResult {
    const violations: Violation[] = [];

    for (const rule of this.rules) {
      const ruleViolations = rule.check(text);
      violations.push(...ruleViolations);
    }

    const score = this.calculateScore(text, violations);
    const isCompliant = score >= COMPLIANCE_THRESHOLD;

    return {
      isCompliant,
      score,
      violations,
    };
  }

  /**
   * Calculate compliance score based on violations
   * Score is 1.0 for no violations, reduced based on violation count relative to text length
   */
  private calculateScore(text: string, violations: Violation[]): number {
    if (violations.length === 0) {
      return 1.0;
    }

    // Use sentence count as a baseline for scoring
    // More violations per sentence = lower score
    const sentenceCount = Math.max(1, (text.match(/[。！？]/g) || []).length);
    const violationsPerSentence = violations.length / sentenceCount;

    // Score decreases as violations per sentence increases
    // 1 violation per sentence = 0.5 score
    // 2+ violations per sentence = very low score
    const score = Math.max(0, 1 - violationsPerSentence * 0.5);

    return Math.round(score * 100) / 100;
  }

  /**
   * Check text with both sync and async rules (including cross-chapter context)
   * Used for initial compliance check per chapter; correction loop uses sync check() only
   */
  async checkWithContext(text: string, chapterContext?: ChapterContext): Promise<ComplianceResult> {
    // Run sync rules
    const syncViolations: Violation[] = [];
    for (const rule of this.rules) {
      syncViolations.push(...rule.check(text));
    }

    // Run async rules in parallel
    const asyncResults = await Promise.all(
      this.asyncRules.map((rule) => rule.check(text, chapterContext)),
    );
    const asyncViolations = asyncResults.flat();

    const violations = [...syncViolations, ...asyncViolations];
    const score = this.calculateScore(text, violations);
    const isCompliant = score >= COMPLIANCE_THRESHOLD;

    return { isCompliant, score, violations };
  }

  /**
   * Get all registered rules
   */
  getRules(): ComplianceRule[] {
    return [...this.rules];
  }

  /**
   * Get all registered async rules
   */
  getAsyncRules(): AsyncComplianceRule[] {
    return [...this.asyncRules];
  }
}
