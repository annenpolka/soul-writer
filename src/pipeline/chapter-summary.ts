import type { LLMClient, ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
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

// Tool definition for structured output
const ANALYZE_CHAPTER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'report_chapter_analysis',
    description: '前章の分析結果を報告する',
    parameters: {
      type: 'object',
      properties: {
        storySummary: { type: 'string', description: '物語的要約（200字程度）' },
        emotionalBeats: { type: 'array', items: { type: 'string' }, description: '感情遷移列' },
        dominantImagery: { type: 'array', items: { type: 'string' }, description: '支配的イメージ群' },
        rhythmProfile: { type: 'string', description: 'リズム特徴' },
        structuralPattern: { type: 'string', description: '章内構造パターン' },
      },
      required: ['storySummary', 'emotionalBeats', 'dominantImagery', 'rhythmProfile', 'structuralPattern'],
      additionalProperties: false,
    },
    strict: true,
  },
};

export async function analyzePreviousChapter(
  llmClient: LLMClient,
  chapterText: string,
): Promise<PreviousChapterAnalysis> {
  assertToolCallingClient(llmClient);

  const systemPrompt = buildTemplateBlock('pipeline', 'previous-chapter-analysis', 'systemPrompt', {});

  const response = await llmClient.completeWithTools(
    systemPrompt,
    chapterText,
    [ANALYZE_CHAPTER_TOOL],
    {
      toolChoice: { type: 'function', function: { name: 'report_chapter_analysis' } },
      temperature: 1.0,
    },
  );

  const parsed = parseToolArguments<{
    storySummary: string;
    emotionalBeats: string[];
    dominantImagery: string[];
    rhythmProfile: string;
    structuralPattern: string;
  }>(response, 'report_chapter_analysis');

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

const EXTRACT_INSIGHTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'report_established_insights',
    description: 'この章で確立された認識・発見・関係変化を報告する',
    parameters: {
      type: 'object',
      properties: {
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              insight: { type: 'string', description: '確立された認識・発見・関係変化（例: "語り手はARの歪みに気づいている"）' },
              rule: { type: 'string', description: '次章以降への制約（例: "再度「発見」させないこと"）' },
            },
            required: ['insight', 'rule'],
            additionalProperties: false,
          },
          description: '確立された認識リスト（3〜5個）',
        },
      },
      required: ['insights'],
      additionalProperties: false,
    },
    strict: true,
  },
};

/**
 * Extract established insights from a completed chapter.
 * These insights represent things the narrative has "arrived at" and should not be re-discovered.
 */
export async function extractEstablishedInsights(
  llmClient: LLMClient,
  chapterText: string,
  chapterIndex: number,
): Promise<EstablishedInsight[]> {
  assertToolCallingClient(llmClient);

  const systemPrompt = buildTemplateBlock('pipeline', 'established-insights-extraction', 'systemPrompt', {});

  const response = await llmClient.completeWithTools(
    systemPrompt,
    chapterText,
    [EXTRACT_INSIGHTS_TOOL],
    {
      toolChoice: { type: 'function', function: { name: 'report_established_insights' } },
      temperature: 1.0,
    },
  );

  const parsed = parseToolArguments<{
    insights: Array<{ insight: string; rule: string }>;
  }>(response, 'report_established_insights');

  return (parsed.insights ?? []).map(i => ({
    chapter: chapterIndex,
    insight: i.insight,
    rule: i.rule,
  }));
}
