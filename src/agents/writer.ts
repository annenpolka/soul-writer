import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { DEFAULT_WRITERS, type WriterConfig, type GenerationResult } from './types.js';

export { DEFAULT_WRITERS, type WriterConfig };

/**
 * Writer agent that generates text based on soul text
 */
export class WriterAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private config: WriterConfig;

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    config: WriterConfig = DEFAULT_WRITERS[0]
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.config = config;
  }

  getId(): string {
    return this.config.id;
  }

  getConfig(): WriterConfig {
    return { ...this.config };
  }

  /**
   * Generate text based on the given prompt
   */
  async generate(prompt: string): Promise<string> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(prompt);

    return this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: this.config.temperature,
      topP: this.config.topP,
    });
  }

  /**
   * Generate text and return detailed result
   */
  async generateWithMetadata(prompt: string): Promise<GenerationResult> {
    const tokensBefore = this.llmClient.getTotalTokens();
    const text = await this.generate(prompt);
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      writerId: this.config.id,
      text,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  private buildSystemPrompt(): string {
    const meta = this.soulText.constitution.meta;
    const parts: string[] = [];

    parts.push(`あなたは「${meta.soul_name}」の文体を再現する作家です。`);
    parts.push(`スタイル: ${this.config.style}`);
    parts.push('');
    parts.push('以下のソウルテキストに従って執筆してください。');
    parts.push('');

    // Constitution
    const constitution = this.soulText.constitution;
    parts.push('## 憲法（文体ルール）');
    parts.push(`- リズム: ${constitution.sentence_structure.rhythm_pattern}`);
    parts.push(`- 禁止語彙: ${constitution.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 特殊記号「${constitution.vocabulary.special_marks.mark}」: ${constitution.vocabulary.special_marks.usage}`);
    parts.push(`- 比喩の基盤: ${constitution.rhetoric.simile_base}`);
    parts.push(`- 禁止比喩: ${constitution.rhetoric.forbidden_similes.join(', ')}`);
    parts.push(`- 視点: ${constitution.narrative.default_pov}`);
    parts.push('');

    // World Bible (characters)
    parts.push('## キャラクター');
    for (const [name, char] of Object.entries(this.soulText.worldBible.characters)) {
      parts.push(`- ${name}: ${char.role}`);
    }
    parts.push('');

    // Terminology
    parts.push('## 用語');
    for (const [term, def] of Object.entries(this.soulText.worldBible.terminology)) {
      parts.push(`- ${term}: ${def}`);
    }
    parts.push('');

    // Anti-Soul
    parts.push('## 禁止パターン');
    for (const [category, entries] of Object.entries(this.soulText.antiSoul.categories)) {
      if (entries.length > 0) {
        parts.push(`- ${category}: ${entries[0].reason}`);
      }
    }
    parts.push('');

    // Sample fragments
    parts.push('## 参考断片');
    for (const [_category, fragments] of this.soulText.fragments) {
      if (fragments.length > 0) {
        parts.push('```');
        parts.push(fragments[0].text.slice(0, 200));
        parts.push('```');
        break;
      }
    }

    return parts.join('\n');
  }

  private buildUserPrompt(prompt: string): string {
    return `以下の指示に従って執筆してください：\n\n${prompt}`;
  }
}
