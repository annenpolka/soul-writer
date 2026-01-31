import { describe, it, expect, vi } from 'vitest';
import { renderSections } from '../../src/template/renderer.js';
import type { Section, TemplateContext } from '../../src/template/types.js';

// Mock loader to avoid filesystem access
vi.mock('../../src/template/loader.js', () => ({
  loadTemplate: vi.fn().mockReturnValue({
    meta: { agent: 'included', version: 1 },
    system: { sections: [{ type: 'text', text: 'included content' }] },
    user: { sections: [] },
  }),
}));

describe('renderSections', () => {
  const ctx: TemplateContext = {
    name: 'テスト',
    items: ['a', 'b', 'c'],
    nested: { value: 'hello' },
    flag: true,
  };

  it('renders text section with variable interpolation', () => {
    const sections: Section[] = [{ type: 'text', text: 'Hello {{ name }}!' }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('Hello テスト!');
  });

  it('renders heading section with default level 2', () => {
    const sections: Section[] = [{ type: 'heading', heading: 'Title' }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('## Title');
  });

  it('renders heading section with custom level', () => {
    const sections: Section[] = [{ type: 'heading', heading: 'Sub', level: 3 }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('### Sub');
  });

  it('renders each section iterating over array', () => {
    const sections: Section[] = [{
      type: 'each',
      each: 'items',
      as: 'item',
      template: '- {{ item }}',
    }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('- a\n- b\n- c');
  });

  it('renders condition section (then branch)', () => {
    const sections: Section[] = [{
      type: 'condition',
      if: { has: 'flag' },
      then: [{ type: 'text', text: 'yes' }],
      else: [{ type: 'text', text: 'no' }],
    }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('yes');
  });

  it('renders condition section (else branch)', () => {
    const sections: Section[] = [{
      type: 'condition',
      if: { has: 'missing' },
      then: [{ type: 'text', text: 'yes' }],
      else: [{ type: 'text', text: 'no' }],
    }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('no');
  });

  it('renders condition without else as empty when false', () => {
    const sections: Section[] = [{
      type: 'condition',
      if: { has: 'missing' },
      then: [{ type: 'text', text: 'yes' }],
    }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('');
  });

  it('renders include section', () => {
    const sections: Section[] = [{ type: 'include', include: 'constitution' }];
    const result = renderSections(sections, ctx);
    expect(result).toContain('included content');
  });

  it('renders include section with interpolated params (string)', async () => {
    const { loadTemplate } = await import('../../src/template/loader.js');
    const mockLoadTemplate = vi.mocked(loadTemplate);
    mockLoadTemplate.mockReturnValueOnce({
      meta: { agent: 'section', version: 1 },
      system: { sections: [{ type: 'text', text: 'got {{ myParam }}' }] },
      user: { sections: [] },
    });
    const context: TemplateContext = { source: 'world' };
    const sections: Section[] = [{
      type: 'include',
      include: 'test-section',
      params: { myParam: '{{ source }}' },
    }];
    const result = renderSections(sections, context);
    expect(result).toBe('got world');
  });

  it('renders include section with params resolving to structured data', async () => {
    const { loadTemplate } = await import('../../src/template/loader.js');
    const mockLoadTemplate = vi.mocked(loadTemplate);
    mockLoadTemplate.mockReturnValueOnce({
      meta: { agent: 'section', version: 1 },
      system: { sections: [{
        type: 'each',
        each: 'list',
        as: 'x',
        template: '- {{ x }}',
      }] },
      user: { sections: [] },
    });
    const context: TemplateContext = { data: ['alpha', 'beta'] };
    const sections: Section[] = [{
      type: 'include',
      include: 'test-section',
      params: { list: '{{ data }}' },
    }];
    const result = renderSections(sections, context);
    expect(result).toBe('- alpha\n- beta');
  });

  it('renders nested variable paths', () => {
    const sections: Section[] = [{ type: 'text', text: '{{ nested.value }}' }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('hello');
  });

  it('renders multiple sections joined with newlines', () => {
    const sections: Section[] = [
      { type: 'heading', heading: 'Title' },
      { type: 'text', text: 'Body' },
    ];
    const result = renderSections(sections, ctx);
    expect(result).toBe('## Title\nBody');
  });

  it('renders text with filter pipe', () => {
    const sections: Section[] = [{ type: 'text', text: '{{ items | join: ", " }}' }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('a, b, c');
  });

  it('leaves undefined variables as empty string', () => {
    const sections: Section[] = [{ type: 'text', text: 'Hello {{ unknown }}!' }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('Hello !');
  });

  it('renders each section with nested sections instead of template', () => {
    const context: TemplateContext = {
      chars: [
        { name: 'Alice', role: 'hero', traits: ['brave', 'kind'] },
        { name: 'Bob', role: 'villain' },
      ],
    };
    const sections: Section[] = [{
      type: 'each',
      each: 'chars',
      as: 'c',
      sections: [
        { type: 'heading', heading: '{{ c.name }}', level: 3 },
        { type: 'text', text: '- 役割: {{ c.role }}' },
        {
          type: 'condition',
          if: { has: 'c.traits' },
          then: [{ type: 'text', text: '- 特徴: {{ c.traits | join: ", " }}' }],
        },
      ],
    }];
    const result = renderSections(sections, context);
    expect(result).toBe(
      '### Alice\n- 役割: hero\n- 特徴: brave, kind\n### Bob\n- 役割: villain'
    );
  });

  it('renders each section with limit', () => {
    const sections: Section[] = [{
      type: 'each',
      each: 'items',
      as: 'item',
      limit: 2,
      template: '- {{ item }}',
    }];
    const result = renderSections(sections, ctx);
    expect(result).toBe('- a\n- b');
  });

  it('renders each section with sections and limit', () => {
    const context: TemplateContext = {
      list: [{ v: 'x' }, { v: 'y' }, { v: 'z' }],
    };
    const sections: Section[] = [{
      type: 'each',
      each: 'list',
      as: 'el',
      limit: 2,
      sections: [{ type: 'text', text: '{{ el.v }}' }],
    }];
    const result = renderSections(sections, context);
    expect(result).toBe('x\ny');
  });
});
