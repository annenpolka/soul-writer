import type { ReaderPersona } from '../../schemas/reader-personas.js';
import type { PersonaEvaluation } from '../types.js';

/**
 * Input for buildReaderEvalContext
 */
export interface ReaderEvalContextInput {
  persona: ReaderPersona;
  text: string;
  previousEvaluation?: PersonaEvaluation;
}

/**
 * Build the template context for a reader evaluator prompt (pure function).
 * Equivalent to the context-building portion of ReaderEvaluator.evaluate().
 */
export function buildReaderEvalContext(input: ReaderEvalContextInput): Record<string, string> {
  const { persona, text, previousEvaluation } = input;

  return {
    personaName: persona.name,
    personaDescription: persona.description,
    preferencesList: persona.preferences.map(p => `- ${p}`).join('\n'),
    text,
    previousFeedback: previousEvaluation
      ? `[良] ${previousEvaluation.feedback.strengths} [課題] ${previousEvaluation.feedback.weaknesses} [提案] ${previousEvaluation.feedback.suggestion}`
      : '',
    previousScores: previousEvaluation ? JSON.stringify(previousEvaluation.categoryScores) : '',
  };
}
