import type { ComplianceResult, Violation, ChapterContext } from '../agents/types.js';
import type { ComplianceRule } from './rules/forbidden-words.js';
import type { AsyncComplianceRule } from './rules/async-rule.js';
import { createForbiddenWordsRule } from './rules/forbidden-words.js';
import { createForbiddenSimilesRule } from './rules/forbidden-similes.js';
import { createSpecialMarksRule } from './rules/special-marks.js';
import { createPovConsistencyRule } from './rules/pov-consistency.js';
import { createRhythmCheckRule } from './rules/rhythm-check.js';
import { createMarkdownContaminationRule } from './rules/markdown-contamination.js';
import { createQuoteOriginalityRule } from './rules/quote-originality.js';
import { createChineseContaminationRule } from './rules/chinese-contamination.js';
import { createSelfRepetitionRule } from './rules/self-repetition.js';
import { createChapterVariationRule } from './rules/chapter-variation.js';
import type { SoulText } from '../soul/manager.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { LLMClient } from '../llm/types.js';

function buildRulesFromSoulText(
  soulText: SoulText,
  narrativeRules?: NarrativeRules,
  llmClient?: LLMClient,
): { rules: ComplianceRule[]; asyncRules: AsyncComplianceRule[] } {
  const rules: ComplianceRule[] = [];

  const { constitution } = soulText;
  const u = constitution.universal;
  const ps = constitution.protagonist_specific;
  const isDefault = narrativeRules?.isDefaultProtagonist ?? true;

  if (u.vocabulary.forbidden_words.length > 0) {
    rules.push(createForbiddenWordsRule(u.vocabulary.forbidden_words));
  }

  if (u.rhetoric.forbidden_similes.length > 0) {
    rules.push(createForbiddenSimilesRule(u.rhetoric.forbidden_similes));
  }

  if (u.vocabulary.special_marks.mark) {
    rules.push(
      createSpecialMarksRule(
        u.vocabulary.special_marks.mark,
        u.vocabulary.special_marks.forms
      )
    );
  }

  rules.push(createPovConsistencyRule(narrativeRules));

  if (isDefault && ps.sentence_structure.typical_lengths) {
    const maxLen = parseInt(ps.sentence_structure.typical_lengths.forbidden.replace(/[^0-9]/g, '')) || 100;
    rules.push(createRhythmCheckRule(maxLen));
  }

  rules.push(createMarkdownContaminationRule());
  rules.push(createChineseContaminationRule());
  rules.push(createQuoteOriginalityRule(soulText.fragments));

  const asyncRules: AsyncComplianceRule[] = [];
  if (llmClient) {
    asyncRules.push(createSelfRepetitionRule(llmClient));
    asyncRules.push(createChapterVariationRule(llmClient));
  }

  return { rules, asyncRules };
}

export interface ComplianceCheckerFn {
  check: (text: string) => ComplianceResult;
  checkWithContext: (text: string, chapterContext?: ChapterContext) => Promise<ComplianceResult>;
}

export function createComplianceChecker(
  rules: ComplianceRule[],
  asyncRules: AsyncComplianceRule[] = [],
): ComplianceCheckerFn {
  return {
    check: (text) => {
      const violations: Violation[] = [];
      for (const rule of rules) {
        violations.push(...rule.check(text));
      }
      const errors = violations.filter(v => v.severity === 'error');
      const warnings = violations.filter(v => v.severity === 'warning');
      return {
        isCompliant: errors.length === 0,
        violations,
        errorCount: errors.length,
        warningCount: warnings.length,
      };
    },

    checkWithContext: async (text, chapterContext?) => {
      const syncViolations: Violation[] = [];
      for (const rule of rules) {
        syncViolations.push(...rule.check(text));
      }

      const asyncResults = await Promise.all(
        asyncRules.map((rule) => rule.check(text, chapterContext)),
      );
      const asyncViolations = asyncResults.flat();

      const violations = [...syncViolations, ...asyncViolations];
      const errors = violations.filter(v => v.severity === 'error');
      const warnings = violations.filter(v => v.severity === 'warning');
      return {
        isCompliant: errors.length === 0,
        violations,
        errorCount: errors.length,
        warningCount: warnings.length,
      };
    },
  };
}

export function createCheckerFromSoulText(
  soulText: SoulText,
  narrativeRules?: NarrativeRules,
  llmClient?: LLMClient,
): ComplianceCheckerFn {
  const { rules, asyncRules } = buildRulesFromSoulText(soulText, narrativeRules, llmClient);
  return createComplianceChecker(rules, asyncRules);
}

