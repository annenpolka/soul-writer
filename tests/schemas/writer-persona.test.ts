import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WriterPersonaSchema, WriterPersonasSchema } from '../../src/schemas/writer-persona.js';

describe('WriterPersonaSchema', () => {
  it('should accept valid persona', () => {
    const result = WriterPersonaSchema.safeParse({
      id: 'test',
      name: 'テスト',
      directive: 'あ'.repeat(200),
      focusCategories: ['opening'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject short directive', () => {
    const result = WriterPersonaSchema.safeParse({
      id: 'test',
      name: 'テスト',
      directive: 'too short',
    });
    expect(result.success).toBe(false);
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
  it('should reject fewer than 4 personas', () => {
    const result = WriterPersonasSchema.safeParse({
      personas: [
        { id: 'a', name: 'A', directive: 'あ'.repeat(200) },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('soul/writer-personas.json', () => {
  it('should validate against schema', () => {
    const raw = readFileSync(resolve('soul/writer-personas.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const result = WriterPersonasSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personas).toHaveLength(8);
    }
  });
});
