import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { describe, it, expect, vi } from 'vitest';
import { analyzePreviousChapter, extractEstablishedInsights } from '../../src/pipeline/chapter-summary.js';
import type { LLMClient } from '../../src/llm/types.js';
import { renderSections } from '../../src/template/renderer.js';
import type { Section } from '../../src/template/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PipelinePromptTemplate {
  templates: Record<string, string>;
}

function loadPipelineSystemPrompt(templateName: string): string {
  const filePath = join(__dirname, '..', '..', 'src', 'prompts', 'pipeline', `${templateName}.yaml`);
  const raw = readFileSync(filePath, 'utf-8');
  const doc = yaml.load(raw) as PipelinePromptTemplate;
  const systemPrompt = doc.templates.systemPrompt;
  const sections: Section[] = [{ type: 'text', text: systemPrompt }];
  return renderSections(sections, {});
}

function createMockLLMClient(data: unknown) {
  return {
    complete: vi.fn(),
    completeStructured: vi.fn().mockResolvedValue({
      data,
      reasoning: null,
      tokensUsed: 100,
    }),
    getTotalTokens: vi.fn().mockReturnValue(0),
  } satisfies LLMClient;
}

const sampleChapterText = '透心は窓の外を見た。灰色の空が広がっていた。';

describe('analyzePreviousChapter', () => {
  it('正常系: PreviousChapterAnalysis が正しくパースされる', async () => {
    const toolResponse = {
      storySummary: '透心が窓の外の灰色の空を眺め、孤独を感じる場面',
      emotionalBeats: ['孤独', '諦観', '微かな希望'],
      dominantImagery: ['灰色', '窓', '空'],
      rhythmProfile: '短文連打のスタッカート',
      structuralPattern: '観察→内省→未解決',
    };
    const client = createMockLLMClient(toolResponse);

    const result = await analyzePreviousChapter(client, sampleChapterText);

    expect(result.storySummary).toBe('透心が窓の外の灰色の空を眺め、孤独を感じる場面');
    expect(result.avoidanceDirective.emotionalBeats).toEqual(['孤独', '諦観', '微かな希望']);
    expect(result.avoidanceDirective.dominantImagery).toEqual(['灰色', '窓', '空']);
    expect(result.avoidanceDirective.rhythmProfile).toBe('短文連打のスタッカート');
    expect(result.avoidanceDirective.structuralPattern).toBe('観察→内省→未解決');
  });

  it('storySummary と avoidanceDirective の各フィールドが返される', async () => {
    const toolResponse = {
      storySummary: '要約テスト',
      emotionalBeats: ['怒り'],
      dominantImagery: ['炎'],
      rhythmProfile: '長文の波状',
      structuralPattern: '衝突→収束',
    };
    const client = createMockLLMClient(toolResponse);

    const result = await analyzePreviousChapter(client, sampleChapterText);

    expect(result).toHaveProperty('storySummary');
    expect(result).toHaveProperty('avoidanceDirective');
    expect(result.avoidanceDirective).toHaveProperty('emotionalBeats');
    expect(result.avoidanceDirective).toHaveProperty('dominantImagery');
    expect(result.avoidanceDirective).toHaveProperty('rhythmProfile');
    expect(result.avoidanceDirective).toHaveProperty('structuralPattern');
  });

  it('tool calling非対応LLMでも構造化出力で動作する', async () => {
    const client: LLMClient = {
      complete: vi.fn(),
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          storySummary: '要約',
          emotionalBeats: ['孤独'],
          dominantImagery: ['灰色'],
          rhythmProfile: '短文',
          structuralPattern: '観察',
        },
        reasoning: null,
        tokensUsed: 100,
      }),
      getTotalTokens: vi.fn().mockReturnValue(0),
    };

    const result = await analyzePreviousChapter(client, sampleChapterText);
    expect(result.storySummary).toBe('要約');
  });

  it('completeStructured が throw した場合にエラーが伝播する', async () => {
    const client: LLMClient = {
      complete: vi.fn(),
      completeStructured: vi.fn().mockRejectedValue(new Error('API error')),
      getTotalTokens: vi.fn().mockReturnValue(0),
    };

    await expect(analyzePreviousChapter(client, sampleChapterText)).rejects.toThrow('API error');
  });

  it('パイプラインテンプレート（previous-chapter-analysis.yaml）を system prompt に使用する', async () => {
    const toolResponse = {
      storySummary: '要約',
      emotionalBeats: ['孤独'],
      dominantImagery: ['灰色'],
      rhythmProfile: '短文',
      structuralPattern: '観察',
    };
    const client = createMockLLMClient(toolResponse);

    await analyzePreviousChapter(client, sampleChapterText);

    const expectedSystemPrompt = loadPipelineSystemPrompt('previous-chapter-analysis');
    expect(client.completeStructured).toHaveBeenCalledWith(
      [
        { role: 'system', content: expectedSystemPrompt },
        { role: 'user', content: sampleChapterText },
      ],
      expect.any(Object),
      expect.any(Object),
    );
  });
});

describe('extractEstablishedInsights', () => {
  it('正常系: chapter番号を付与して insights を返す', async () => {
    const client = createMockLLMClient({
      insights: [
        { insight: '透心はARの歪みに気づいた', rule: '再度「発見」させないこと' },
        { insight: 'つるぎとの距離が縮まった', rule: '再度「出会い」を演出しないこと' },
      ],
    });

    const result = await extractEstablishedInsights(client, sampleChapterText, 3);

    expect(result).toEqual([
      { chapter: 3, insight: '透心はARの歪みに気づいた', rule: '再度「発見」させないこと' },
      { chapter: 3, insight: 'つるぎとの距離が縮まった', rule: '再度「出会い」を演出しないこと' },
    ]);
  });

  it('パイプラインテンプレート（established-insights-extraction.yaml）を system prompt に使用する', async () => {
    const client = createMockLLMClient({
      insights: [{ insight: '認識', rule: '制約' }],
    });

    await extractEstablishedInsights(client, sampleChapterText, 1);

    const expectedSystemPrompt = loadPipelineSystemPrompt('established-insights-extraction');
    expect(client.completeStructured).toHaveBeenCalledWith(
      [
        { role: 'system', content: expectedSystemPrompt },
        { role: 'user', content: sampleChapterText },
      ],
      expect.any(Object),
      expect.any(Object),
    );
  });
});
