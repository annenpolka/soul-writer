import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import type { GeneratedTheme } from '../schemas/generated-theme.js';

export interface DevelopedCharacter {
  name: string;
  isNew: boolean;
  role: string;
  description?: string;
  voice?: string;
}

export interface DevelopedCharacters {
  characters: DevelopedCharacter[];
  castingRationale: string;
}

export interface CharacterDevelopResult {
  developed: DevelopedCharacters;
  tokensUsed: number;
}

/**
 * Develops detailed character configurations for a given theme.
 * Ensures character diversity across batch runs.
 */
export class CharacterDeveloperAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;

  constructor(llmClient: LLMClient, soulText: SoulText) {
    this.llmClient = llmClient;
    this.soulText = soulText;
  }

  async develop(theme: GeneratedTheme): Promise<CharacterDevelopResult> {
    const tokensBefore = this.llmClient.getTotalTokens();
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(theme);

    const response = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 0.8,
    });

    const developed = this.parseResponse(response, theme);
    const tokensUsed = this.llmClient.getTotalTokens() - tokensBefore;

    return { developed, tokensUsed };
  }

  private buildSystemPrompt(): string {
    const worldBible = this.soulText.worldBible;
    const parts: string[] = [];

    parts.push('あなたはキャラクターキャスティングの専門家です。');
    parts.push('物語のテーマに最適なキャラクター構成を設計してください。');
    parts.push('');
    parts.push('## 世界観の既存キャラクター（参考）');

    for (const [name, char] of Object.entries(worldBible.characters)) {
      const c = char as { role: string; voice?: string; background?: string };
      parts.push(`- ${name}: ${c.role}${c.voice ? `（口調: ${c.voice}）` : ''}`);
    }
    parts.push('');

    parts.push('## キャスティングルール');
    parts.push('- 既存キャラクターを使う義務はない。テーマに合うなら新規キャラクターだけでもよい');
    parts.push('- 「叔父」は物語に不可欠な場合（MRフロアの設定に直接関わる等）のみ登場させる。装飾的な登場は避ける');
    parts.push('- 新規キャラクターには必ず name, role, voice, description を付与する');
    parts.push('- キャラクター数は2-4名が目安。多すぎても少なすぎても物語の質が下がる');
    parts.push('- narrative_typeに応じた配置:');
    parts.push('  - モブ/システム視点系 → 新規キャラを主軸に');
    parts.push('  - 群像劇 → 既存+新規をミックス');
    parts.push('  - 一人称内面独白 → 主人公1名を中心に（既存でも新規でも可）');
    parts.push('');

    parts.push('## 出力形式');
    parts.push('```json');
    parts.push('{');
    parts.push('  "characters": [');
    parts.push('    { "name": "名前", "isNew": false, "role": "この物語での役割", "voice": "口調" },');
    parts.push('    { "name": "新キャラ名", "isNew": true, "role": "役割", "description": "外見や背景", "voice": "口調の特徴" }');
    parts.push('  ],');
    parts.push('  "castingRationale": "なぜこの組み合わせか（1-2文）"');
    parts.push('}');
    parts.push('```');

    return parts.join('\n');
  }

  private buildUserPrompt(theme: GeneratedTheme): string {
    const parts: string[] = [];

    parts.push('## テーマ');
    parts.push(`感情: ${theme.emotion}`);
    parts.push(`時間軸: ${theme.timeline}`);
    parts.push(`前提: ${theme.premise}`);
    if (theme.narrative_type) {
      parts.push(`ナラティブ型: ${theme.narrative_type}`);
    }
    parts.push('');

    parts.push('## テーマ生成時のキャラクター案');
    for (const c of theme.characters) {
      if (c.isNew) {
        parts.push(`- ${c.name}（新規）: ${c.description || '未定義'}`);
      } else {
        parts.push(`- ${c.name}（既存）`);
      }
    }
    parts.push('');

    parts.push('上記のテーマに最適なキャラクター構成を設計してください。');
    parts.push('テーマ生成時の案を参考にしつつ、改善・変更してもよいです。');
    parts.push('JSON形式で回答してください。');

    return parts.join('\n');
  }

  private parseResponse(response: string, theme: GeneratedTheme): DevelopedCharacters {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.fallback(theme);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
        return this.fallback(theme);
      }

      return {
        characters: parsed.characters.map((c: Record<string, unknown>) => ({
          name: String(c.name || ''),
          isNew: Boolean(c.isNew),
          role: String(c.role || ''),
          description: c.description ? String(c.description) : undefined,
          voice: c.voice ? String(c.voice) : undefined,
        })),
        castingRationale: String(parsed.castingRationale || ''),
      };
    } catch {
      return this.fallback(theme);
    }
  }

  private fallback(theme: GeneratedTheme): DevelopedCharacters {
    return {
      characters: theme.characters.map(c => ({
        name: c.name,
        isNew: c.isNew,
        role: c.description || '',
        description: c.description,
      })),
      castingRationale: 'Fallback: テーマ生成時のキャラクターをそのまま使用',
    };
  }
}
