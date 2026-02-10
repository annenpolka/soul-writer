import type { SoulText } from '../../soul/manager.js';
import type { PlotterConfig } from '../types.js';
import type { PlotSkeleton } from '../../schemas/plot.js';

/**
 * Input for buildPlotterContext
 */
export interface PlotterContextInput {
  soulText: SoulText;
  config: PlotterConfig;
}

/**
 * Build the full template context for a plotter prompt (pure function).
 */
export function buildPlotterContext(input: PlotterContextInput): Record<string, unknown> {
  const { soulText, config } = input;
  const thematic = soulText.constitution.universal.thematic_constraints;
  const ctx: Record<string, unknown> = {};

  // Thematic constraints
  if (thematic.must_preserve.length > 0) {
    ctx.thematicMustPreserve = thematic.must_preserve;
  }

  // Characters - enriched > developed > world-bible fallback
  if (config.enrichedCharacters && config.enrichedCharacters.length > 0) {
    ctx.developedCharacters = config.enrichedCharacters.map(c => ({
      ...c,
      tag: c.isNew ? '（新規）' : '（既存）',
      descriptionLine: c.description ? `\n  背景: ${c.description}` : '',
    }));
    ctx.enrichedCharacterStances = config.enrichedCharacters.map(c => ({
      name: c.name,
      stanceType: c.stance.type,
      stanceManifestation: c.stance.manifestation,
      stanceBlindSpot: c.stance.blindSpot,
    }));
  } else if (config.developedCharacters && config.developedCharacters.length > 0) {
    ctx.developedCharacters = config.developedCharacters.map(c => ({
      ...c,
      tag: c.isNew ? '（新規）' : '（既存）',
      descriptionLine: c.description ? `\n  背景: ${c.description}` : '',
    }));
  } else {
    const characters = soulText.worldBible.characters;
    if (Object.keys(characters).length > 0) {
      ctx.worldBibleCharacters = Object.entries(characters).map(
        ([name, char]) => ({ name, role: char.role, description: char.description || '' }),
      );
    }
  }

  // Technology
  const tech = soulText.worldBible.technology;
  if (Object.keys(tech).length > 0) {
    ctx.technologyEntries = Object.entries(tech).map(
      ([name, desc]) => ({ name, description: String(desc) }),
    );
  }

  // Theme info (structured)
  if (config.theme) {
    const t = config.theme;
    ctx.themeInfo = {
      emotion: t.emotion,
      timeline: t.timeline,
      premise: t.premise,
      tone: t.tone,
      characters: t.characters.map(c => ({
        name: c.name,
        tag: c.isNew ? '（新規）' : '',
        descSuffix: c.description ? `: ${c.description}` : '',
      })),
      scene_types: t.scene_types,
      narrative_type: t.narrative_type,
    };
  }

  // MacGuffins
  if (config.plotMacGuffins && config.plotMacGuffins.length > 0) {
    ctx.plotMacGuffins = config.plotMacGuffins.map(m => ({
      name: m.name,
      surface: m.surfaceAppearance,
      questions: m.tensionQuestions.join('、'),
      hint: m.presenceHint,
    }));
  }
  if (config.characterMacGuffins && config.characterMacGuffins.length > 0) {
    ctx.characterMacGuffins = config.characterMacGuffins.map(m => ({
      name: m.characterName,
      secret: m.secret,
      signs: m.surfaceSigns.join('、'),
    }));
  }

  // Motif avoidance list
  if (config.motifAvoidanceList && config.motifAvoidanceList.length > 0) {
    ctx.motifAvoidanceList = config.motifAvoidanceList;
  }

  ctx.chapterInstruction = `${config.chapterCount}章構成の物語を設計してください。\n総文字数の目安: ${config.targetTotalLength}字`;

  return ctx;
}

/**
 * Input for buildChapterConstraintContext
 */
export interface ChapterConstraintContextInput {
  skeleton: PlotSkeleton;
  config: PlotterConfig;
}

/**
 * Build the template context for chapter constraints generation (Phase 2).
 */
export function buildChapterConstraintContext(input: ChapterConstraintContextInput): Record<string, unknown> {
  const { skeleton, config } = input;
  return {
    plotTitle: skeleton.title,
    plotTheme: skeleton.theme,
    chapters: skeleton.chapters.map(ch => ({
      index: ch.index,
      title: ch.title,
      summary: ch.summary,
      key_events: ch.key_events.join('、'),
    })),
    chapterCount: config.chapterCount,
    narrativeType: config.theme?.narrative_type ?? '一人称内面独白',
  };
}
