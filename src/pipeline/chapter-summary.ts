import type { LLMClient, ToolDefinition } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';

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

  const systemPrompt = `あなたは小説の章を分析する専門家です。次章の執筆者が「前章と異なるアプローチ」を取れるよう、以下の観点で前章を分析してください:
1. storySummary: 何が起きたかの物語的要約（200字程度）
2. emotionalBeats: 感情の遷移列（例: ["疎外", "怒り", "麻痺"]）
3. dominantImagery: 支配的なイメージ群（例: ["金属", "冷たさ", "振動"]）
4. rhythmProfile: 文章リズムの特徴（例: "短文連打のスタッカート"）
5. structuralPattern: 章内の展開構造（例: "観察→異常発見→内省→未解決"）`;

  const response = await llmClient.completeWithTools(
    systemPrompt,
    chapterText,
    [ANALYZE_CHAPTER_TOOL],
    {
      toolChoice: { type: 'function', function: { name: 'report_chapter_analysis' } },
      temperature: 0.3,
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
