import type { LLMClient, ToolDefinition, ToolCallResponse } from '../llm/types.js';
import { assertToolCallingClient, parseToolArguments } from '../llm/tooling.js';
import type { SoulText } from '../soul/manager.js';
import { GeneratedThemeSchema, type GeneratedTheme } from '../schemas/generated-theme.js';
import {
  EMOTION_CATALOG,
  TIMELINE_CATALOG,
  NARRATIVE_CATALOG,
  OPENING_CONSTRAINTS,
  IDEATION_STRATEGIES,
  CONCEPT_SEEDS,
  TONE_DIRECTIVES,
  pickRandom,
} from './diversity-catalog.js';
import { buildPrompt } from '../template/composer.js';

const SUBMIT_THEME_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_theme',
    description: '物語のテーマ構造を提出する',
    parameters: {
      type: 'object',
      properties: {
        emotion: { type: 'string' },
        timeline: { type: 'string' },
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              isNew: { type: 'boolean' },
              description: { type: 'string' },
            },
            required: ['name', 'isNew'],
            additionalProperties: false,
          },
        },
        premise: { type: 'string' },
        scene_types: { type: 'array', items: { type: 'string' } },
        narrative_type: { type: 'string' },
      },
      required: ['emotion', 'timeline', 'characters', 'premise', 'scene_types'],
      additionalProperties: false,
    },
    strict: true,
  },
};

export interface ThemeResult {
  theme: GeneratedTheme;
  tokensUsed: number;
}

interface WildIdeaResult {
  idea: string;
  tone: string;
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
   * Generate a random theme using two-stage ideation:
   * Stage 1: Generate a wild, unconstrained idea
   * Stage 2: Refine it into a structured GeneratedTheme
   */
  async generateTheme(recentThemes?: GeneratedTheme[], motifAvoidance?: string[]): Promise<ThemeResult> {
    const tokensBefore = this.llmClient.getTotalTokens();

    // Stage 1: Wild idea generation (minimal world context, high creativity)
    const wildIdeaResult = await this.generateWildIdea();

    // Stage 2: Refine into structured theme (full world context)
    const stage2Context = this.buildStage2Context(wildIdeaResult.idea, recentThemes, motifAvoidance);
    const { system: systemPrompt, user: userPrompt } = buildPrompt('theme-generator-stage2', stage2Context);

    assertToolCallingClient(this.llmClient);
    const response = await this.llmClient.completeWithTools(
      systemPrompt,
      userPrompt,
      [SUBMIT_THEME_TOOL],
      {
        toolChoice: { type: 'function', function: { name: 'submit_theme' } },
        temperature: 0.9,
      },
    );

    const theme = this.parseToolResponse(response);
    // Inject tone from Stage 1 into the generated theme
    theme.tone = wildIdeaResult.tone;
    const tokensAfter = this.llmClient.getTotalTokens();

    return {
      theme,
      tokensUsed: tokensAfter - tokensBefore,
    };
  }

  /**
   * Stage 1: Generate an unconstrained creative idea
   * Returns both the idea and the tone directive used
   */
  private async generateWildIdea(): Promise<WildIdeaResult> {
    const ideationStrategies = this.soulText.promptConfig?.ideation_strategies ?? IDEATION_STRATEGIES;
    const timelineCatalog = this.soulText.promptConfig?.timeline_catalog ?? TIMELINE_CATALOG;
    const strategy = pickRandom(ideationStrategies);
    const concept = pickRandom(CONCEPT_SEEDS);
    const emotion = pickRandom(EMOTION_CATALOG);
    const timeline = pickRandom(timelineCatalog);

    const worldDescription = this.soulText.promptConfig?.agents?.theme_generator?.world_description
      ?? 'AR/MRテクノロジーが浸透した近未来。無関心な社会。主要人物も無名の住人も存在する。';

    const toneDirectives = this.soulText.promptConfig?.tone_directives ?? TONE_DIRECTIVES;
    const tone = pickRandom(toneDirectives);

    const stage1Context = {
      strategy,
      concept,
      worldDescription,
      emotion,
      timeline,
      tone,
    };

    const { system: systemPrompt, user: userPrompt } = buildPrompt('theme-generator-stage1', stage1Context);

    const idea = await this.llmClient.complete(systemPrompt, userPrompt, {
      temperature: 1.0,
    });

    return { idea, tone };
  }

  private buildStage2Context(wildIdea: string, recentThemes?: GeneratedTheme[], motifAvoidance?: string[]): Record<string, unknown> {
    const worldBible = this.soulText.worldBible;
    const thematic = this.soulText.constitution.universal.thematic_constraints;
    const ctx: Record<string, unknown> = {};

    // Thematic constraints as array
    if (thematic.must_preserve.length > 0) {
      ctx.thematicConstraints = thematic.must_preserve;
    }

    // Characters as structured array
    if (Object.keys(worldBible.characters).length > 0) {
      ctx.characters = Object.entries(worldBible.characters).map(([name, char]) => ({
        name,
        role: char.role,
        description: char.description || '',
      }));
    }

    // Technology as structured array
    if (Object.keys(worldBible.technology).length > 0) {
      ctx.technologyEntries = Object.entries(worldBible.technology).map(([name, desc]) => {
        const description = typeof desc === 'object' && 'description' in desc
          ? (desc as { description: string }).description
          : String(desc);
        return { name, description };
      });
    }

    // Society as structured array
    if (Object.keys(worldBible.society).length > 0) {
      ctx.societyEntries = Object.entries(worldBible.society).map(([name, desc]) => {
        const state = typeof desc === 'object' && 'state' in desc
          ? (desc as { state: string }).state
          : String(desc);
        return { name, state };
      });
    }

    // Scene catalog as array
    const sceneCatalog = this.soulText.promptConfig?.scene_catalog ?? [
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

    // User prompt context
    const narrative = pickRandom(NARRATIVE_CATALOG);
    const opening = pickRandom(OPENING_CONSTRAINTS);
    ctx.wildIdea = wildIdea;
    ctx.narrative = narrative;
    ctx.opening = opening;

    // Motif avoidance: merge anti-soul clichés + DB-derived motifs
    const avoidanceItems: string[] = [];
    const arClicheEntries = this.soulText.antiSoul?.categories?.ar_reality_cliche;
    if (arClicheEntries && arClicheEntries.length > 0) {
      avoidanceItems.push(...arClicheEntries.map(e => e.reason));
    }
    if (motifAvoidance && motifAvoidance.length > 0) {
      avoidanceItems.push(...motifAvoidance);
    }
    if (avoidanceItems.length > 0) {
      ctx.motifAvoidanceList = avoidanceItems;
    }

    // History avoidance as structured array
    if (recentThemes && recentThemes.length > 0) {
      ctx.recentThemes = recentThemes.map(t => ({
        emotion: t.emotion,
        timeline: t.timeline,
        premise: t.premise,
      }));
    }

    return ctx;
  }

  private parseToolResponse(response: ToolCallResponse): GeneratedTheme {
    let parsed: unknown;
    try {
      parsed = parseToolArguments<GeneratedTheme>(response, 'submit_theme');
    } catch {
      throw new Error('Failed to parse tool call arguments');
    }

    // Validate with Zod schema
    const result = GeneratedThemeSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Theme validation failed: ${result.error.message}`);
    }

    return result.data;
  }
}
