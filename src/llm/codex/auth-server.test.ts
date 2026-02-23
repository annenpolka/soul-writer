import { describe, it, expect } from 'vitest';
import { extractCallbackParams } from './auth-server.js';

describe('extractCallbackParams', () => {
  it('コールバックURLからcodeとstateを抽出できる', () => {
    const result = extractCallbackParams('/auth/callback?code=abc123&state=def456');

    expect(result).toEqual({ code: 'abc123', state: 'def456' });
  });

  it('codeが欠落している場合にnullを返す', () => {
    expect(extractCallbackParams('/auth/callback?state=def456')).toBeNull();
  });

  it('stateが欠落している場合にnullを返す', () => {
    expect(extractCallbackParams('/auth/callback?code=abc123')).toBeNull();
  });

  it('パラメータが全く無い場合にnullを返す', () => {
    expect(extractCallbackParams('/auth/callback')).toBeNull();
  });

  it('追加のパラメータがあっても正しく抽出する', () => {
    const result = extractCallbackParams('/auth/callback?code=abc&state=def&extra=val');

    expect(result).toEqual({ code: 'abc', state: 'def' });
  });
});
