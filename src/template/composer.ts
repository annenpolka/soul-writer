import type { TemplateContext, TemplateKind, TemplateDocument, TemplateBlock } from './types.js';
import { loadTemplate } from './loader.js';
import { renderSections } from './renderer.js';

export interface PromptResult {
  system: string;
  user: string;
}

export type NonAgentTemplateKind = Exclude<TemplateKind, 'agent'>;
export type TemplateBlockResult = Record<string, string>;

function renderTemplateBlock(block: TemplateBlock, context: TemplateContext): string {
  return renderSections(block.sections, context);
}

function renderTemplateString(template: string, context: TemplateContext): string {
  return renderSections([{ type: 'text', text: template }], context);
}

function renderDocumentBlocks(doc: TemplateDocument, context: TemplateContext): TemplateBlockResult {
  if (doc.blocks && Object.keys(doc.blocks).length > 0) {
    const renderedBlocks: TemplateBlockResult = {};
    for (const [name, block] of Object.entries(doc.blocks)) {
      renderedBlocks[name] = renderTemplateBlock(block, context);
    }
    return renderedBlocks;
  }

  if (doc.templates && Object.keys(doc.templates).length > 0) {
    const renderedTemplates: TemplateBlockResult = {};
    for (const [name, template] of Object.entries(doc.templates)) {
      renderedTemplates[name] = renderTemplateString(template, context);
    }
    return renderedTemplates;
  }

  if (doc.system && doc.user) {
    return {
      system: renderTemplateBlock(doc.system, context),
      user: renderTemplateBlock(doc.user, context),
    };
  }

  throw new Error('Template document has no renderable blocks');
}

export function buildPrompt(agentName: string, context: TemplateContext): PromptResult {
  const doc = loadTemplate('agent', agentName);
  if (!doc.system || !doc.user) {
    throw new Error(`Agent template '${agentName}' is missing system/user blocks`);
  }

  return {
    system: renderTemplateBlock(doc.system, context),
    user: renderTemplateBlock(doc.user, context),
  };
}

export function buildTemplateBlocks(
  kind: NonAgentTemplateKind,
  templateName: string,
  context: TemplateContext
): TemplateBlockResult {
  const doc = loadTemplate(kind, templateName);
  return renderDocumentBlocks(doc, context);
}

export function buildTemplateBlock(
  kind: NonAgentTemplateKind,
  templateName: string,
  blockName: string,
  context: TemplateContext
): string {
  const blocks = buildTemplateBlocks(kind, templateName, context);
  const block = blocks[blockName];
  if (block == null) {
    throw new Error(`Template block not found: ${kind}:${templateName}.${blockName}`);
  }
  return block;
}
