import type { Section, TemplateContext } from './types.js';
import { evaluateCondition } from './condition-evaluator.js';
import { applyFilter } from './filters.js';
import { loadTemplate } from './loader.js';

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, expr: string) => {
    // Check for filter pipe
    const pipeIndex = expr.indexOf('|');
    if (pipeIndex !== -1) {
      const path = expr.slice(0, pipeIndex).trim();
      const filterExpr = expr.slice(pipeIndex + 1).trim();
      const value = resolvePath(context as Record<string, unknown>, path);
      const result = applyFilter(value, filterExpr);
      return String(result ?? '');
    }

    const value = resolvePath(context as Record<string, unknown>, expr);
    if (value == null) return '';
    return String(value);
  });
}

function renderSection(section: Section, context: TemplateContext): string {
  switch (section.type) {
    case 'text':
      return interpolate(section.text, context);

    case 'heading': {
      const level = section.level ?? 2;
      const prefix = '#'.repeat(level);
      return `${prefix} ${interpolate(section.heading, context)}`;
    }

    case 'each': {
      const items = resolvePath(context as Record<string, unknown>, section.each);
      if (!Array.isArray(items)) return '';
      const limited = section.limit != null ? items.slice(0, section.limit) : items;
      return limited
        .map(item => {
          const childCtx = { ...context, [section.as]: item };
          if (section.sections) {
            return renderSections(section.sections, childCtx);
          }
          return interpolate(section.template ?? '', childCtx);
        })
        .join('\n');
    }

    case 'condition': {
      const result = evaluateCondition(section.if, context as Record<string, unknown>);
      if (result) {
        return renderSections(section.then, context);
      }
      if (section.else) {
        return renderSections(section.else, context);
      }
      return '';
    }

    case 'include': {
      const doc = loadTemplate(`section:${section.include}`);
      let childCtx = context;
      if (section.params) {
        const resolvedParams: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(section.params)) {
          if (typeof val === 'string') {
            // Pure reference like "{{ path }}" → resolve to actual value (may be object/array)
            const refMatch = val.match(/^\{\{\s*(.+?)\s*\}\}$/);
            if (refMatch && !val.includes('|')) {
              const resolved = resolvePath(context as Record<string, unknown>, refMatch[1]);
              resolvedParams[key] = resolved;
            } else if (val.includes('{{')) {
              resolvedParams[key] = interpolate(val, context);
            } else {
              resolvedParams[key] = val;
            }
          } else {
            resolvedParams[key] = val;
          }
        }
        childCtx = { ...context, ...resolvedParams };
      }
      return renderSections(doc.system.sections, childCtx);
    }

    case 'schema':
      // Delegate to schema-generator (handled externally)
      return `[schema:${section.source}:${section.format}]`;

    default:
      return '';
  }
}

export function renderSections(sections: Section[], context: TemplateContext): string {
  return sections
    .map(s => renderSection(s, context))
    .filter(s => s.length > 0)
    .join('\n');
}
