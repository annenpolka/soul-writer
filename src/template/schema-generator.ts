import { z } from 'zod';
import { GeneratedThemeSchema } from '../schemas/generated-theme.js';
import { PlotSchema } from '../schemas/plot.js';

const schemaRegistry: Record<string, z.ZodType> = {
  'generated-theme': GeneratedThemeSchema,
  'plot': PlotSchema,
};

function generateExample(schema: z.ZodType): unknown {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const obj: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      obj[key] = generateExample(fieldSchema);
    }
    return obj;
  }
  if (schema instanceof z.ZodArray) {
    return [generateExample(schema.element)];
  }
  if (schema instanceof z.ZodString) {
    return '';
  }
  if (schema instanceof z.ZodNumber) {
    return 0;
  }
  if (schema instanceof z.ZodBoolean) {
    return false;
  }
  if (schema instanceof z.ZodOptional) {
    return generateExample(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    // Use removeDefault() to get inner type, generate from that
    return generateExample(schema.removeDefault());
  }
  return null;
}

export function generateSchemaExample(schemaName: string): string {
  const schema = schemaRegistry[schemaName];
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }
  return JSON.stringify(generateExample(schema), null, 2);
}
