import { describe, it, expect, vi } from 'vitest';
import { buildPrompt } from '../../src/template/composer.js';
import type { TemplateContext } from '../../src/template/types.js';

vi.mock('../../src/template/loader.js', () => ({
  loadTemplate: vi.fn().mockReturnValue({
    meta: { agent: 'test', version: 1 },
    system: {
      sections: [
        { type: 'heading', heading: 'System' },
        { type: 'text', text: 'Hello {{ name }}' },
      ],
    },
    user: {
      sections: [
        { type: 'text', text: 'User prompt: {{ prompt }}' },
      ],
    },
  }),
}));

describe('buildPrompt', () => {
  const ctx: TemplateContext = {
    name: 'テスト',
    prompt: 'write a scene',
  };

  it('returns system and user strings', () => {
    const result = buildPrompt('test', ctx);
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
  });

  it('renders system sections with context', () => {
    const result = buildPrompt('test', ctx);
    expect(result.system).toContain('## System');
    expect(result.system).toContain('Hello テスト');
  });

  it('renders user sections with context', () => {
    const result = buildPrompt('test', ctx);
    expect(result.user).toContain('User prompt: write a scene');
  });
});
