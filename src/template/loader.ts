import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { TemplateDocument, TemplateKind } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_EXTENSIONS = ['.yaml', '.yml', '.json'] as const;
const TEMPLATE_DIRS: Record<TemplateKind, string> = {
  agent: 'agents',
  section: 'sections',
  pipeline: 'pipeline',
};

const cache = new Map<string, TemplateDocument>();

function normalizeKind(kind: string): TemplateKind {
  if (kind === 'agent' || kind === 'section' || kind === 'pipeline') {
    return kind;
  }
  throw new Error(`Unknown template kind: ${kind}`);
}

function normalizeArgs(kindOrName: string, maybeName?: string): { kind: TemplateKind; name: string } {
  if (maybeName != null) {
    return { kind: normalizeKind(kindOrName), name: maybeName };
  }

  if (kindOrName.startsWith('section:')) {
    return { kind: 'section', name: kindOrName.slice('section:'.length) };
  }
  if (kindOrName.startsWith('pipeline:')) {
    return { kind: 'pipeline', name: kindOrName.slice('pipeline:'.length) };
  }
  if (kindOrName.startsWith('agent:')) {
    return { kind: 'agent', name: kindOrName.slice('agent:'.length) };
  }

  // Backward compatibility: loadTemplate(name) defaults to agent templates.
  return { kind: 'agent', name: kindOrName };
}

function resolveTemplatePath(kind: TemplateKind, name: string): string {
  const basePath = join(__dirname, '..', 'prompts', TEMPLATE_DIRS[kind], name);
  for (const ext of TEMPLATE_EXTENSIONS) {
    const filePath = `${basePath}${ext}`;
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  throw new Error(`Template not found: ${basePath}{${TEMPLATE_EXTENSIONS.join(',')}}`);
}

function parseTemplate(raw: string, filePath: string): TemplateDocument {
  const rawObj = filePath.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw);
  if (!rawObj || typeof rawObj !== 'object') {
    throw new Error(`Invalid template structure in: ${filePath}`);
  }
  return rawObj as TemplateDocument;
}

export function loadTemplate(name: string): TemplateDocument;
export function loadTemplate(kind: TemplateKind, name: string): TemplateDocument;
export function loadTemplate(kindOrName: string, maybeName?: string): TemplateDocument {
  const { kind, name } = normalizeArgs(kindOrName, maybeName);
  const cacheKey = `${kind}:${name}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const filePath = resolveTemplatePath(kind, name);
  const raw = readFileSync(filePath, 'utf-8');
  const doc = parseTemplate(raw, filePath);

  cache.set(cacheKey, doc);
  return doc;
}

/** Clear the template cache (useful for testing) */
export function clearTemplateCache(): void {
  cache.clear();
}
