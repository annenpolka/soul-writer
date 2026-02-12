import { describe, it, expect } from 'vitest';
import { parsePhase1Response, parsePhase2Response } from '../../../src/agents/parsers/character-enricher-parser.js';
import type { DevelopedCharacter } from '../../../src/factory/character-developer.js';
import type { EnrichedCharacterPhase1 } from '../../../src/factory/character-enricher.js';

const sampleDeveloped: DevelopedCharacter[] = [
  {
    name: '佐々木',
    isNew: true,
    role: '対話相手',
    description: '穏健タグの偽造者。外見は温和だが内面に過失を抱える',
    voice: '丁寧語、語尾に「ですね」が多い',
  },
];

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

describe('parsePhase1Response', () => {
  it('should parse valid Phase1 response with habits and stance', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [
            { habit: '話すとき必ず左手で右肘を掴む', trigger: '相手と目が合うとき', sensoryDetail: '指が白くなるほど強く' },
            { habit: '相手の靴を先に見る', trigger: '初対面のとき', sensoryDetail: '視線がゆっくり上がっていく' },
          ],
          stance: {
            type: 'oblique',
            manifestation: 'テーマの深刻さを認識しつつ、笑いに変える',
            blindSpot: '自分の関与について決して言及しない',
          },
        },
      ],
    };

    const result = parsePhase1Response(data, sampleDeveloped);

    expect(result.characters).toHaveLength(1);
    const char = result.characters[0];
    expect(char.name).toBe('佐々木');
    expect(char.physicalHabits).toHaveLength(2);
    expect(char.physicalHabits[0].habit).toBe('話すとき必ず左手で右肘を掴む');
    expect(char.stance.type).toBe('oblique');
    expect(char.stance.blindSpot).toContain('言及しない');
  });

  it('should merge original DevelopedCharacter fields into parsed result', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [
            { habit: '手を握る', trigger: '緊張時', sensoryDetail: '関節が鳴る' },
          ],
          stance: { type: 'direct', manifestation: '正面から向き合う', blindSpot: '共感の欠如' },
        },
      ],
    };

    const result = parsePhase1Response(data, sampleDeveloped);
    const char = result.characters[0];

    expect(char.isNew).toBe(true);
    expect(char.role).toBe('対話相手');
    expect(char.description).toBe(sampleDeveloped[0].description);
    expect(char.voice).toBe(sampleDeveloped[0].voice);
  });

  it('should return fallback defaults when characters array is empty', () => {
    const data = { characters: [] };

    const result = parsePhase1Response(data, sampleDeveloped);

    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('佐々木');
    expect(result.characters[0].physicalHabits).toHaveLength(1);
    expect(result.characters[0].stance.type).toBe('direct');
  });

  it('should handle multiple characters', () => {
    const multiDeveloped: DevelopedCharacter[] = [
      { name: '佐々木', isNew: true, role: '対話相手', description: '偽造者', voice: '丁寧語' },
      { name: '田中', isNew: true, role: '傍観者', description: '記者', voice: '砕けた口調' },
    ];

    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [{ habit: '肘掴み', trigger: '対話中', sensoryDetail: '白い指' }],
          stance: { type: 'oblique', manifestation: '笑いに変換', blindSpot: '自分の関与' },
        },
        {
          name: '田中',
          physicalHabits: [{ habit: 'メモを取る', trigger: '常に', sensoryDetail: 'ペン先の音' }],
          stance: { type: 'indifferent', manifestation: '傍観に徹する', blindSpot: '感情移入' },
        },
      ],
    };

    const result = parsePhase1Response(data, multiDeveloped);

    expect(result.characters).toHaveLength(2);
    expect(result.characters[0].name).toBe('佐々木');
    expect(result.characters[1].name).toBe('田中');
    expect(result.characters[1].stance.type).toBe('indifferent');
  });

  it('should use fallback for characters not in LLM response', () => {
    const multiDeveloped: DevelopedCharacter[] = [
      { name: '佐々木', isNew: true, role: '対話相手', description: '偽造者', voice: '丁寧語' },
      { name: '田中', isNew: true, role: '傍観者', description: '記者', voice: '砕けた口調' },
    ];

    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [{ habit: '肘掴み', trigger: '対話中', sensoryDetail: '白い指' }],
          stance: { type: 'oblique', manifestation: '笑いに変換', blindSpot: '関与' },
        },
        // 田中 is missing from LLM response
      ],
    };

    const result = parsePhase1Response(data, multiDeveloped);

    expect(result.characters).toHaveLength(2);
    expect(result.characters[0].physicalHabits[0].habit).toBe('肘掴み');
    // 田中 should get fallback defaults
    expect(result.characters[1].name).toBe('田中');
    expect(result.characters[1].stance.type).toBe('direct');
  });

  it('should parse dynamics from Phase1 response', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [{ habit: '肘掴み', trigger: '対話中', sensoryDetail: '白い指' }],
          stance: { type: 'oblique', manifestation: '笑いに変換', blindSpot: '関与' },
          dynamics: sampleDynamics,
        },
      ],
    };

    const result = parsePhase1Response(data, sampleDeveloped);
    const char = result.characters[0];
    expect(char.dynamics.innerWound).toContain('見捨てられ');
    expect(char.dynamics.craving).toContain('痕跡');
    expect(char.dynamics.surfaceContradiction).toContain('温和');
    expect(char.dynamics.distortedFulfillment).toContain('偽造');
    expect(char.dynamics.fulfillmentCondition).toContain('行動を実際に変えた');
    expect(char.dynamics.relationshipAsymmetry).toContain('操作');
  });

  it('should use default dynamics when dynamics is missing from response', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [{ habit: '肘掴み', trigger: '対話中', sensoryDetail: '白い指' }],
          stance: { type: 'oblique', manifestation: '笑いに変換', blindSpot: '関与' },
          // no dynamics field
        },
      ],
    };

    const result = parsePhase1Response(data, sampleDeveloped);
    const char = result.characters[0];
    // Should fall back to defaults
    expect(char.dynamics.innerWound).toBeDefined();
    expect(char.dynamics.craving).toBeDefined();
    expect(char.dynamics.distortedFulfillment).toBeDefined();
  });

  it('should use default for individual dynamics fields that are too short', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          physicalHabits: [{ habit: '肘掴み', trigger: '対話中', sensoryDetail: '白い指' }],
          stance: { type: 'oblique', manifestation: '笑いに変換', blindSpot: '関与' },
          dynamics: {
            innerWound: '短い', // too short (< 10)
            craving: '他者の人生に取り返しのつかない痕跡を残すこと',
            surfaceContradiction: '温和な表層と破壊的な渇望の乖離',
            distortedFulfillment: '短い', // too short
            fulfillmentCondition: '偽造した情報が他者の行動を実際に変えた瞬間',
            relationshipAsymmetry: '一方的に他者の記録を操作する立場に固執する',
          },
        },
      ],
    };

    const result = parsePhase1Response(data, sampleDeveloped);
    const char = result.characters[0];
    // Short fields should fall back to defaults
    expect(char.dynamics.innerWound).not.toBe('短い');
    expect(char.dynamics.distortedFulfillment).not.toBe('短い');
    // Valid fields should be preserved
    expect(char.dynamics.craving).toContain('痕跡');
    expect(char.dynamics.surfaceContradiction).toContain('温和');
  });
});

