import type { Chapter, Plot } from '../schemas/plot.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import type { EnrichedCharacter } from '../factory/character-enricher.js';
import type { CharacterMacGuffin, PlotMacGuffin } from '../schemas/macguffin.js';
import type { PreviousChapterAnalysis, EstablishedInsight } from './chapter-summary.js';

export interface ChapterPromptInput {
  chapter: Chapter;
  plot: Plot;
  narrativeType?: string;
  narrativeRules?: NarrativeRules;
  developedCharacters?: DevelopedCharacter[];
  enrichedCharacters?: EnrichedCharacter[];
  characterMacGuffins?: CharacterMacGuffin[];
  plotMacGuffins?: PlotMacGuffin[];
  previousChapterAnalysis?: PreviousChapterAnalysis;
  /** Motif avoidance list from past works analysis */
  motifAvoidanceList?: string[];
  /** Cumulative established insights from previous chapters (WS4) */
  establishedInsights?: EstablishedInsight[];
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

  // Inject enriched character physicality and stance
  if (input.enrichedCharacters && input.enrichedCharacters.length > 0) {
    parts.push('## キャラクターの身体性と態度');
    for (const c of input.enrichedCharacters) {
      parts.push(`### ${c.name}`);
      parts.push('身体の癖:');
      for (const h of c.physicalHabits) {
        parts.push(`  - ${h.habit}（${h.trigger}、${h.sensoryDetail}）`);
      }
      parts.push(`テーマへの態度: ${c.stance.type}（${c.stance.manifestation}）`);
      parts.push(`盲点: ${c.stance.blindSpot}`);
      if ('dialogueSamples' in c && c.dialogueSamples && c.dialogueSamples.length > 0) {
        parts.push('台詞サンプル（コピー禁止、声の質感を吸収すること）:');
        for (const s of c.dialogueSamples) {
          parts.push(`  - 「${s.line}」（${s.situation}）— ${s.voiceNote}`);
        }
      }
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

  // Previous chapter analysis
  if (input.previousChapterAnalysis) {
    const pca = input.previousChapterAnalysis;
    parts.push('## 前章からの接続と変奏');
    parts.push('### 前章の概要');
    parts.push(pca.storySummary);
    parts.push('');
    parts.push('### この章で避けるべきパターン（前章で使用済み）');
    parts.push(`- 感情遷移: ${pca.avoidanceDirective.emotionalBeats.join(' → ')}`);
    parts.push(`- 支配的イメージ: ${pca.avoidanceDirective.dominantImagery.join('、')}`);
    parts.push(`- リズム: ${pca.avoidanceDirective.rhythmProfile}`);
    parts.push(`- 構造: ${pca.avoidanceDirective.structuralPattern}`);
    parts.push('上記と異なるアプローチで執筆すること。');
    parts.push('');
  }

  // Drama blueprint context
  if (plot.drama_blueprint) {
    parts.push('### ドラマブループリント');
    parts.push(`- 構造型: ${plot.drama_blueprint}`);
    if (plot.turning_point) parts.push(`- 転機: ${plot.turning_point}`);
    if (plot.stakes_description) parts.push(`- 賭け金: ${plot.stakes_description}`);
    if (plot.protagonist_choice) parts.push(`- 主人公の選択: ${plot.protagonist_choice}`);
    if (plot.point_of_no_return) parts.push(`- 引き返せないポイント: ${plot.point_of_no_return}`);
    parts.push('');
  }

  // Motif avoidance
  if (input.motifAvoidanceList && input.motifAvoidanceList.length > 0) {
    parts.push('### 回避すべきモチーフ（過去作品で頻出のため使用禁止）');
    for (const motif of input.motifAvoidanceList) {
      parts.push(`- ${motif}`);
    }
    parts.push('');
  }

  // Decision point (decisive action)
  if (chapter.decision_point) {
    parts.push(`### この章の決定的行動`);
    parts.push(`行動: ${chapter.decision_point.action}`);
    parts.push(`賭け金: ${chapter.decision_point.stakes}`);
    parts.push(`不可逆な変化: ${chapter.decision_point.irreversibility}`);
    parts.push(`この行動を必ず物語に組み込むこと。`);
    parts.push('');
  }

  // Dramaturgy and arc role
  if (chapter.dramaturgy) {
    parts.push(`### ドラマトゥルギー（起動装置）`);
    parts.push(chapter.dramaturgy);
    parts.push('');
  }
  if (chapter.arc_role) {
    parts.push(`### 物語的機能`);
    parts.push(chapter.arc_role);
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
    if (vc.emotional_beats && vc.emotional_beats.length > 0) {
      parts.push(`- 感情ビート（この順序で遷移させること）: ${vc.emotional_beats.join(' → ')}`);
    }
    if (vc.forbidden_patterns && vc.forbidden_patterns.length > 0) {
      parts.push('- 禁止パターン（以下は使用禁止）:');
      for (const fp of vc.forbidden_patterns) {
        parts.push(`  - ${fp}`);
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

  // WS4: Established insights (cumulative "known" list)
  if (input.establishedInsights && input.establishedInsights.length > 0) {
    parts.push('## この物語で既に確立された認識（再発見禁止）');
    for (const insight of input.establishedInsights) {
      parts.push(`- Ch${insight.chapter}: ${insight.insight} → ${insight.rule}`);
    }
    parts.push('上記の認識は既に確立済み。再度「発見」させたり「気づき」として描いてはいけない。');
    parts.push('');
  }

  // WS5: Chapter-level theme control
  if (chapter.emotion_surface || chapter.emotion_subtext || chapter.thematic_insight !== undefined) {
    parts.push('## この章のテーマ制御');
    if (chapter.emotion_surface) {
      parts.push(`表層感情: ${chapter.emotion_surface}`);
    }
    if (chapter.emotion_subtext) {
      parts.push(`底流（描写しない、動作で暗示のみ）: ${chapter.emotion_subtext}`);
    }
    if (chapter.thematic_insight === null) {
      parts.push('テーマ的認識: ★この章では認識に到達しない★ 疑問を提示するだけに留めること。');
    } else if (chapter.thematic_insight) {
      parts.push(`テーマ的認識: この章で到達する認識 → 「${chapter.thematic_insight}」`);
    }
    parts.push('');
  }

  parts.push(`目標文字数: ${chapter.target_length}字`);
  parts.push('');
  parts.push('この章を執筆してください。');

  return parts.join('\n');
}
