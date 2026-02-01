import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WriterPersonaSchema, WriterPersonasSchema } from '../../src/schemas/writer-persona.js';

describe('WriterPersonaSchema', () => {
  it('should accept valid persona with directive', () => {
    const result = WriterPersonaSchema.safeParse({
      id: 'test',
      name: 'テスト',
      directive: 'あ'.repeat(200),
      focusCategories: ['opening'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept persona without directive', () => {
    const result = WriterPersonaSchema.safeParse({
      id: 'test',
      name: 'テスト',
      focusCategories: ['opening'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing id', () => {
    const result = WriterPersonaSchema.safeParse({
      name: 'テスト',
      directive: 'あ'.repeat(200),
    });
    expect(result.success).toBe(false);
  });
});

describe('WriterPersonasSchema', () => {
  it('should accept 1 or more personas', () => {
    const result = WriterPersonasSchema.safeParse({
      personas: [
        { id: 'a', name: 'A' },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('soul/writer-personas.json', () => {
  it('should validate against schema', () => {
    const raw = readFileSync(resolve('soul/writer-personas.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const result = WriterPersonasSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personas).toHaveLength(4);
    }
  });
});

describe('soul/collab-personas.json', () => {
  it('should validate against schema', () => {
    const raw = readFileSync(resolve('soul/collab-personas.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const result = WriterPersonasSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personas).toHaveLength(5);
      // All collab personas should have directives
      for (const p of result.data.personas) {
        expect(p.directive).toBeDefined();
      }
    }
  });
});
