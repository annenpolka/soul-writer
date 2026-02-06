import type { Chapter, Plot } from '../schemas/plot.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import type { CharacterMacGuffin, PlotMacGuffin } from '../schemas/macguffin.js';

export interface ChapterPromptInput {
  chapter: Chapter;
  plot: Plot;
  narrativeType?: string;
  narrativeRules?: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  characterMacGuffins?: CharacterMacGuffin[];
  plotMacGuffins?: PlotMacGuffin[];
}

/**
 * Build a prompt for chapter generation.
 * Pure function — no side effects, no external state.
 */
export function buildChapterPrompt(input: ChapterPromptInput): string {
  const { chapter, plot } = input;
  const parts: string[] = [];

  parts.push(`# ${plot.title}`);
  parts.push(`テーマ: ${plot.theme}`);
  parts.push('');

  // Inject narrative rules
  if (input.narrativeType && input.narrativeRules) {
    parts.push(`## ナラティブ`);
    parts.push(`- 型: ${input.narrativeType}`);
    parts.push(`- ${input.narrativeRules.povDescription}`);
    parts.push('');
  }

  // Inject developed characters
  if (input.developedCharacters && input.developedCharacters.length > 0) {
    parts.push('## 登場人物');
    for (const c of input.developedCharacters) {
      const tag = c.isNew ? '（新規）' : '（既存）';
      parts.push(`- ${c.name}${tag}: ${c.role}`);
      if (c.description) parts.push(`  背景: ${c.description}`);
      if (c.voice) parts.push(`  口調: ${c.voice}`);
    }
    parts.push('');
  }

  parts.push(`## ${chapter.title}（第${chapter.index}章）`);
  parts.push(`概要: ${chapter.summary}`);
  parts.push('');
  parts.push('### キーイベント');
  for (const event of chapter.key_events) {
    parts.push(`- ${event}`);
  }
  parts.push('');

  // Inject character MacGuffins as surface signs
  if (input.characterMacGuffins && input.characterMacGuffins.length > 0) {
    parts.push('## キャラクターの秘密（表出サインとして描写に織り込むこと）');
    for (const m of input.characterMacGuffins) {
      parts.push(`- ${m.characterName}: ${m.surfaceSigns.join('、')}`);
    }
    parts.push('');
  }

  // Inject plot MacGuffins as tension questions
  if (input.plotMacGuffins && input.plotMacGuffins.length > 0) {
    parts.push('## 物語の謎（解決不要、雰囲気として漂わせること）');
    for (const m of input.plotMacGuffins) {
      parts.push(`- ${m.name}: ${m.tensionQuestions.join('、')}（${m.presenceHint}）`);
    }
    parts.push('');
  }

  // Variation constraints
  if (chapter.variation_constraints) {
    const vc = chapter.variation_constraints;
    parts.push('### バリエーション制約');
    parts.push(`- 構造型: ${vc.structure_type}`);
    parts.push(`- 感情曲線: ${vc.emotional_arc}`);
    parts.push(`- テンポ: ${vc.pacing}`);
    if (vc.deviation_from_previous) {
      parts.push(`- 前章との差分: ${vc.deviation_from_previous}`);
    }
    if (vc.motif_budget && vc.motif_budget.length > 0) {
      parts.push('- モチーフ使用上限:');
      for (const mb of vc.motif_budget) {
        parts.push(`  - 「${mb.motif}」: 最大${mb.max_uses}回`);
      }
    }
    parts.push('');
  }

  // Epistemic constraints
  if (chapter.epistemic_constraints && chapter.epistemic_constraints.length > 0) {
    parts.push('### 認識制約（epistemic constraints）');
    parts.push('この章の各視点キャラクターは以下を知らない/見ない。厳守すること:');
    for (const ec of chapter.epistemic_constraints) {
      parts.push(`- ${ec.perspective}: ${ec.constraints.join(' / ')}`);
    }
    parts.push('');
  }

  parts.push(`目標文字数: ${chapter.target_length}字`);
  parts.push('');
  parts.push('この章を執筆してください。');

  return parts.join('\n');
}
