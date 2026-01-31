import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadTemplate, clearTemplateCache } from '../../src/template/loader.js';
import type { TemplateDocument } from '../../src/template/types.js';

// We'll mock fs and js-yaml
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('js-yaml', () => ({
  default: { load: vi.fn() },
}));

import { readFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

const sampleDoc: TemplateDocument = {
  meta: { agent: 'writer', version: 1 },
  system: { sections: [{ type: 'text', text: 'hello' }] },
  user: { sections: [{ type: 'text', text: 'prompt' }] },
};

describe('loadTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTemplateCache();
  });

  it('loads and parses a YAML template file', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('yaml content');
    (yaml.load as ReturnType<typeof vi.fn>).mockReturnValue(sampleDoc);

    const result = loadTemplate('writer');
    expect(result).toEqual(sampleDoc);
    expect(readFileSync).toHaveBeenCalled();
  });

  it('throws when template file does not exist', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    expect(() => loadTemplate('nonexistent')).toThrow();
  });

  it('caches loaded templates on repeated calls', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('yaml');
    (yaml.load as ReturnType<typeof vi.fn>).mockReturnValue(sampleDoc);

    loadTemplate('writer');
    loadTemplate('writer');
    // readFileSync should only be called once due to caching
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });

  it('loads section templates with section: prefix', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('yaml');
    (yaml.load as ReturnType<typeof vi.fn>).mockReturnValue(sampleDoc);

    loadTemplate('section:constitution');
    const callPath = (readFileSync as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(callPath).toContain('sections');
    expect(callPath).toContain('constitution');
  });
});
