import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import { buildTemplateBlock } from '../template/composer.js';

export interface PreviousChapterAnalysis {
  storySummary: string;
  avoidanceDirective: {
    emotionalBeats: string[];
    dominantImagery: string[];
    rhythmProfile: string;
    structuralPattern: string;
  };
}

const StringArrayOrStringSchema = z.union([z.array(z.string()), z.string()]);

const PreviousChapterAnalysisSchema = z.object({
  storySummary: z.string(),
  emotionalBeats: StringArrayOrStringSchema,
  dominantImagery: StringArrayOrStringSchema,
  rhythmProfile: z.string(),
  structuralPattern: z.string(),
});

export async function analyzePreviousChapter(
  llmClient: LLMClient,
  chapterText: string,
): Promise<PreviousChapterAnalysis> {
  const systemPrompt = buildTemplateBlock('pipeline', 'previous-chapter-analysis', 'systemPrompt', {});

  const response = await llmClient.completeStructured(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: chapterText },
    ],
    PreviousChapterAnalysisSchema,
    { temperature: 1.0 },
  );

  const parsed = response.data;

  return {
    storySummary: parsed.storySummary,
    avoidanceDirective: {
      emotionalBeats: ensureStringArray(parsed.emotionalBeats),
      dominantImagery: ensureStringArray(parsed.dominantImagery),
      rhythmProfile: parsed.rhythmProfile ?? '',
      structuralPattern: parsed.structuralPattern ?? '',
    },
  };
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
  return [];
}

// =====================
// WS4: Established Insights Extraction
// =====================

export interface EstablishedInsight {
  chapter: number;
  insight: string;
  rule: string;
}

const EstablishedInsightsSchema = z.object({
  insights: z.array(z.object({
    insight: z.string(),
    rule: z.string(),
  })),
});

/**
 * Extract established insights from a completed chapter.
 * These insights represent things the narrative has "arrived at" and should not be re-discovered.
 */
export async function extractEstablishedInsights(
  llmClient: LLMClient,
  chapterText: string,
  chapterIndex: number,
): Promise<EstablishedInsight[]> {
  const systemPrompt = buildTemplateBlock('pipeline', 'established-insights-extraction', 'systemPrompt', {});

  const response = await llmClient.completeStructured(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: chapterText },
    ],
    EstablishedInsightsSchema,
    { temperature: 1.0 },
  );

  const parsed = response.data;

  return (parsed.insights ?? []).map(i => ({
    chapter: chapterIndex,
    insight: i.insight,
    rule: i.rule,
  }));
}
