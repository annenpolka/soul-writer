import type { Chapter, Plot, VariationAxis } from '../schemas/plot.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import type { EnrichedCharacter } from '../factory/character-enricher.js';
import type { CharacterMacGuffin, PlotMacGuffin } from '../schemas/macguffin.js';
import type { PreviousChapterAnalysis, EstablishedInsight } from './chapter-summary.js';
import type { CrossChapterState } from '../agents/types.js';
import { buildTemplateBlock } from '../template/composer.js';

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
  /** Tone directive for consistent writing style */
  toneDirective?: string;
  /** Cross-chapter state for character continuity and motif wear tracking */
  crossChapterState?: CrossChapterState;
  /** Variation axis for this chapter's dramatic curve */
  variationAxis?: VariationAxis;
}

/**
 * Build a prompt for chapter generation.
 * Pure function — no side effects, no external state.
 */
export function buildChapterPrompt(input: ChapterPromptInput): string {
  const { chapter, plot } = input;
  const parts: string[] = [];
  const t = (templateKey: string, context: Record<string, unknown> = {}): string =>
    buildTemplateBlock('pipeline', 'chapter-generation', templateKey, context);

  parts.push(t('title', { plot }));
  parts.push(t('theme', { plot }));
  if (input.toneDirective) {
    parts.push(t('toneDirective', { toneDirective: input.toneDirective }));
  }
  parts.push('');

  // Inject narrative rules
  if (input.narrativeType && input.narrativeRules) {
    parts.push(t('narrativeHeading'));
    parts.push(t('narrativeType', { narrativeType: input.narrativeType }));
    parts.push(t('narrativePovDescription', { narrativeRules: input.narrativeRules }));
    parts.push('');
  }

  // Inject developed characters
  if (input.developedCharacters && input.developedCharacters.length > 0) {
    parts.push(t('developedCharactersHeading'));
    for (const c of input.developedCharacters) {
      const tag = c.isNew ? '（新規）' : '（既存）';
      parts.push(t('developedCharacterLine', { character: c, characterTag: tag }));
      if (c.description) parts.push(t('developedCharacterBackground', { character: c }));
      if (c.voice) parts.push(t('developedCharacterVoice', { character: c }));
    }
    parts.push('');
  }

  // Inject enriched character physicality and stance
  if (input.enrichedCharacters && input.enrichedCharacters.length > 0) {
    parts.push(t('enrichedCharactersHeading'));
    for (const c of input.enrichedCharacters) {
      parts.push(t('enrichedCharacterHeading', { character: c }));
      parts.push(t('enrichedCharacterPhysicalHabitsLabel'));
      for (const h of c.physicalHabits) {
        parts.push(t('enrichedCharacterPhysicalHabitLine', { habit: h }));
      }
      parts.push(t('enrichedCharacterStance', { character: c }));
      parts.push(t('enrichedCharacterBlindSpot', { character: c }));
      if ('dialogueSamples' in c && c.dialogueSamples && c.dialogueSamples.length > 0) {
        parts.push(t('enrichedCharacterDialogueSamplesLabel'));
        for (const s of c.dialogueSamples) {
          parts.push(t('enrichedCharacterDialogueSampleLine', { dialogue: s }));
        }
      }
    }
    parts.push('');
  }

  parts.push(t('chapterHeading', { chapter }));
  parts.push(t('chapterSummary', { chapter }));
  parts.push('');
  parts.push(t('keyEventsHeading'));
  for (const keyEvent of chapter.key_events) {
    parts.push(t('keyEventItem', { keyEvent }));
  }
  parts.push('');

  // Inject character MacGuffins as surface signs
  if (input.characterMacGuffins && input.characterMacGuffins.length > 0) {
    parts.push(t('characterMacGuffinsHeading'));
    for (const characterMacGuffin of input.characterMacGuffins) {
      parts.push(t('characterMacGuffinItem', { characterMacGuffin }));
    }
    parts.push('');
  }

  // Inject plot MacGuffins as tension questions
  if (input.plotMacGuffins && input.plotMacGuffins.length > 0) {
    parts.push(t('plotMacGuffinsHeading'));
    for (const plotMacGuffin of input.plotMacGuffins) {
      parts.push(t('plotMacGuffinItem', { plotMacGuffin }));
    }
    parts.push('');
  }

  // Previous chapter analysis
  if (input.previousChapterAnalysis) {
    const previousChapterAnalysis = input.previousChapterAnalysis;
    parts.push(t('previousChapterHeading'));
    parts.push(t('previousChapterSummaryHeading'));
    parts.push(previousChapterAnalysis.storySummary);
    parts.push('');
    parts.push(t('previousChapterAvoidanceHeading'));
    parts.push(t('previousChapterEmotionalBeats', { previousChapterAnalysis }));
    parts.push(t('previousChapterDominantImagery', { previousChapterAnalysis }));
    parts.push(t('previousChapterRhythmProfile', { previousChapterAnalysis }));
    parts.push(t('previousChapterStructuralPattern', { previousChapterAnalysis }));
    parts.push(t('previousChapterAvoidanceInstruction'));
    parts.push('');
  }

  // Drama blueprint context
  if (plot.drama_blueprint) {
    parts.push(t('dramaBlueprintHeading'));
    parts.push(t('dramaBlueprintStructureType', { plot }));
    if (plot.turning_point) parts.push(t('dramaBlueprintTurningPoint', { plot }));
    if (plot.stakes_description) parts.push(t('dramaBlueprintStakes', { plot }));
    if (plot.protagonist_choice) parts.push(t('dramaBlueprintProtagonistChoice', { plot }));
    if (plot.point_of_no_return) parts.push(t('dramaBlueprintPointOfNoReturn', { plot }));
    parts.push('');
  }

  // Motif avoidance
  if (input.motifAvoidanceList && input.motifAvoidanceList.length > 0) {
    parts.push(t('motifAvoidanceHeading'));
    for (const motif of input.motifAvoidanceList) {
      parts.push(t('motifAvoidanceItem', { motif }));
    }
    parts.push('');
  }

  // Decision point (decisive action)
  if (chapter.decision_point) {
    parts.push(t('decisionPointHeading'));
    parts.push(t('decisionPointAction', { chapter }));
    parts.push(t('decisionPointStakes', { chapter }));
    parts.push(t('decisionPointIrreversibility', { chapter }));
    parts.push(t('decisionPointInstruction'));
    parts.push('');
  }

  // Dramaturgy and arc role
  if (chapter.dramaturgy) {
    parts.push(t('dramaturgyHeading'));
    parts.push(chapter.dramaturgy);
    parts.push('');
  }
  if (chapter.arc_role) {
    parts.push(t('arcRoleHeading'));
    parts.push(chapter.arc_role);
    parts.push('');
  }

  // Variation constraints
  if (chapter.variation_constraints) {
    const variationConstraints = chapter.variation_constraints;
    parts.push(t('variationConstraintsHeading'));
    parts.push(t('variationStructureType', { variationConstraints }));
    parts.push(t('variationEmotionalArc', { variationConstraints }));
    parts.push(t('variationPacing', { variationConstraints }));
    if (variationConstraints.deviation_from_previous) {
      parts.push(t('variationDeviation', { variationConstraints }));
    }
    if (variationConstraints.motif_budget && variationConstraints.motif_budget.length > 0) {
      parts.push(t('variationMotifBudgetHeading'));
      for (const motifBudget of variationConstraints.motif_budget) {
        parts.push(t('variationMotifBudgetItem', { motifBudget }));
      }
    }
    if (variationConstraints.emotional_beats && variationConstraints.emotional_beats.length > 0) {
      parts.push(t('variationEmotionalBeats', { variationConstraints }));
    }
    if (variationConstraints.forbidden_patterns && variationConstraints.forbidden_patterns.length > 0) {
      parts.push(t('variationForbiddenPatternsHeading'));
      for (const forbiddenPattern of variationConstraints.forbidden_patterns) {
        parts.push(t('variationForbiddenPatternItem', { forbiddenPattern }));
      }
    }
    parts.push('');
  }

  // Epistemic constraints
  if (chapter.epistemic_constraints && chapter.epistemic_constraints.length > 0) {
    parts.push(t('epistemicConstraintsHeading'));
    parts.push(t('epistemicConstraintsInstruction'));
    for (const epistemicConstraint of chapter.epistemic_constraints) {
      parts.push(t('epistemicConstraintItem', { epistemicConstraint }));
    }
    parts.push('');
  }

  // WS4: Established insights (cumulative "known" list)
  if (input.establishedInsights && input.establishedInsights.length > 0) {
    parts.push(t('establishedInsightsHeading'));
    for (const establishedInsight of input.establishedInsights) {
      parts.push(t('establishedInsightItem', { establishedInsight }));
    }
    parts.push(t('establishedInsightsInstruction'));
    parts.push('');
  }

  // WS5: Chapter-level theme control
  if (chapter.emotion_surface || chapter.emotion_subtext || chapter.thematic_insight !== undefined) {
    parts.push(t('themeControlHeading'));
    if (chapter.emotion_surface) {
      parts.push(t('themeControlSurface', { chapter }));
    }
    if (chapter.emotion_subtext) {
      parts.push(t('themeControlSubtext', { chapter }));
    }
    if (chapter.thematic_insight === null) {
      parts.push(t('themeControlNoInsight'));
    } else if (chapter.thematic_insight) {
      parts.push(t('themeControlInsight', { chapter }));
    }
    parts.push('');
  }

  // Cross-chapter character state continuity
  if (input.crossChapterState && input.crossChapterState.characterStates.length > 0) {
    parts.push(t('crossChapterCharacterStatesHeading'));
    parts.push(t('crossChapterCharacterStatesInstruction'));
    for (const characterState of input.crossChapterState.characterStates) {
      const physicalStateSegment = characterState.physicalState
        ? t('crossChapterCharacterStatePhysicalSegment', { characterState })
        : '';
      const relationshipChangesSegment = characterState.relationshipChanges.length > 0
        ? t('crossChapterCharacterStateRelationshipSegment', { characterState })
        : '';
      parts.push(t('crossChapterCharacterStateLine', {
        characterState,
        physicalStateSegment,
        relationshipChangesSegment,
      }));
    }
    parts.push('');
  }

  // Motif budget display — all motif wear entries with 3-time budget
  if (input.crossChapterState && input.crossChapterState.motifWear.length > 0) {
    parts.push(t('motifWearHeading'));
    parts.push(t('motifWearInstruction'));
    for (const motifWear of input.crossChapterState.motifWear) {
      const remainingUses = Math.max(0, 3 - motifWear.usageCount);
      if (remainingUses === 0) {
        parts.push(t('motifWearLineForbidden', { motifWear }));
      } else if (remainingUses === 1) {
        parts.push(t('motifWearLineClimax', { motifWear }));
      } else {
        parts.push(t('motifWearLineRemaining', { motifWear, remainingUses }));
      }
    }
    parts.push('');
  }

  // Variation axis
  if (input.variationAxis) {
    parts.push(t('variationAxisHeading'));
    parts.push(t('variationAxisCurveType', { variationAxis: input.variationAxis }));
    parts.push(t('variationAxisIntensity', { variationAxis: input.variationAxis }));
    parts.push(t('variationAxisTechnique', { variationAxis: input.variationAxis }));
    if (input.variationAxis.internal_beats && input.variationAxis.internal_beats.length > 0) {
      parts.push(t('variationAxisInternalBeats', { variationAxis: input.variationAxis }));
    }
    parts.push('');
  }

  parts.push(t('targetLength', { chapter }));
  parts.push('');
  parts.push(t('finalInstruction'));

  return parts.join('\n');
}
