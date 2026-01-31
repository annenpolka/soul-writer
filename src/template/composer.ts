import type { TemplateContext } from './types.js';
import { loadTemplate } from './loader.js';
import { renderSections } from './renderer.js';

export interface PromptResult {
  system: string;
  user: string;
}

export function buildPrompt(agentName: string, context: TemplateContext): PromptResult {
  const doc = loadTemplate(agentName);

  return {
    system: renderSections(doc.system.sections, context),
    user: renderSections(doc.user.sections, context),
  };
}
