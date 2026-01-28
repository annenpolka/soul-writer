/**
 * Writer agent configuration
 */
export interface WriterConfig {
  id: string;
  temperature: number;
  topP: number;
  style: 'balanced' | 'creative' | 'conservative' | 'moderate';
}

/**
 * Default writer configurations for tournament
 */
export const DEFAULT_WRITERS: WriterConfig[] = [
  { id: 'writer_1', temperature: 0.7, topP: 0.9, style: 'balanced' },
  { id: 'writer_2', temperature: 0.9, topP: 0.95, style: 'creative' },
  { id: 'writer_3', temperature: 0.5, topP: 0.8, style: 'conservative' },
  { id: 'writer_4', temperature: 0.8, topP: 0.85, style: 'moderate' },
];

/**
 * Score breakdown for judge evaluation
 */
export interface ScoreBreakdown {
  style: number;
  compliance: number;
  overall: number;
}

/**
 * Result of judge evaluation
 */
export interface JudgeResult {
  winner: 'A' | 'B';
  reasoning: string;
  scores: {
    A: ScoreBreakdown;
    B: ScoreBreakdown;
  };
}

/**
 * Generation result from a writer
 */
export interface GenerationResult {
  writerId: string;
  text: string;
  tokensUsed: number;
}
