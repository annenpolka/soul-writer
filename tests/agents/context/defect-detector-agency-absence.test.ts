import { describe, it, expect } from 'vitest';
import { buildDefectDetectorContext } from '../../../src/agents/context/defect-detector-context.js';
import { createMockSoulText } from '../../helpers/mock-soul-text.js';
import type { DefectDetectorContextInput } from '../../../src/agents/context/defect-detector-context.js';

describe('DEFECT_CATEGORIES - agency_absence', () => {
  it('should include agency_absence in defect categories', () => {
    const input: DefectDetectorContextInput = {
      soulText: createMockSoulText(),
      text: 'テスト対象テキスト',
    };
    const ctx = buildDefectDetectorContext(input);
    const categories = ctx.defectCategories as Array<{ name: string; description: string }>;
    const names = categories.map(c => c.name);

    expect(names).toContain('agency_absence');
  });

  it('should have appropriate description for agency_absence', () => {
    const input: DefectDetectorContextInput = {
      soulText: createMockSoulText(),
      text: 'テスト対象テキスト',
    };
    const ctx = buildDefectDetectorContext(input);
    const categories = ctx.defectCategories as Array<{ name: string; description: string }>;
    const agencyCategory = categories.find(c => c.name === 'agency_absence');

    expect(agencyCategory).toBeDefined();
    expect(agencyCategory!.description).toContain('能動的');
  });
});
