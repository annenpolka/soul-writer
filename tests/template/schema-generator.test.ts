import { describe, it, expect } from 'vitest';
import { generateSchemaExample } from '../../src/template/schema-generator.js';

describe('generateSchemaExample', () => {
  it('generates JSON example for generated-theme schema', () => {
    const result = generateSchemaExample('generated-theme');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('emotion');
    expect(parsed).toHaveProperty('timeline');
    expect(parsed).toHaveProperty('characters');
    expect(parsed).toHaveProperty('premise');
  });

  it('generates JSON example for plot schema', () => {
    const result = generateSchemaExample('plot');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('chapters');
  });

  it('throws for unknown schema name', () => {
    expect(() => generateSchemaExample('nonexistent')).toThrow();
  });

  it('returns valid JSON string', () => {
    const result = generateSchemaExample('generated-theme');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
