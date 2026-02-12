import { describe, it, expect } from 'vitest';
import { createCharacterEnricher, type CharacterEnricherFn, EnrichedCharacterPhase1Schema, EnrichedCharacterSchema } from '../../src/factory/character-enricher.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { GeneratedTheme } from '../../src/schemas/generated-theme.js';
import type { DevelopedCharacter } from '../../src/factory/character-developer.js';
import type { Plot } from '../../src/schemas/plot.js';

const sampleTheme: GeneratedTheme = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [
    { name: '佐々木', isNew: true, description: '穏健タグの偽造者' },
  ],
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
    voice: '丁寧語、語尾に「ですね」が多い、感情を押し殺す',
  },
];

const samplePlot: Plot = {
  title: 'テスト物語',
  theme: '孤独',
  chapters: [
    {
      index: 1,
      title: 'テスト章',
      summary: '佐々木と透心が出会う',
      key_events: ['出会い', '対話'],
      target_length: 4000,
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

const validPhase1Response = {
  characters: [
    {
      name: '佐々木',
      physicalHabits: [
        {
          habit: '話すとき必ず左手で右肘を掴む',
          trigger: '相手と目が合うとき',
          sensoryDetail: '指が白くなるほど強く',
        },
        {
          habit: '相手の靴を先に見る',
          trigger: '初対面のとき',
          sensoryDetail: '視線がゆっくり上がっていく',
        },
      ],
      stance: {
        type: 'oblique',
        manifestation: 'テーマの深刻さを認識しつつ、笑いに変える',
        blindSpot: '自分の関与について決して言及しない',
      },
      dynamics: sampleDynamics,
    },
  ],
};

const validPhase2Response = {
  characters: [
    {
      name: '佐々木',
      dialogueSamples: [
        {
          line: '今日は天気がいいですね',
          situation: '朝の教室で窓の外を見ながら',
          voiceNote: '日常的な発言、テーマ無関係',
        },
        {
          line: 'まあ、そういうこともあるんじゃないですか',
          situation: 'タグの話題が出たとき',
          voiceNote: '斜めの態度、深刻さを笑いに変える',
        },
        {
          line: 'コーヒー、砂糖は三つでお願いします',
          situation: '休憩中の何気ない注文',
          voiceNote: '日常的な発言、テーマ無関係',
        },
      ],
    },
  ],
};

describe('createCharacterEnricher (FP)', () => {
  it('should return a CharacterEnricherFn with enrichPhase1 and enrichPhase2 methods', () => {
    const llm = createMockLLMClientWithTools({
      name: 'submit_character_enrichment',
      arguments: validPhase1Response,
    });
    const soulText = createMockSoulText();
    const fn: CharacterEnricherFn = createCharacterEnricher(llm, soulText);
    expect(typeof fn.enrichPhase1).toBe('function');
    expect(typeof fn.enrichPhase2).toBe('function');
  });

  describe('Phase 1: stance + physical habits', () => {
    it('should enrich DevelopedCharacters with physicalHabits and stance', async () => {
      const llm = createMockLLMClientWithTools({
        name: 'submit_character_enrichment',
        arguments: validPhase1Response,
      });
      const soulText = createMockSoulText();
      const fn = createCharacterEnricher(llm, soulText);
      const result = await fn.enrichPhase1(sampleDeveloped, sampleTheme);

      expect(result.characters).toHaveLength(1);
      const char = result.characters[0];
      expect(char.name).toBe('佐々木');
      expect(char.isNew).toBe(true);
      expect(char.role).toBe('対話相手');
      expect(char.description).toBe(sampleDeveloped[0].description);
      expect(char.voice).toBe(sampleDeveloped[0].voice);
      expect(char.physicalHabits).toHaveLength(2);
      expect(char.physicalHabits[0].habit).toBe('話すとき必ず左手で右肘を掴む');
      expect(char.stance.type).toBe('oblique');
      expect(char.stance.manifestation).toContain('笑い');
      expect(char.dynamics.craving).toContain('痕跡');
      expect(char.dynamics.distortedFulfillment).toContain('偽造');
      expect(result.tokensUsed).toBe(0);

      // Zod validation should pass
      const parsed = EnrichedCharacterPhase1Schema.safeParse(char);
      expect(parsed.success).toBe(true);
    });

    it('should preserve all original DevelopedCharacter fields', async () => {
      const llm = createMockLLMClientWithTools({
        name: 'submit_character_enrichment',
        arguments: validPhase1Response,
      });
      const soulText = createMockSoulText();
      const fn = createCharacterEnricher(llm, soulText);
      const result = await fn.enrichPhase1(sampleDeveloped, sampleTheme);

      const char = result.characters[0];
      expect(char.name).toBe(sampleDeveloped[0].name);
      expect(char.isNew).toBe(sampleDeveloped[0].isNew);
      expect(char.role).toBe(sampleDeveloped[0].role);
      expect(char.description).toBe(sampleDeveloped[0].description);
      expect(char.voice).toBe(sampleDeveloped[0].voice);
    });

    it('should fallback to default values on Phase1 failure', async () => {
      const llm = createMockLLMClientWithTools({
        name: 'wrong_tool',
        arguments: {},
      });
      const soulText = createMockSoulText();
      const fn = createCharacterEnricher(llm, soulText);
      const result = await fn.enrichPhase1(sampleDeveloped, sampleTheme);

      expect(result.characters).toHaveLength(1);
      const char = result.characters[0];
      expect(char.name).toBe('佐々木');
      expect(char.physicalHabits).toHaveLength(1);
      expect(char.stance.type).toBe('direct');
      // Fallback dynamics should be defaults
      expect(char.dynamics.innerWound).toBeDefined();
      expect(char.dynamics.craving).toBeDefined();
    });

    it('should accept optional macGuffins parameter', async () => {
      const llm = createMockLLMClientWithTools({
        name: 'submit_character_enrichment',
        arguments: validPhase1Response,
      });
      const soulText = createMockSoulText();
      const fn = createCharacterEnricher(llm, soulText);
      const macGuffins = [
        { characterName: '佐々木', secret: '火災の原因', surfaceSigns: ['手が震える'], narrativeFunction: '告白シーンの伏線' },
      ];
      const result = await fn.enrichPhase1(sampleDeveloped, sampleTheme, macGuffins);

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].dynamics.craving).toContain('痕跡');
    });
  });

  describe('Phase 2: dialogue samples', () => {
    it('should add dialogueSamples to Phase1 characters', async () => {
      const llm = createMockLLMClientWithTools({
        name: 'submit_dialogue_samples',
        arguments: validPhase2Response,
      });
      const soulText = createMockSoulText();
      const fn = createCharacterEnricher(llm, soulText);

      const phase1Chars = [{
        ...sampleDeveloped[0],
        physicalHabits: validPhase1Response.characters[0].physicalHabits,
        stance: validPhase1Response.characters[0].stance as { type: 'oblique'; manifestation: string; blindSpot: string },
        dynamics: sampleDynamics,
      }];

      const result = await fn.enrichPhase2(phase1Chars, samplePlot, sampleTheme);

      expect(result.characters).toHaveLength(1);
      const char = result.characters[0];
      expect(char.dialogueSamples).toHaveLength(3);
      expect(char.dialogueSamples[0].line).toBe('今日は天気がいいですね');
      expect(char.dialogueSamples[0].situation).toContain('朝');
      expect(result.tokensUsed).toBe(0);

      // Zod validation should pass for full EnrichedCharacter
      const parsed = EnrichedCharacterSchema.safeParse(char);
      expect(parsed.success).toBe(true);
    });

    it('should fallback to empty dialogueSamples on Phase2 failure', async () => {
      const llm = createMockLLMClientWithTools({
        name: 'wrong_tool',
        arguments: {},
      });
      const soulText = createMockSoulText();
      const fn = createCharacterEnricher(llm, soulText);

      const phase1Chars = [{
        ...sampleDeveloped[0],
        physicalHabits: validPhase1Response.characters[0].physicalHabits,
        stance: validPhase1Response.characters[0].stance as { type: 'oblique'; manifestation: string; blindSpot: string },
        dynamics: sampleDynamics,
      }];

      const result = await fn.enrichPhase2(phase1Chars, samplePlot, sampleTheme);

      expect(result.characters).toHaveLength(1);
      // Fallback: minimum 2 default dialogue samples
      expect(result.characters[0].dialogueSamples.length).toBeGreaterThanOrEqual(2);
    });
  });
});
