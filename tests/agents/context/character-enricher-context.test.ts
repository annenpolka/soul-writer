import { describe, it, expect } from 'vitest';
import { buildPhase1Context, buildPhase2Context } from '../../../src/agents/context/character-enricher-context.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import type { DevelopedCharacter } from '../../../src/factory/character-developer.js';
import type { GeneratedTheme } from '../../../src/schemas/generated-theme.js';
import type { Plot } from '../../../src/schemas/plot.js';
import type { EnrichedCharacterPhase1 } from '../../../src/factory/character-enricher.js';

const sampleTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [{ name: '佐々木', isNew: true }],
  premise: 'テスト用前提',
  scene_types: ['対話'],
  tone: '冷徹',
};

const sampleDeveloped: DevelopedCharacter[] = [
  {
    name: '佐々木',
    isNew: true,
    role: '対話相手',
    description: '穏健タグの偽造者。外見は温和だが内面に過失を抱える',
    voice: '丁寧語、語尾に「ですね」が多い',
  },
];

const samplePlot: Plot = {
  chapters: [
    {
      number: 1,
      title: 'テスト章',
      summary: '佐々木と透心が出会う',
      keyEvents: ['出会い', '対話'],
      targetLength: 4000,
    },
  ],
};

const sampleDynamics = {
  innerWound: '幼少期の見捨てられ体験による存在不安',
  craving: '他者の人生に取り返しのつかない痕跡を残すこと',
  surfaceContradiction: '温和な表層と破壊的な渇望の乖離',
  distortedFulfillment: '偽造タグで他者の記録を書き換える行為で存在証明を得る',
  fulfillmentCondition: '偽造した情報が他者の行動を実際に変えた瞬間',
  relationshipAsymmetry: '一方的に他者の記録を操作する立場に固執する',
};

const samplePhase1Chars: EnrichedCharacterPhase1[] = [
  {
    ...sampleDeveloped[0],
    physicalHabits: [
      { habit: '左手で右肘を掴む', trigger: '目が合うとき', sensoryDetail: '指が白くなる' },
    ],
    stance: { type: 'oblique', manifestation: '笑いに変える', blindSpot: '自分の関与' },
    dynamics: sampleDynamics,
  },
];

describe('buildPhase1Context', () => {
  it('should return a context object with character info for habit generation', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase1Context({
      soulText,
      characters: sampleDeveloped,
      theme: sampleTheme,
    });
    expect(ctx).toBeDefined();
    expect(typeof ctx).toBe('object');
  });

  it('should include character names and roles', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase1Context({
      soulText,
      characters: sampleDeveloped,
      theme: sampleTheme,
    });
    expect(ctx.characters).toBeDefined();
    const chars = ctx.characters as Array<{ name: string; role: string }>;
    expect(chars[0].name).toBe('佐々木');
    expect(chars[0].role).toBe('対話相手');
  });

  it('should include theme info for stance generation', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase1Context({
      soulText,
      characters: sampleDeveloped,
      theme: sampleTheme,
    });
    expect(ctx.themeEmotion).toBe('孤独');
    expect(ctx.themePremise).toBe('テスト用前提');
  });

  it('should be a pure function (no side effects)', () => {
    const soulText = createMockSoulText();
    const input = { soulText, characters: [...sampleDeveloped], theme: { ...sampleTheme } };
    const ctx1 = buildPhase1Context(input);
    const ctx2 = buildPhase1Context(input);
    expect(ctx1).toEqual(ctx2);
    // Original input unchanged
    expect(input.characters).toEqual(sampleDeveloped);
  });
});

describe('buildPhase2Context', () => {
  it('should return a context object with plot and character info', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase2Context({
      soulText,
      characters: samplePhase1Chars,
      plot: samplePlot,
      theme: sampleTheme,
    });
    expect(ctx).toBeDefined();
    expect(typeof ctx).toBe('object');
  });

  it('should include character voice, stance, and habits', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase2Context({
      soulText,
      characters: samplePhase1Chars,
      plot: samplePlot,
      theme: sampleTheme,
    });
    const chars = ctx.characters as Array<{ name: string; voice: string; stanceType: string }>;
    expect(chars[0].voice).toContain('丁寧語');
    expect(chars[0].stanceType).toBe('oblique');
  });

  it('should include plot summary for context', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase2Context({
      soulText,
      characters: samplePhase1Chars,
      plot: samplePlot,
      theme: sampleTheme,
    });
    expect(ctx.plotSummary).toBeDefined();
  });

  it('should include dynamics in character list', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase2Context({
      soulText,
      characters: samplePhase1Chars,
      plot: samplePlot,
      theme: sampleTheme,
    });
    const chars = ctx.characters as Array<{ name: string; craving: string; distortedFulfillment: string }>;
    expect(chars[0].craving).toContain('痕跡');
    expect(chars[0].distortedFulfillment).toContain('偽造');
  });

  it('should be a pure function (no side effects)', () => {
    const soulText = createMockSoulText();
    const input = {
      soulText,
      characters: [...samplePhase1Chars],
      plot: { ...samplePlot },
      theme: { ...sampleTheme },
    };
    const ctx1 = buildPhase2Context(input);
    const ctx2 = buildPhase2Context(input);
    expect(ctx1).toEqual(ctx2);
  });
});

describe('buildPhase1Context with MacGuffins', () => {
  it('should include characterMacGuffins when provided', () => {
    const soulText = createMockSoulText();
    const macGuffins = [
      { characterName: '佐々木', secret: '火災の原因を知っている', surfaceSigns: ['手が震える', '目を逸らす'], narrativeFunction: '物語後半での告白シーンの伏線' },
    ];
    const ctx = buildPhase1Context({
      soulText,
      characters: sampleDeveloped,
      theme: sampleTheme,
      macGuffins,
    });
    expect(ctx.characterMacGuffins).toBeDefined();
    const mgs = ctx.characterMacGuffins as Array<{ characterName: string; secret: string }>;
    expect(mgs[0].characterName).toBe('佐々木');
    expect(mgs[0].secret).toBe('火災の原因を知っている');
  });

  it('should return empty characterMacGuffins when not provided', () => {
    const soulText = createMockSoulText();
    const ctx = buildPhase1Context({
      soulText,
      characters: sampleDeveloped,
      theme: sampleTheme,
    });
    const mgs = ctx.characterMacGuffins as Array<unknown>;
    expect(mgs).toEqual([]);
  });
});
