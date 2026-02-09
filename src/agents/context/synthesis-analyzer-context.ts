import type { SoulText } from '../../soul/manager.js';
import type { SynthesisAnalyzerInput, ThemeContext, MacGuffinContext } from '../types.js';
import type { NarrativeRules } from '../../factory/narrative-rules.js';

/**
 * Input for buildSynthesisAnalyzerContext
 */
export interface SynthesisAnalyzerContextInput {
  soulText: SoulText;
  input: SynthesisAnalyzerInput;
  narrativeRules: NarrativeRules;
  themeContext?: ThemeContext;
  macGuffinContext?: MacGuffinContext;
}

/**
 * Build the full template context for a synthesis-analyzer prompt (pure function).
 *
 * Produces a context object containing:
 * - allTexts: all generation texts with champion flag
 * - judgeAnalysis: per-round judge detailed analysis (weaknesses, axis_comments, section_analysis)
 * - styleRules: constitution style constraints
 * - plotContext, macGuffinContext, chapterContext (optional)
 * - themeContext (optional)
 * - championId
 */
export function buildSynthesisAnalyzerContext(input: SynthesisAnalyzerContextInput): Record<string, unknown> {
  const { soulText, input: analyzerInput, narrativeRules, themeContext, macGuffinContext } = input;

  // All generation texts with champion flag
  const allTexts = analyzerInput.allGenerations.map(g => ({
    writerId: g.writerId,
    text: g.text,
    isChampion: g.writerId === analyzerInput.championId,
  }));

  // Judge analysis from rounds
  const judgeAnalysis = analyzerInput.rounds.map(round => {
    const entry: Record<string, unknown> = {
      matchName: round.matchName,
      contestantA: round.contestantA,
      contestantB: round.contestantB,
      winner: round.winner,
      reasoning: round.judgeResult.reasoning,
      scores: round.judgeResult.scores,
    };
    if (round.judgeResult.weaknesses) {
      entry.weaknesses = round.judgeResult.weaknesses;
    }
    if (round.judgeResult.axis_comments) {
      entry.axis_comments = round.judgeResult.axis_comments;
    }
    if (round.judgeResult.section_analysis) {
      entry.section_analysis = round.judgeResult.section_analysis;
    }
    if (round.judgeResult.praised_excerpts) {
      entry.praised_excerpts = round.judgeResult.praised_excerpts;
    }
    return entry;
  });

  // Constitution style rules
  const constitution = soulText.constitution;
  const u = constitution.universal;
  const ps = constitution.protagonist_specific;
  const styleRules = {
    rhythm: ps.sentence_structure.rhythm_pattern,
    forbiddenWords: u.vocabulary.forbidden_words,
    forbiddenSimiles: u.rhetoric.forbidden_similes,
    simileBase: u.rhetoric.simile_base,
    povDescription: narrativeRules.povDescription,
    pronoun: narrativeRules.pronoun,
  };

  const ctx: Record<string, unknown> = {
    allTexts,
    judgeAnalysis,
    styleRules,
    championId: analyzerInput.championId,
  };

  if (analyzerInput.plotContext) {
    ctx.plotContext = analyzerInput.plotContext;
  }

  if (macGuffinContext) {
    ctx.macGuffinContext = macGuffinContext;
  }

  if (analyzerInput.chapterContext) {
    ctx.chapterContext = analyzerInput.chapterContext;
  }

  if (themeContext) {
    ctx.themeContext = themeContext;
  }

  // Enriched character expectations for verifying physical habits / stance reflection
  if (analyzerInput.enrichedCharacters && analyzerInput.enrichedCharacters.length > 0) {
    ctx.enrichedCharacterExpectations = analyzerInput.enrichedCharacters.map(c => ({
      name: c.name,
      expectedHabits: c.physicalHabits.map(h => h.habit),
      expectedStance: c.stance.type,
    }));
  }

  return ctx;
}