describe('parsePhase2Response', () => {
  it('should parse valid Phase2 response with dialogue samples', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          dialogueSamples: [
            { line: '今日は天気がいいですね', situation: '朝の教室', voiceNote: '日常的' },
            { line: 'まあ、そういうこともある', situation: 'タグの話題', voiceNote: '斜めの態度' },
            { line: 'コーヒー、砂糖三つで', situation: '休憩中', voiceNote: 'テーマ無関係' },
          ],
        },
      ],
    };

    const result = parsePhase2Response(data, samplePhase1Chars);

    expect(result.characters).toHaveLength(1);
    const char = result.characters[0];
    expect(char.dialogueSamples).toHaveLength(3);
    expect(char.dialogueSamples[0].line).toBe('今日は天気がいいですね');
    expect(char.dialogueSamples[1].voiceNote).toBe('斜めの態度');
  });

  it('should preserve all Phase1 fields in Phase2 result', () => {
    const data = {
      characters: [
        {
          name: '佐々木',
          dialogueSamples: [
            { line: 'L1', situation: 'S1', voiceNote: 'V1' },
            { line: 'L2', situation: 'S2', voiceNote: 'V2' },
          ],
        },
      ],
    };

    const result = parsePhase2Response(data, samplePhase1Chars);
    const char = result.characters[0];

    expect(char.physicalHabits).toEqual(samplePhase1Chars[0].physicalHabits);
    expect(char.stance).toEqual(samplePhase1Chars[0].stance);
    expect(char.role).toBe('対話相手');
    expect(char.voice).toBe('丁寧語、語尾に「ですね」が多い');
  });

  it('should return fallback dialogue samples when characters array is empty', () => {
    const data = { characters: [] };

    const result = parsePhase2Response(data, samplePhase1Chars);

    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].dialogueSamples.length).toBeGreaterThanOrEqual(2);
  });

  it('should use fallback for characters missing from LLM response', () => {
    const multiPhase1: EnrichedCharacterPhase1[] = [
      ...samplePhase1Chars,
      {
        name: '田中',
        isNew: true,
        role: '傍観者',
        description: '記者',
        voice: '砕けた口調',
        physicalHabits: [{ habit: 'メモ', trigger: '常に', sensoryDetail: 'ペン音' }],
        stance: { type: 'indifferent', manifestation: '傍観', blindSpot: '感情移入' },
        dynamics: sampleDynamics,
      },
    ];

    const data = {
      characters: [
        {
          name: '佐々木',
          dialogueSamples: [
            { line: 'L1', situation: 'S1', voiceNote: 'V1' },
            { line: 'L2', situation: 'S2', voiceNote: 'V2' },
          ],
        },
        // 田中 missing
      ],
    };

    const result = parsePhase2Response(data, multiPhase1);

    expect(result.characters).toHaveLength(2);
    expect(result.characters[0].dialogueSamples).toHaveLength(2);
    // 田中 should get fallback defaults
    expect(result.characters[1].name).toBe('田中');
    expect(result.characters[1].dialogueSamples.length).toBeGreaterThanOrEqual(2);
  });
});
