import { describe, it, expectTypeOf } from 'vitest';
import type {
  TemplateDocument,
  Section,
  TextSection,
  HeadingSection,
  IncludeSection,
  EachSection,
  ConditionSection,
  SchemaSection,
  LetSection,
  SwitchSection,
  SwitchCase,
  Condition,
  HasCondition,
  EqCondition,
  InCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  TemplateContext,
  TemplateKind,
  TemplateBlock,
} from '../../src/template/types.js';

describe('Template types', () => {
  it('TextSection should have text field', () => {
    const s: TextSection = { type: 'text', text: 'hello {{ name }}' };
    expectTypeOf(s.text).toBeString();
  });

  it('HeadingSection should have heading and optional level', () => {
    const s: HeadingSection = { type: 'heading', heading: 'Title', level: 2 };
    expectTypeOf(s.heading).toBeString();
    expectTypeOf(s.level).toEqualTypeOf<number | undefined>();
  });

  it('IncludeSection should have include name and optional params', () => {
    const s: IncludeSection = { type: 'include', include: 'constitution', params: { agent: 'writer' } };
    expectTypeOf(s.include).toBeString();
  });

  it('EachSection should have path, as, and template', () => {
    const s: EachSection = { type: 'each', each: 'items', as: 'item', template: '{{ item }}' };
    expectTypeOf(s.each).toBeString();
  });

  it('ConditionSection should have if, then, and optional else', () => {
    const s: ConditionSection = {
      type: 'condition',
      if: { has: 'x' },
      then: [{ type: 'text', text: 'yes' }],
      else: [{ type: 'text', text: 'no' }],
    };
    expectTypeOf(s.then).toEqualTypeOf<Section[]>();
  });

  it('SchemaSection should have source and format', () => {
    const s: SchemaSection = { type: 'schema', source: 'schemas/plot', format: 'json-example', label: 'Output:' };
    expectTypeOf(s.source).toBeString();
  });

  it('LetSection should bind variables and render nested sections', () => {
    const s: LetSection = {
      type: 'let',
      let: { chapterNo: '{{ chapter.index }}', mode: 'draft' },
      sections: [{ type: 'text', text: 'Chapter {{ chapterNo }}' }],
    };
    expectTypeOf(s.let).toEqualTypeOf<Record<string, unknown>>();
  });

  it('SwitchSection should include cases and optional default', () => {
    const cases: SwitchCase[] = [
      { when: 'draft', then: [{ type: 'text', text: 'draft mode' }] },
      { when: 'review', then: [{ type: 'text', text: 'review mode' }] },
    ];
    const s: SwitchSection = {
      type: 'switch',
      switch: 'stage',
      cases,
      default: [{ type: 'text', text: 'other mode' }],
    };
    expectTypeOf(s.cases).toEqualTypeOf<SwitchCase[]>();
  });

  it('Section union should accept all section types', () => {
    const sections: Section[] = [
      { type: 'text', text: 'hello' },
      { type: 'heading', heading: 'Title' },
      { type: 'include', include: 'constitution' },
      { type: 'each', each: 'items', as: 'item', template: '{{ item }}' },
      { type: 'condition', if: { has: 'x' }, then: [] },
      { type: 'schema', source: 'schemas/plot', format: 'json-example' },
      { type: 'let', let: { x: 1 }, sections: [{ type: 'text', text: '{{ x }}' }] },
      { type: 'switch', switch: 'mode', cases: [{ when: 'draft', then: [{ type: 'text', text: 'D' }] }] },
    ];
    expectTypeOf(sections).toEqualTypeOf<Section[]>();
  });

  it('Condition types should be discriminated', () => {
    const conditions: Condition[] = [
      { has: 'developedCharacters' },
      { eq: ['narrativeRules.pov', 'first-person'] },
      { in: ['category', 'config.focusCategories'] },
      { and: [{ has: 'x' }, { eq: ['y', 'z'] }] },
      { or: [{ has: 'a' }, { has: 'b' }] },
      { not: { has: 'x' } },
    ];
    expectTypeOf(conditions).toEqualTypeOf<Condition[]>();
  });

  it('TemplateDocument should have meta, system, and user sections', () => {
    const doc: TemplateDocument = {
      meta: { agent: 'writer', version: 1 },
      system: { sections: [{ type: 'text', text: 'hello' }] },
      user: { sections: [{ type: 'text', text: 'prompt' }] },
      blocks: {
        intro: { sections: [{ type: 'text', text: 'intro' }] },
      },
    };
    expectTypeOf(doc.meta.agent).toEqualTypeOf<string | undefined>();
    expectTypeOf(doc.system.sections).toEqualTypeOf<Section[]>();
  });

  it('TemplateDocument should support templates map only', () => {
    const doc: TemplateDocument = {
      meta: { name: 'chapter-generation', version: 1 },
      templates: {
        title: '# {{ plot.title }}',
      },
    };
    expectTypeOf(doc.templates).toEqualTypeOf<Record<string, string> | undefined>();
  });

  it('TemplateBlock should contain sections', () => {
    const block: TemplateBlock = { sections: [{ type: 'text', text: 'hello' }] };
    expectTypeOf(block.sections).toEqualTypeOf<Section[]>();
  });

  it('TemplateKind should support agent/section/pipeline', () => {
    const kinds: TemplateKind[] = ['agent', 'section', 'pipeline'];
    expectTypeOf(kinds).toEqualTypeOf<TemplateKind[]>();
  });

  it('TemplateContext should accept arbitrary nested data', () => {
    const ctx: TemplateContext = {
      soulText: { constitution: {} },
      narrativeRules: { pov: 'first-person' },
      config: { focusCategories: ['opening'] },
      prompt: 'Write a scene',
    };
    expectTypeOf(ctx).toEqualTypeOf<TemplateContext>();
  });
});
