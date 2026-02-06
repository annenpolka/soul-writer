import { describe, it, expect } from 'vitest';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import type { PlotterContextInput } from '../../../src/agents/context/plotter-context.js';
import { buildPlotterContext } from '../../../src/agents/context/plotter-context.js';
import { DEFAULT_PLOTTER_CONFIG } from '../../../src/agents/types.js';
import type { GeneratedTheme } from '../../../src/schemas/generated-theme.js';
import type { PlotMacGuffin, CharacterMacGuffin } from '../../../src/schemas/macguffin.js';

function makeInput(overrides?: Partial<PlotterContextInput>): PlotterContextInput {
  return {
    soulText: createMockSoulText(),
    config: { ...DEFAULT_PLOTTER_CONFIG },
    ...overrides,
  };
}

describe('buildPlotterContext', () => {
  it('should include chapterInstruction', () => {
    const ctx = buildPlotterContext(makeInput());

    expect(ctx.chapterInstruction).toContain('5章構成');
    expect(ctx.chapterInstruction).toContain('20000字');
  });

  it('should use custom chapterCount and targetTotalLength', () => {
    const ctx = buildPlotterContext(makeInput({
      config: { ...DEFAULT_PLOTTER_CONFIG, chapterCount: 3, targetTotalLength: 10000 },
    }));

    expect(ctx.chapterInstruction).toContain('3章構成');
    expect(ctx.chapterInstruction).toContain('10000字');
  });

  describe('thematicMustPreserve', () => {
    it('should include thematicMustPreserve when present', () => {
      const soulText = createMockSoulText({ thematicMustPreserve: ['存在確認', '孤独'] });
      const ctx = buildPlotterContext(makeInput({ soulText }));

      expect(ctx.thematicMustPreserve).toEqual(['存在確認', '孤独']);
    });

    it('should not include thematicMustPreserve when empty', () => {
      const ctx = buildPlotterContext(makeInput());

      expect(ctx).not.toHaveProperty('thematicMustPreserve');
    });
  });

  describe('characters', () => {
    it('should include developedCharacters with tag and descriptionLine when provided', () => {
      const config = {
        ...DEFAULT_PLOTTER_CONFIG,
        developedCharacters: [
          { name: '透心', isNew: false, role: '主人公', description: '孤児', voice: 'voice' },
          { name: '新キャラ', isNew: true, role: '敵', description: '', voice: 'voice' },
        ],
      };
      const ctx = buildPlotterContext(makeInput({ config }));
      const devChars = ctx.developedCharacters as Array<Record<string, unknown>>;

      expect(devChars).toHaveLength(2);
      expect(devChars[0].tag).toBe('（既存）');
      expect(devChars[0].descriptionLine).toBe('\n  背景: 孤児');
      expect(devChars[1].tag).toBe('（新規）');
      expect(devChars[1].descriptionLine).toBe('');
    });

    it('should fall back to worldBibleCharacters when no developedCharacters', () => {
      const soulText = createMockSoulText({
        characters: {
          '透心': { role: 'protagonist', description: '孤児', traits: [], speech_pattern: '' },
        },
      });
      const ctx = buildPlotterContext(makeInput({ soulText }));

      expect(ctx.worldBibleCharacters).toEqual([
        { name: '透心', role: 'protagonist', description: '孤児' },
      ]);
      expect(ctx).not.toHaveProperty('developedCharacters');
    });

    it('should not include worldBibleCharacters when characters is empty', () => {
      const ctx = buildPlotterContext(makeInput());

      expect(ctx).not.toHaveProperty('worldBibleCharacters');
      expect(ctx).not.toHaveProperty('developedCharacters');
    });
  });

  describe('technology', () => {
    it('should include technologyEntries when technology exists', () => {
      const soulText = createMockSoulText({
        deep: {
          worldBible: {
            technology: { 'ARタグ': '拡張現実タグ' },
            society: {},
            characters: {},
            terminology: {},
            locations: {},
          },
        } as never,
      });
      const ctx = buildPlotterContext(makeInput({ soulText }));
      const entries = ctx.technologyEntries as Array<{ name: string; description: string }>;

      expect(entries).toEqual([
        { name: 'ARタグ', description: '拡張現実タグ' },
      ]);
    });

    it('should not include technologyEntries when technology is empty', () => {
      const ctx = buildPlotterContext(makeInput());

      expect(ctx).not.toHaveProperty('technologyEntries');
    });
  });

  describe('themeInfo', () => {
    const mockTheme: GeneratedTheme = {
      emotion: '孤独',
      timeline: '出会い前',
      characters: [
        { name: '御鐘透心', isNew: false },
        { name: '新キャラ', isNew: true, description: 'テスト用' },
      ],
      premise: 'テスト前提',
      scene_types: ['内面描写', '対話'],
      narrative_type: '一人称',
      tone: '冷徹',
    };

    it('should include themeInfo when theme is provided', () => {
      const config = { ...DEFAULT_PLOTTER_CONFIG, theme: mockTheme };
      const ctx = buildPlotterContext(makeInput({ config }));
      const info = ctx.themeInfo as Record<string, unknown>;

      expect(info.emotion).toBe('孤独');
      expect(info.timeline).toBe('出会い前');
      expect(info.premise).toBe('テスト前提');
      expect(info.scene_types).toEqual(['内面描写', '対話']);
      expect(info.narrative_type).toBe('一人称');
      expect(info.tone).toBe('冷徹');
    });

    it('should map characters with tag and descSuffix', () => {
      const config = { ...DEFAULT_PLOTTER_CONFIG, theme: mockTheme };
      const ctx = buildPlotterContext(makeInput({ config }));
      const info = ctx.themeInfo as Record<string, unknown>;
      const chars = info.characters as Array<{ name: string; tag: string; descSuffix: string }>;

      expect(chars[0]).toEqual({ name: '御鐘透心', tag: '', descSuffix: '' });
      expect(chars[1]).toEqual({ name: '新キャラ', tag: '（新規）', descSuffix: ': テスト用' });
    });

    it('should not include themeInfo when no theme', () => {
      const ctx = buildPlotterContext(makeInput());

      expect(ctx).not.toHaveProperty('themeInfo');
    });
  });

  describe('macGuffins', () => {
    it('should include plotMacGuffins when provided', () => {
      const plotMacGuffins: PlotMacGuffin[] = [{
        name: '謎の装置',
        surfaceAppearance: '古いデバイス',
        hiddenLayer: '真実の鍵',
        tensionQuestions: ['なぜ存在する？', '誰が作った？'],
        presenceHint: '時々光る',
      }];
      const config = { ...DEFAULT_PLOTTER_CONFIG, plotMacGuffins };
      const ctx = buildPlotterContext(makeInput({ config }));
      const entries = ctx.plotMacGuffins as Array<Record<string, unknown>>;

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('謎の装置');
      expect(entries[0].surface).toBe('古いデバイス');
      expect(entries[0].questions).toBe('なぜ存在する？、誰が作った？');
      expect(entries[0].hint).toBe('時々光る');
    });

    it('should include characterMacGuffins when provided', () => {
      const characterMacGuffins: CharacterMacGuffin[] = [{
        characterName: '透心',
        secret: '隠された記憶',
        surfaceSigns: ['時々ぼんやりする', '夢で叫ぶ'],
        narrativeFunction: '物語の核心',
      }];
      const config = { ...DEFAULT_PLOTTER_CONFIG, characterMacGuffins };
      const ctx = buildPlotterContext(makeInput({ config }));
      const entries = ctx.characterMacGuffins as Array<Record<string, unknown>>;

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('透心');
      expect(entries[0].secret).toBe('隠された記憶');
      expect(entries[0].signs).toBe('時々ぼんやりする、夢で叫ぶ');
    });

    it('should not include macGuffins when empty', () => {
      const ctx = buildPlotterContext(makeInput());

      expect(ctx).not.toHaveProperty('plotMacGuffins');
      expect(ctx).not.toHaveProperty('characterMacGuffins');
    });
  });
});
