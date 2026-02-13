import { describe, it, expect, vi } from 'vitest';
import { createThemeGenerator, type ThemeGeneratorFn } from '../../src/factory/theme-generator.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';
import type { LLMClient } from '../../src/llm/types.js';
import { createMockLLMClientWithStructured } from '../helpers/mock-deps.js';

const validThemeData = {
  emotion: '孤独',
  timeline: '出会い前',
  characters: [{ name: '御鐘透心', isNew: false }],
  premise: 'テスト用前提',
  scene_types: ['内面描写'],
};

function createThemeGenLLM(themeData: Record<string, unknown> = validThemeData): LLMClient {
  const client = createMockLLMClientWithStructured(themeData);
  // Stage 1 wild idea generation uses complete()
  (client.complete as ReturnType<typeof vi.fn>).mockResolvedValue('ワイルドアイデア: テスト用の奇抜なアイデア');
  (client.getTotalTokens as ReturnType<typeof vi.fn>).mockReturnValue(200);
  return client;
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
    // Stage 1 calls complete, Stage 2 calls completeStructured
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(llm.completeStructured).toHaveBeenCalledTimes(1);
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

  it('should throw on completeStructured failure', async () => {
    const llm = createThemeGenLLM();
    (llm.completeStructured as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Structured output failed'));
    const soulText = createMockSoulText();
    const fn = createThemeGenerator(llm, soulText);
    await expect(fn.generateTheme()).rejects.toThrow();
  });
});
