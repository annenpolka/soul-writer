import { describe, it, expect } from 'vitest';
import { filterChineseContamination } from '../../../src/pipeline/filters/chinese-filter.js';

describe('filterChineseContamination', () => {
  it('should remove Chinese conjunction patterns', () => {
    const input = '彼女は因为大きな声で虽然叫んだ';
    const result = filterChineseContamination(input);
    expect(result).toBe('彼女は大きな声で叫んだ');
  });

  it('should remove Chinese pronoun patterns', () => {
    const input = '他们が来た。她们も来た。';
    const result = filterChineseContamination(input);
    expect(result).toBe('が来た。も来た。');
  });

  it('should remove Chinese demonstrative patterns', () => {
    const input = '这个ものを这里に置いた';
    const result = filterChineseContamination(input);
    expect(result).toBe('ものをに置いた');
  });

  it('should remove Chinese temporal patterns', () => {
    const input = '已经終わった。正在進行中。';
    const result = filterChineseContamination(input);
    expect(result).toBe('終わった。進行中。');
  });

  it('should not modify pure Japanese text', () => {
    const input = '透心は窓の外を眺めていた。空は灰色に染まっている。つるぎが背後に立った。';
    const result = filterChineseContamination(input);
    expect(result).toBe(input);
  });

  it('should return empty string for empty input', () => {
    expect(filterChineseContamination('')).toBe('');
  });

  it('should handle null-like falsy values gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(filterChineseContamination(undefined as any)).toBe(undefined);
  });

  it('should normalize double spaces after removal', () => {
    // "并且" removed between spaces: "A 并且 B" → "A  B" → "A B"
    const input = 'A 并且 B';
    const result = filterChineseContamination(input);
    expect(result).toBe('A B');
  });

  it('should normalize excessive blank lines after removal', () => {
    // "一行目\n\n因为\n\n\n二行目" → after removal → "一行目\n\n\n\n\n二行目"
    // /\n\n\n+/g replaces 3+ newlines with \n\n
    const input = '一行目\n\n因为\n\n\n二行目';
    const result = filterChineseContamination(input);
    expect(result).toBe('一行目\n\n二行目');
  });

  it('should handle mixed Japanese and Chinese contamination', () => {
    const input = '透心は教室で觉得不安を感じた。但是彼女は微笑んだ。';
    const result = filterChineseContamination(input);
    expect(result).toBe('透心は教室で不安を感じた。彼女は微笑んだ。');
  });

  it('should handle multiple removals in succession', () => {
    const input = '因为虽然但是';
    const result = filterChineseContamination(input);
    expect(result).toBe('');
  });

  it('should remove all pattern categories', () => {
    const patterns = ['并且', '因为', '这个', '他们', '对于', '已经', '觉得', '还是'];
    for (const p of patterns) {
      const result = filterChineseContamination(`テスト${p}テスト`);
      expect(result).not.toContain(p);
      expect(result).toContain('テスト');
    }
  });

  it('should handle Chinese text surrounded by spaces', () => {
    const input = '透心は 因为 走り出した';
    const result = filterChineseContamination(input);
    expect(result).toBe('透心は 走り出した');
  });
});
