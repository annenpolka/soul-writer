import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { TemplateDocument } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const cache = new Map<string, TemplateDocument>();

export function loadTemplate(name: string): TemplateDocument {
  if (cache.has(name)) {
    return cache.get(name)!;
  }

  let filePath: string;
  if (name.startsWith('section:')) {
    const sectionName = name.slice('section:'.length);
    filePath = join(__dirname, '..', 'prompts', 'sections', `${sectionName}.yaml`);
  } else {
    filePath = join(__dirname, '..', 'prompts', 'agents', `${name}.yaml`);
  }

  if (!existsSync(filePath)) {
    throw new Error(`Template not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf-8');
  const doc = yaml.load(raw) as TemplateDocument;

  cache.set(name, doc);
  return doc;
}

/** Clear the template cache (useful for testing) */
export function clearTemplateCache(): void {
  cache.clear();
}
