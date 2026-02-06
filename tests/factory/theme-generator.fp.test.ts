import { describe, it, expect, vi } from 'vitest';
import { createThemeGenerator, type ThemeGeneratorFn } from '../../src/factory/theme-generator.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { LLMClient } from '../../src/llm/types.js';

const validThemeArgs = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [{ name: '御鐘透心', isNew: false }],
  premise: 'テスト用前提',
  scene_types: ['内面描写'],
};

function createThemeGenLLM(themeArgs: Record<string, unknown> = validThemeArgs): LLMClient {
  return {
    // Stage 1 wild idea generation
    complete: vi.fn().mockResolvedValue('ワイルドアイデア: テスト用の奇抜なアイデア'),
    // Stage 2 tool call
    completeWithTools: vi.fn().mockResolvedValue({
      toolCalls: [{
        id: 'tc-1',
        type: 'function' as const,
        function: {
          name: 'submit_theme',
          arguments: JSON.stringify(themeArgs),
        },
      }],
      content: null,
      tokensUsed: 200,
    }),
    getTotalTokens: vi.fn().mockReturnValue(200),
  };
}

describe('createThemeGenerator (FP)', () => {
  it('should return a ThemeGeneratorFn with generateTheme method', () => {
    const llm = createThemeGenLLM();
    const soulText = createMockSoulText();
    const fn: ThemeGeneratorFn = createThemeGenerator(llm, soulText);
    expect(typeof fn.generateTheme).toBe('function');
  });

  it('should generate theme via two-stage process', async () => {
    const llm = createThemeGenLLM();
    const soulText = createMockSoulText();
    const fn = createThemeGenerator(llm, soulText);
    const result = await fn.generateTheme();
    expect(result.theme.emotion).toBe('孤独');
    expect(result.theme.premise).toBe('テスト用前提');
    // Stage 1 calls complete, Stage 2 calls completeWithTools
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(llm.completeWithTools).toHaveBeenCalledTimes(1);
    // Tone is injected from stage1
    expect(result.theme.tone).toBeDefined();
  });

  it('should pass recentThemes and motifAvoidance to stage 2', async () => {
    const llm = createThemeGenLLM();
    const soulText = createMockSoulText();
    const fn = createThemeGenerator(llm, soulText);
    const recentThemes = [{
      emotion: '渇望',
      timeline: '出会い後',
      characters: [{ name: '愛原つるぎ', isNew: false }],
      premise: '過去の前提',
      scene_types: ['対話'],
    }];
    const result = await fn.generateTheme(recentThemes, ['反復モチーフ']);
    expect(result.theme).toBeDefined();
  });

  it('should throw on invalid theme response', async () => {
    const llm = createThemeGenLLM({
      emotion: '', // Invalid: empty string fails min(1) validation
      timeline: '',
      characters: [],
      premise: '',
      scene_types: [],
    });
    const soulText = createMockSoulText();
    const fn = createThemeGenerator(llm, soulText);
    await expect(fn.generateTheme()).rejects.toThrow();
  });
});
