import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { GeneratedThemeSchema, type GeneratedTheme } from '../schemas/generated-theme.js';
import {
  EMOTION_CATALOG,
  TIMELINE_CATALOG,
  NARRATIVE_CATALOG,
  OPENING_CONSTRAINTS,
  IDEATION_STRATEGIES,
  CONCEPT_SEEDS,
  TONE_CATALOG,
  pickRandom,
} from './diversity-catalog.js';
import { buildPrompt } from '../template/composer.js';

export interface ThemeResult {
  theme: GeneratedTheme;
  tokensUsed: number;
}

interface WildIdeaResult {
  idea: string;
  tone: string;
}

// --- FP interface ---

export interface ThemeGeneratorFn {
  generateTheme: (recentThemes?: GeneratedTheme[], motifAvoidance?: string[]) => Promise<ThemeResult>;
}

// --- Internal helpers ---

async function generateWildIdea(llmClient: LLMClient, soulText: SoulText): Promise<WildIdeaResult> {
  const ideationStrategies = soulText.promptConfig?.ideation_strategies ?? IDEATION_STRATEGIES;
  const timelineCatalog = soulText.promptConfig?.timeline_catalog ?? TIMELINE_CATALOG;
  const strategy = pickRandom(ideationStrategies);
  const concept = pickRandom(CONCEPT_SEEDS);
  const emotion = pickRandom(EMOTION_CATALOG);
  const timeline = pickRandom(timelineCatalog);

  const worldDescription = soulText.promptConfig?.agents?.theme_generator?.world_description
    ?? 'AR/MRテクノロジーが浸透した近未来。無関心な社会。主要人物も無名の住人も存在する。';

  // tone_catalog (structured) > tone_directives (legacy string[]) > TONE_CATALOG (hardcoded)
  const toneCatalog = soulText.promptConfig?.tone_catalog;
  const legacyToneDirectives = soulText.promptConfig?.tone_directives;

  let tone: string;
  if (toneCatalog && toneCatalog.length > 0) {
    tone = pickRandom(toneCatalog).directive;
  } else if (legacyToneDirectives && legacyToneDirectives.length > 0) {
    tone = pickRandom(legacyToneDirectives);
  } else {
    tone = pickRandom(TONE_CATALOG).directive;
  }

  const stage1Context = {
    strategy,
    concept,
    worldDescription,
    emotion,
    timeline,
    tone,
  };

  const { system: systemPrompt, user: userPrompt } = buildPrompt('theme-generator-stage1', stage1Context);

  const idea = await llmClient.complete(systemPrompt, userPrompt, {
    temperature: 1.0,
  });

  return { idea, tone };
}

function buildStage2Context(soulText: SoulText, wildIdea: string, recentThemes?: GeneratedTheme[], motifAvoidance?: string[]): Record<string, unknown> {
  const worldBible = soulText.worldBible;
  const thematic = soulText.constitution.universal.thematic_constraints;
  const ctx: Record<string, unknown> = {};

  if (thematic.must_preserve.length > 0) {
    ctx.thematicConstraints = thematic.must_preserve;
  }

  if (Object.keys(worldBible.characters).length > 0) {
    ctx.characters = Object.entries(worldBible.characters).map(([name, char]) => ({
      name,
      role: char.role,
      description: char.description || '',
    }));
  }

  if (Object.keys(worldBible.technology).length > 0) {
    ctx.technologyEntries = Object.entries(worldBible.technology).map(([name, desc]) => {
      const description = typeof desc === 'object' && 'description' in desc
        ? (desc as { description: string }).description
        : String(desc);
      return { name, description };
    });
  }

  if (Object.keys(worldBible.society).length > 0) {
    ctx.societyEntries = Object.entries(worldBible.society).map(([name, desc]) => {
      const state = typeof desc === 'object' && 'state' in desc
        ? (desc as { state: string }).state
        : String(desc);
      return { name, state };
    });
  }

  const sceneCatalog = soulText.promptConfig?.scene_catalog ?? [
    '教室での内面描写',
    '屋上での非公式な対話',
    '名前消去事件（ARタグの操作に関する出来事）',
    '日常観察（他者を静かに観察するシーン）',
    'MRフロアでの仮想体験',
    'セッション後の反芻（体験後の内省）',
    '通学路・移動（物理空間での孤独）',
    'デジタル空間探索（ARシステムの裏側）',
    '他者との表面的交流',
    '記憶・回想（過去の断片）',
  ];
  ctx.sceneCatalog = sceneCatalog;

  const narrative = pickRandom(NARRATIVE_CATALOG);
  const opening = pickRandom(OPENING_CONSTRAINTS);
  ctx.wildIdea = wildIdea;
  ctx.narrative = narrative;
  ctx.opening = opening;

  const avoidanceItems: string[] = [];
  const arClicheEntries = soulText.antiSoul?.categories?.ar_reality_cliche;
  if (arClicheEntries && arClicheEntries.length > 0) {
    avoidanceItems.push(...arClicheEntries.map(e => e.reason));
  }
  if (motifAvoidance && motifAvoidance.length > 0) {
    avoidanceItems.push(...motifAvoidance);
  }
  if (avoidanceItems.length > 0) {
    ctx.motifAvoidanceList = avoidanceItems;
  }

  if (recentThemes && recentThemes.length > 0) {
    ctx.recentThemes = recentThemes.map(t => ({
      emotion: t.emotion,
      timeline: t.timeline,
      premise: t.premise,
    }));
  }

  return ctx;
}

// --- Factory function ---

export function createThemeGenerator(llmClient: LLMClient, soulText: SoulText): ThemeGeneratorFn {
  return {
    generateTheme: async (recentThemes?: GeneratedTheme[], motifAvoidance?: string[]): Promise<ThemeResult> => {
      const tokensBefore = llmClient.getTotalTokens();

      const wildIdeaResult = await generateWildIdea(llmClient, soulText);

      const stage2Context = buildStage2Context(soulText, wildIdeaResult.idea, recentThemes, motifAvoidance);
      const { system: systemPrompt, user: userPrompt } = buildPrompt('theme-generator-stage2', stage2Context);

      const response = await llmClient.completeStructured!(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        GeneratedThemeSchema,
        { temperature: 1.0 },
      );

      const theme = response.data;
      theme.tone = wildIdeaResult.tone;
      const tokensAfter = llmClient.getTotalTokens();

      return {
        theme,
        tokensUsed: tokensAfter - tokensBefore,
      };
    },
  };
}

