import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { DEFAULT_WRITERS, type WriterConfig, type GenerationResult } from './types.js';
import { type NarrativeRules, buildPovRules, resolveNarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import { buildPrompt } from '../template/composer.js';

export { DEFAULT_WRITERS, type WriterConfig };

/**
 * Writer agent that generates text based on soul text
 */
export class WriterAgent {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private config: WriterConfig;
  private narrativeRules: NarrativeRules;
  private developedCharacters?: DevelopedCharacter[];

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    config: WriterConfig = DEFAULT_WRITERS[0],
    narrativeRules?: NarrativeRules,
    developedCharacters?: DevelopedCharacter[],
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.config = config;
    this.narrativeRules = narrativeRules ?? resolveNarrativeRules();
    this.developedCharacters = developedCharacters;
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
    const context = this.buildContext(prompt);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('writer', context);

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

  private buildContext(prompt: string): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};

    ctx.criticalRules = this.buildCriticalRules();
    ctx.constitution = this.buildConstitutionData();
    ctx.narrativeRules = this.narrativeRules;

    // Characters (structured data for include)
    if (this.developedCharacters && this.developedCharacters.length > 0) {
      ctx.developedCharacters = this.developedCharacters.map(c => ({
        ...c,
        displayName: `${c.name}${c.isNew ? '（新規）' : '（既存）'}`,
      }));
    } else {
      ctx.worldBibleCharacters = Object.entries(this.soulText.worldBible.characters).map(
        ([name, char]) => {
          const c = char as { role: string; traits?: string[]; speech_pattern?: string };
          return { name, role: c.role, traits: c.traits, speech_pattern: c.speech_pattern };
        },
      );
    }

    // Character constraints (structured data for include)
    const constraintEntries = this.buildCharacterConstraintEntries();
    if (constraintEntries.length > 0) {
      ctx.characterConstraintEntries = constraintEntries;
    }

    // Terminology (structured data for include)
    ctx.terminologyEntries = Object.entries(this.soulText.worldBible.terminology).map(
      ([term, definition]) => ({ term, definition }),
    );

    // Anti-soul (structured data for include)
    ctx.antiSoulEntries = this.buildAntiSoulEntries();

    // Fragments (structured data for include)
    ctx.fragmentCategories = this.buildFragmentCategories();

    ctx.prompt = prompt;

    return ctx;
  }

  private buildCriticalRules(): string {
    const parts: string[] = [];
    parts.push('【最重要ルール】');
    for (const rule of buildPovRules(this.narrativeRules)) {
      parts.push(rule);
    }
    parts.push('- 文体は冷徹・簡潔・乾いた語り。装飾過多や感傷的表現を避ける');
    if (this.narrativeRules.isDefaultProtagonist) {
      parts.push('- 原作にない設定やキャラクターを捏造しない');
    } else {
      parts.push('- この世界観に存在し得る設定・キャラクターを使用すること');
    }
    parts.push('- 参考断片の表現をそのままコピーしない。文体の「質感」を吸収し、独自の描写で新しいシーンを構築すること');
    parts.push('- 参考断片は文体の質感を学ぶためのもの。シーンやプロットを再現してはならない');
    parts.push('- 原作に存在しない新しい描写・比喩・状況を積極的に創作すること');
    parts.push('- 原典のセリフを直接引用しない。キャラクターの口調を再現しつつ、新しいセリフを創作すること');
    parts.push('- 例外：回想シーンで過去の会話を思い出す場合のみ、短い引用を許可');
    const writerConfig = this.soulText.promptConfig?.agents?.writer;
    if (writerConfig?.critical_rules) {
      for (const rule of writerConfig.critical_rules) {
        parts.push(`- ${rule}`);
      }
    }
    parts.push('- 出力はプレーンテキストの小説本文のみ。マークダウン記法は一切使用禁止');
    parts.push('- 禁止: **太字**, *斜体*, `コード`, # 見出し, - リスト, > 引用ブロック');
    return parts.join('\n');
  }

  private buildConstitutionData(): Record<string, unknown> {
    const c = this.soulText.constitution;
    return {
      ...c,
      vocabulary: {
        ...c.vocabulary,
        bracket_notations_required: c.vocabulary.bracket_notations.filter(
          (b: { required: boolean }) => b.required,
        ),
      },
      narrative: {
        ...c.narrative,
        dialogue_style_entries: Object.entries(c.narrative.dialogue_style_by_character).map(
          ([name, style]) => ({ name, style }),
        ),
      },
    };
  }

  private buildCharacterConstraintEntries(): Array<{ name: string; rules: string[] }> {
    const constraints = this.soulText.promptConfig?.character_constraints;
    if (!constraints) return [];

    const filter = this.developedCharacters
      ? (charName: string) => this.developedCharacters!.some(c => c.name.includes(charName))
      : undefined;

    const entries = Object.entries(constraints);
    const filtered = filter ? entries.filter(([name]) => filter(name)) : entries;
    return filtered.map(([name, rules]) => ({ name, rules }));
  }

  private buildAntiSoulEntries(): Array<{ category: string; examples: Array<{ text: string; reason: string }> }> {
    const result: Array<{ category: string; examples: Array<{ text: string; reason: string }> }> = [];
    for (const [category, entries] of Object.entries(this.soulText.antiSoul.categories)) {
      if (entries.length > 0) {
        result.push({
          category,
          examples: entries.slice(0, 2).map(e => ({
            text: e.text.slice(0, 150),
            reason: e.reason,
          })),
        });
      }
    }
    return result;
  }

  private buildFragmentCategories(): Array<{ name: string; focusLabel: string; items: Array<{ text: string }> }> {
    const focusCategories = this.config.focusCategories;
    const result: Array<{ name: string; focusLabel: string; items: Array<{ text: string }> }> = [];
    for (const [category, fragments] of this.soulText.fragments) {
      if (fragments.length === 0) continue;
      const isFocus = focusCategories?.includes(category);
      const count = isFocus ? Math.min(3, fragments.length) : Math.min(1, fragments.length);
      result.push({
        name: category,
        focusLabel: isFocus ? '（重点）' : '',
        items: fragments.slice(0, count).map(f => ({ text: f.text })),
      });
    }
    return result;
  }
}
