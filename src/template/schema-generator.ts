import { z } from 'zod';
import { GeneratedThemeSchema } from '../schemas/generated-theme.js';
import { PlotSchema } from '../schemas/plot.js';

type SomeZodType = z.core.$ZodType;

const schemaRegistry: Record<string, SomeZodType> = {
  'generated-theme': GeneratedThemeSchema,
  'plot': PlotSchema,
};

function generateExample(schema: SomeZodType): unknown {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, SomeZodType>;
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
    return generateExample(schema.unwrap());
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
