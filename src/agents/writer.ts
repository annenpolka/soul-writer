import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { DEFAULT_WRITERS, type WriterConfig, type GenerationResult } from './types.js';
import { type NarrativeRules, buildPovRules, resolveNarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';

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

    const constitution = this.soulText.constitution;
    const parts: string[] = [];

    parts.push('あなたは以下の世界観に棲む作家です。原作の文体を「型」として身体に染み込ませた上で、自分の言葉で新しいシーンを書いてください。');
    parts.push('');
    parts.push('【最重要ルール】');
    // Dynamic POV rules based on narrative type
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
    // Soul-specific critical rules from prompt-config
    const writerConfig = this.soulText.promptConfig?.agents?.writer;
    if (writerConfig?.critical_rules) {
      for (const rule of writerConfig.critical_rules) {
        parts.push(`- ${rule}`);
      }
    }
    parts.push('- 出力はプレーンテキストの小説本文のみ。マークダウン記法は一切使用禁止');
    parts.push('- 禁止: **太字**, *斜体*, `コード`, # 見出し, - リスト, > 引用ブロック');
    parts.push('');

    // Full constitution
    parts.push('## 憲法（文体ルール）');
    parts.push('');
    parts.push('### 文構造');
    parts.push(`- 基本傾向: ${constitution.sentence_structure.rhythm_pattern}`);
    parts.push('  ただしこれは大まかな傾向であり、毎段落に機械的に適用するものではない。');
    parts.push('  場面の緊張度や感情の流れに応じてリズムを自然に変化させること。');
    parts.push('  - 緊迫した場面: 短文が連なり、息を詰める');
    parts.push('  - 内省が深まる場面: 文が伸び、思考が蛇行する');
    parts.push('  - 日常の描写: 短文と中文が交互に、淡々と');
    parts.push('  「体言止め。体言止め。長文。」の繰り返しは単調になるので避けること。');
    parts.push(`- 体言止め: ${constitution.sentence_structure.taigendome.usage}（頻度: ${constitution.sentence_structure.taigendome.frequency}）`);
    parts.push(`- 文長の目安: 短文${constitution.sentence_structure.typical_lengths.short} / 長文${constitution.sentence_structure.typical_lengths.long}`);
    parts.push(`- 禁止: ${constitution.sentence_structure.typical_lengths.forbidden}`);
    parts.push('');
    parts.push('### 語彙');
    parts.push(`- 禁止語彙: ${constitution.vocabulary.forbidden_words.join(', ')}`);
    parts.push(`- 特殊記号「${constitution.vocabulary.special_marks.mark}」: ${constitution.vocabulary.special_marks.usage}`);
    parts.push(`- 使用形態: ${constitution.vocabulary.special_marks.forms.join(', ')}`);
    parts.push('- ルビ表記（必須。地の文にそのまま漢字（ルビ）の形で書く。バッククォートや装飾は不要）:');
    for (const bn of constitution.vocabulary.bracket_notations.filter((b: { required: boolean }) => b.required)) {
      parts.push(`  - ${bn.kanji}（${bn.ruby}）`);
    }
    parts.push('');
    parts.push('### 修辞');
    parts.push(`- 比喩の基盤: ${constitution.rhetoric.simile_base}`);
    parts.push(`- 比喩密度: ${constitution.rhetoric.metaphor_density}`);
    parts.push(`- 禁止比喩: ${constitution.rhetoric.forbidden_similes.join(', ')}`);
    parts.push(`- 擬人化許可対象: ${constitution.rhetoric.personification_allowed_for.join(', ')}`);
    parts.push('');
    parts.push('### 語り');
    parts.push(`- 視点: ${this.narrativeRules.povDescription}`);
    parts.push(`- 時制: ${constitution.narrative.default_tense}（${constitution.narrative.tense_shift_allowed}）`);
    parts.push(`- 対話比率: ${constitution.narrative.dialogue_ratio}`);
    parts.push('- キャラクター別対話スタイル:');
    for (const [charName, style] of Object.entries(constitution.narrative.dialogue_style_by_character)) {
      parts.push(`  - ${charName}: ${style}`);
    }
    parts.push('');
    parts.push('### テーマ制約');
    parts.push(`- 維持すべきテーマ: ${constitution.thematic_constraints.must_preserve.join(', ')}`);
    parts.push(`- 禁止結末: ${constitution.thematic_constraints.forbidden_resolutions.join(', ')}`);
    parts.push('');

    // Characters - use developedCharacters if available
    if (this.developedCharacters && this.developedCharacters.length > 0) {
      parts.push('## 登場人物（本作品用）');
      for (const c of this.developedCharacters) {
        const tag = c.isNew ? '（新規）' : '（既存）';
        parts.push(`### ${c.name}${tag}`);
        parts.push(`- 役割: ${c.role}`);
        if (c.description) parts.push(`- 背景: ${c.description}`);
        if (c.voice) parts.push(`- 口調: ${c.voice}`);
      }
      parts.push('この人物のみで執筆すること。上記にない人物を登場させないこと。');
      parts.push('');

      // Inject character constraints from prompt-config for characters present in developedCharacters
      this.injectCharacterConstraints(parts, (charName) =>
        this.developedCharacters!.some(c => c.name.includes(charName))
      );
    } else {
      // Fallback: world-bible characters
      parts.push('## キャラクター');
      for (const [name, char] of Object.entries(this.soulText.worldBible.characters)) {
        const c = char as { role: string; traits?: string[]; speech_pattern?: string };
        parts.push(`### ${name}`);
        parts.push(`- 役割: ${c.role}`);
        if (c.traits) parts.push(`- 特徴: ${c.traits.join(', ')}`);
        if (c.speech_pattern) parts.push(`- 話し方: ${c.speech_pattern}`);
      }
      parts.push('');

      // Character behavior constraints from prompt-config (always include when using world-bible)
      this.injectCharacterConstraints(parts);
    }

    // Terminology
    parts.push('## 用語');
    for (const [term, def] of Object.entries(this.soulText.worldBible.terminology)) {
      parts.push(`- ${term}: ${def}`);
    }
    parts.push('');

    // Anti-Soul with full examples
    parts.push('## 反魂（絶対に書いてはいけないパターン）');
    for (const [category, entries] of Object.entries(this.soulText.antiSoul.categories)) {
      if (entries.length > 0) {
        parts.push(`### ${category}`);
        for (const entry of entries.slice(0, 2)) {
          parts.push(`> 悪い例: ${entry.text.slice(0, 150)}`);
          parts.push(`> 理由: ${entry.reason}`);
        }
      }
    }
    parts.push('');

    // Fragments - multiple categories, multiple fragments each
    parts.push('## 参考断片（原作の質感を吸収せよ）');
    parts.push('以下は原作からの引用断片です。表現をそのままコピーするのではなく、');
    parts.push('語りの温度、視線の動き方、思考の跳躍の仕方、沈黙の置き方を体得し、');
    parts.push('新しいシーンで独自の言葉として表現してください。');
    parts.push('');

    const focusCategories = this.config.focusCategories;
    for (const [category, fragments] of this.soulText.fragments) {
      if (fragments.length === 0) continue;
      const isFocus = focusCategories?.includes(category);
      // Focus categories get more fragments
      const count = isFocus ? Math.min(3, fragments.length) : Math.min(1, fragments.length);
      parts.push(`### ${category}${isFocus ? '（重点）' : ''}`);
      for (let i = 0; i < count; i++) {
        parts.push('```');
        parts.push(fragments[i].text);
        parts.push('```');
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  private injectCharacterConstraints(parts: string[], filter?: (charName: string) => boolean): void {
    const constraints = this.soulText.promptConfig?.character_constraints;
    if (!constraints) return;

    const entries = Object.entries(constraints);
    const filtered = filter ? entries.filter(([name]) => filter(name)) : entries;
    if (filtered.length === 0) return;

    parts.push('## キャラクター行動制約');
    for (const [charName, rules] of filtered) {
      parts.push(`### ${charName}の描写ルール（厳守）`);
      for (const rule of rules) {
        parts.push(`- ${rule}`);
      }
    }
    parts.push('');
  }

  private buildUserPrompt(prompt: string): string {
    return `以下の指示に従って執筆してください：\n\n${prompt}`;
  }
}
