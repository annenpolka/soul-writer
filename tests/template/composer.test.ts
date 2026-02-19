import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, buildTemplateBlock, buildTemplateBlocks } from '../../src/template/composer.js';
import type { TemplateContext } from '../../src/template/types.js';

vi.mock('../../src/template/loader.js', () => ({
  loadTemplate: vi.fn(),
}));
import { loadTemplate } from '../../src/template/loader.js';

const baseDoc = {
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
};

const ctx: TemplateContext = {
  name: 'テスト',
  prompt: 'write a scene',
};

describe('buildPrompt', () => {
  beforeEach(() => {
    vi.mocked(loadTemplate).mockReset();
    vi.mocked(loadTemplate).mockReturnValue(baseDoc);
  });

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

describe('buildTemplateBlocks', () => {
  beforeEach(() => {
    vi.mocked(loadTemplate).mockReset();
  });

  it('renders explicit blocks for non-agent templates', () => {
    vi.mocked(loadTemplate).mockReturnValue({
      ...baseDoc,
      blocks: {
        intro: { sections: [{ type: 'text', text: 'Hello {{ name }}' }] },
        summary: { sections: [{ type: 'text', text: 'Prompt {{ prompt }}' }] },
      },
    });

    const result = buildTemplateBlocks('pipeline', 'chapter', ctx);
    expect(loadTemplate).toHaveBeenCalledWith('pipeline', 'chapter');
    expect(result).toEqual({
      intro: 'Hello テスト',
      summary: 'Prompt write a scene',
    });
  });

  it('falls back to system/user blocks when explicit blocks are absent', () => {
    vi.mocked(loadTemplate).mockReturnValue(baseDoc);

    const result = buildTemplateBlocks('section', 'constitution', ctx);
    expect(result).toEqual({
      system: '## System\nHello テスト',
      user: 'User prompt: write a scene',
    });
  });

  it('renders templates map when present', () => {
    vi.mocked(loadTemplate).mockReturnValue({
      meta: { name: 'pipeline-doc', version: 1 },
      templates: {
        greeting: 'Hello {{ name }}',
        request: 'Prompt {{ prompt }}',
      },
    });

    const result = buildTemplateBlocks('pipeline', 'chapter', ctx);
    expect(result).toEqual({
      greeting: 'Hello テスト',
      request: 'Prompt write a scene',
    });
  });
});

describe('buildTemplateBlock', () => {
  it('returns only the requested block', () => {
    vi.mocked(loadTemplate).mockReturnValue({
      meta: { name: 'pipeline-doc', version: 1 },
      templates: {
        a: 'A {{ name }}',
        b: 'B {{ prompt }}',
      },
    });

    expect(buildTemplateBlock('pipeline', 'chapter', 'a', ctx)).toBe('A テスト');
  });

  it('throws when requested block does not exist', () => {
    vi.mocked(loadTemplate).mockReturnValue({
      meta: { name: 'pipeline-doc', version: 1 },
      templates: { only: 'x' },
    });

    expect(() => buildTemplateBlock('pipeline', 'chapter', 'missing', ctx)).toThrow();
  });
});
