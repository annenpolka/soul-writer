import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { GeneratedThemeSchema, type GeneratedTheme } from '../schemas/generated-theme.js';

export interface ThemeResult {
  theme: GeneratedTheme;
  tokensUsed: number;
}

/**
 * Agent that generates random themes for story generation
 * Uses world-bible to ensure themes fit within the established world
 */
export class ThemeGeneratorAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  /**
   * Generate a random theme based on the soul text's world
   */
  async generateTheme(): Promise<ThemeResult> {
    const tokensBefore = this.llmClient.getTotalTokens();
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt();

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.9, // Higher temperature for more variety
    });

    const theme = this.parseResponse(response);
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      theme,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [];
    const meta = this.soulText.constitution.meta;
    const worldBible = this.soulText.worldBible;
    const thematic = this.soulText.constitution.thematic_constraints;

    parts.push(`あなたは「${meta.soul_name}」の世界観内で新しい物語のテーマを生成するエージェントです。`);
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
    const characters = worldBible.characters;
    if (Object.keys(characters).length > 0) {
      parts.push('## 既存キャラクター');
      for (const [name, char] of Object.entries(characters)) {
        parts.push(`- ${name}: ${char.role} - ${char.description || ''}`);
      }
      parts.push('');
    }

    // Technology
    const tech = worldBible.technology;
    if (Object.keys(tech).length > 0) {
      parts.push('## 技術設定');
      for (const [name, desc] of Object.entries(tech)) {
        const description = typeof desc === 'object' && 'description' in desc
          ? (desc as { description: string }).description
          : String(desc);
        parts.push(`- ${name}: ${description}`);
      }
      parts.push('');
    }

    // Society
    const society = worldBible.society;
    if (Object.keys(society).length > 0) {
      parts.push('## 社会設定');
      for (const [name, desc] of Object.entries(society)) {
        const state = typeof desc === 'object' && 'state' in desc
          ? (desc as { state: string }).state
          : String(desc);
        parts.push(`- ${name}: ${state}`);
      }
      parts.push('');
    }

    // Scene catalog
    parts.push('## シーン種類カタログ');
    parts.push('以下から2-4種類を選択してください。毎回異なる組み合わせを選ぶこと:');
    parts.push('- 教室独白（授業中の透心の内面）');
    parts.push('- 屋上会話（つるぎとの非公式な対話）');
    parts.push('- 名前消去事件（ARタグの操作に関する出来事）');
    parts.push('- 日常観察（透心が他者を観察する静かなシーン）');
    parts.push('- MRフロアセッション（仮想殺害の場面）');
    parts.push('- セッション後の反芻（殺害後の内省）');
    parts.push('- 通学路・移動（物理空間での孤独）');
    parts.push('- デジタル空間探索（ARシステムの裏側）');
    parts.push('- 他生徒との表面的交流（学級委員長としての仮面）');
    parts.push('- 記憶・回想（孤児院や過去の断片）');
    parts.push('');
    parts.push('## オリジナリティ要求');
    parts.push('- 上記カタログはあくまで参考。原作にない新しいシーン・場所・アイテムを積極的に発明すること');
    parts.push('- 例：透心が一人で行く場所、つるぎ以外の人物との遭遇、ARシステムの予想外の挙動');
    parts.push('- 原作の再現ではなく、原作の世界観を拡張する物語を生成すること');
    parts.push('');

    // Output format
    parts.push('## 出力形式');
    parts.push('以下のJSON形式でテーマを出力してください:');
    parts.push('```json');
    parts.push('{');
    parts.push('  "emotion": "感情テーマ（例：孤独、渇望、怒り）",');
    parts.push('  "timeline": "時系列（例：出会い前、出会い後、事件後）",');
    parts.push('  "characters": [');
    parts.push('    {"name": "キャラ名", "isNew": false},');
    parts.push('    {"name": "新キャラ名", "isNew": true, "description": "新キャラの説明"}');
    parts.push('  ],');
    parts.push('  "premise": "物語の前提を1-2文で",');
    parts.push('  "scene_types": ["教室独白", "通学路・移動"]');
    parts.push('}');
    parts.push('```');

    return parts.join('\n');
  }

  private buildUserPrompt(): string {
    return '上記の世界観に基づいて、新しい物語のテーマを1つ生成してください。既存キャラクターを使いつつ、必要に応じて新規キャラクターを追加できます。JSON形式で回答してください。';
  }

  private parseResponse(response: string): GeneratedTheme {
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
    const result = GeneratedThemeSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Theme validation failed: ${result.error.message}`);
    }

    return result.data;
  }
}
