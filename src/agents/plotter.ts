import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { PlotSchema, type Plot } from '../schemas/plot.js';
import {
  DEFAULT_PLOTTER_CONFIG,
  type PlotterConfig,
  type PlotResult,
} from './types.js';

export { type PlotterConfig, type PlotResult };

/**
 * Plotter agent that generates plot structures for stories
 */
export class PlotterAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private config: PlotterConfig;

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    config: Partial<PlotterConfig> = {}
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.config = { ...DEFAULT_PLOTTER_CONFIG, ...config };
  }

  getConfig(): PlotterConfig {
    return { ...this.config };
  }

  /**
   * Generate a plot structure for a story
   */
  async generatePlot(): Promise<PlotResult> {
    const tokensBefore = this.llmClient.getTotalTokens();
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt();

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: this.config.temperature,
    });

    const plot = this.parseResponse(response);
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      plot,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  private buildSystemPrompt(): string {
    const meta = this.soulText.constitution.meta;
    const thematic = this.soulText.constitution.thematic_constraints;
    const parts: string[] = [];

    parts.push(`あなたは「${meta.soul_name}」のプロット設計者です。`);
    parts.push('物語の章構成を設計してください。');
    parts.push('');

    // Thematic constraints
    if (thematic.must_preserve.length > 0) {
      parts.push('## 維持すべきテーマ');
      for (const theme of thematic.must_preserve) {
        parts.push(`- ${theme}`);
      }
      parts.push('');
    }

    // Characters
    const characters = this.soulText.worldBible.characters;
    if (Object.keys(characters).length > 0) {
      parts.push('## 主要キャラクター');
      for (const [name, char] of Object.entries(characters)) {
        parts.push(`- ${name}: ${char.role} - ${char.description || ''}`);
      }
      parts.push('');
    }

    // World settings
    const tech = this.soulText.worldBible.technology;
    if (Object.keys(tech).length > 0) {
      parts.push('## 技術設定');
      for (const [name, desc] of Object.entries(tech)) {
        parts.push(`- ${name}: ${desc}`);
      }
      parts.push('');
    }

    // Output format
    parts.push('## 出力形式');
    parts.push('以下のJSON形式で章構成を出力してください:');
    parts.push('```json');
    parts.push('{');
    parts.push('  "title": "物語のタイトル",');
    parts.push('  "theme": "中心テーマの説明",');
    parts.push('  "chapters": [');
    parts.push('    {');
    parts.push('      "index": 1,');
    parts.push('      "title": "章タイトル",');
    parts.push('      "summary": "章の要約",');
    parts.push('      "key_events": ["イベント1", "イベント2"],');
    parts.push('      "target_length": 4000');
    parts.push('    }');
    parts.push('  ]');
    parts.push('}');
    parts.push('```');

    return parts.join('\n');
  }

  private buildUserPrompt(): string {
    const parts: string[] = [];

    // Include theme if specified (used by Factory)
    if (this.config.theme) {
      const t = this.config.theme;
      parts.push('## テーマ指定');
      parts.push(`感情テーマ: ${t.emotion}`);
      parts.push(`時系列: ${t.timeline}`);
      parts.push(`前提: ${t.premise}`);
      parts.push('登場人物:');
      for (const c of t.characters) {
        if (c.isNew) {
          parts.push(`- ${c.name}（新規）: ${c.description || ''}`);
        } else {
          parts.push(`- ${c.name}`);
        }
      }
      if (t.scene_types && t.scene_types.length > 0) {
        parts.push(`指定シーン種類: ${t.scene_types.join(', ')}`);
        parts.push('これらのシーン種類を章に反映してください。すべてMRフロアに収束させないこと。');
      }
      parts.push('');
    }

    parts.push(`${this.config.chapterCount}章構成の物語を設計してください。`);
    parts.push(`総文字数の目安: ${this.config.targetTotalLength}字`);
    parts.push('');
    parts.push('JSON形式で回答してください。');

    return parts.join('\n');
  }

  private parseResponse(response: string): Plot {
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse JSON response');
    }

    // Validate with Zod schema
    const result = PlotSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Plot validation failed: ${result.error.message}`);
    }

    return result.data;
  }
}
