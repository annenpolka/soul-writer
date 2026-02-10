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

const samplePhase1Chars: EnrichedCharacterPhase1[] = [
  {
    ...sampleDeveloped[0],
    physicalHabits: [
      { habit: '左手で右肘を掴む', trigger: '目が合うとき', sensoryDetail: '指が白くなる' },
    ],
    stance: { type: 'oblique', manifestation: '笑いに変える', blindSpot: '自分の関与' },
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
