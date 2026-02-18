import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPrompt } from '../src/template/composer.js';
import { FragmentCollectionSchema, FragmentCategory } from '../src/schemas/fragments.js';
import { loadSoulText, createSoulTextManager } from '../src/soul/manager.js';
import type { SoulTextManagerFn } from '../src/soul/manager.js';

describe('WS2: Writer prompt - 動作の美学', () => {
  it('should include 不可逆の信条 section in rendered writer template', () => {
    // Build the writer prompt with minimal context
    const result = buildPrompt('writer', {
      criticalRules: 'test rules',
      constitution: {},
      narrativeRules: {},
      prompt: 'test prompt',
    });

    expect(result.system).toContain('不可逆の信条');
  });

  it('should include action aesthetics principles in rendered output', () => {
    const result = buildPrompt('writer', {
      criticalRules: 'test rules',
      constitution: {},
      narrativeRules: {},
      prompt: 'test prompt',
    });

    expect(result.system).toContain('不可逆に変える');
    expect(result.system).toContain('身体感覚');
  });

  it('should place 不可逆の信条 after 引き算の信条', () => {
    const result = buildPrompt('writer', {
      criticalRules: 'test rules',
      constitution: {},
      narrativeRules: {},
      prompt: 'test prompt',
    });

    const subtractionIndex = result.system.indexOf('引き算の信条');
    const actionIndex = result.system.indexOf('不可逆の信条');

    expect(subtractionIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(subtractionIndex);
  });

  it('should mention action-oriented scene quality in fragments reference section', () => {
    const result = buildPrompt('writer', {
      criticalRules: 'test rules',
      constitution: {},
      narrativeRules: {},
      prompt: 'test prompt',
    });

    // The fragments reference text should mention absorbing action qualities
    expect(result.system).toContain('行動的シーンの質感');
  });
});

describe('WS3: action.json fragment validation', () => {
  it('should have action in FragmentCategory enum', () => {
    const result = FragmentCategory.safeParse('action');
    expect(result.success).toBe(true);
  });

  it('should validate action.json with FragmentCollectionSchema', () => {
    const json = JSON.parse(
      readFileSync('soul/fragments/action.json', 'utf-8')
    );
    const result = FragmentCollectionSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('action');
      expect(result.data.fragments.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('should have fragments with required fields', () => {
    const json = JSON.parse(
      readFileSync('soul/fragments/action.json', 'utf-8')
    );
    const result = FragmentCollectionSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      for (const fragment of result.data.fragments) {
        expect(fragment.id).toMatch(/^action-\d{3}$/);
        expect(fragment.text.length).toBeGreaterThan(0);
        expect(fragment.tags.length).toBeGreaterThan(0);
        expect(fragment.added_at).toBeDefined();
      }
    }
  });

  it('should include physical action fragments', () => {
    const json = JSON.parse(
      readFileSync('soul/fragments/action.json', 'utf-8')
    );
    const result = FragmentCollectionSchema.safeParse(json);

    expect(result.success).toBe(true);
    if (result.success) {
      const allText = result.data.fragments.map((f) => f.text).join('\n');
      // Should contain knife/physical action content
      expect(allText).toContain('ナイフ');
      // Should contain data lock / technical action
      expect(allText).toContain('ロック');
    }
  });
});

describe('WS3: action fragments in SoulTextManager', () => {
  let mgr: SoulTextManagerFn;

  beforeAll(async () => {
    const soulText = await loadSoulText('soul');
    mgr = createSoulTextManager(soulText);
  });

  it('should load action fragments via getFragmentsForCategory', () => {
    const fragments = mgr.getFragmentsForCategory('action');
    expect(fragments).toBeDefined();
    expect(fragments.length).toBeGreaterThanOrEqual(6);
  });

  it('should include action category in getAllFragments', () => {
    const allFragments = mgr.getAllFragments();
    expect(allFragments.has('action')).toBe(true);
  });
});
