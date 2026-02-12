import { z } from 'zod';

export const DefectDetectorResponseSchema = z.object({
  verdict_level: z.enum(['exceptional', 'publishable', 'acceptable', 'needs_work', 'unacceptable']),
  defects: z.array(z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    category: z.string(),
    description: z.string(),
    location: z.string().optional(),
    quoted_text: z.string().optional(),
    suggested_fix: z.string().optional(),
  })),
});

export type DefectDetectorRawResponse = z.infer<typeof DefectDetectorResponseSchema>;
