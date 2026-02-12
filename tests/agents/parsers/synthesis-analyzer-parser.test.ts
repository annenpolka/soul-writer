import { describe, it, expect } from 'vitest';
import { parseSynthesisAnalyzerResponse, createFallbackPlan } from '../../../src/agents/parsers/synthesis-analyzer-parser.js';
import type { StructuredResponse } from '../../../src/llm/types.js';
import type { ImprovementPlanRaw } from '../../../src/schemas/improvement-plan.js';

function makeStructuredResponse(data: ImprovementPlanRaw): StructuredResponse<ImprovementPlanRaw> {
  return {
    data,
    reasoning: null,
    tokensUsed: 100,
  };
}

describe('parseSynthesisAnalyzerResponse', () => {
  it('should parse a valid ImprovementPlan from structured response', () => {
    const data: ImprovementPlanRaw = {
      championAssessment: '勝者テキストの文体が一貫しており強い',
      preserveElements: ['冒頭の比喩', '透心の内面描写'],
      actions: [
        {
          section: '展開',
          type: 'expression_upgrade',
          description: 'writer_2の情景描写を取り入れ',
          source: 'writer_2',
          priority: 'high',
        },
        {
          section: '結末',
          type: 'tension_enhancement',
          description: 'クライマックスの緊張感を強化',
          source: 'writer_3',
          priority: 'medium',
        },
      ],
      structuralChanges: ['シーン2の後に一拍入れる'],
      expressionSources: [
        {
          writerId: 'writer_2',
          expressions: ['月光が砕けた', 'ARの残像'],
          context: '情景描写',
        },
      ],
    };

    const plan = parseSynthesisAnalyzerResponse(makeStructuredResponse(data));

    expect(plan.championAssessment).toBe('勝者テキストの文体が一貫しており強い');
    expect(plan.preserveElements).toHaveLength(2);
    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[0].type).toBe('expression_upgrade');
    expect(plan.actions[0].priority).toBe('high');
    expect(plan.structuralChanges).toHaveLength(1);
    expect(plan.expressionSources).toHaveLength(1);
    expect(plan.expressionSources[0].writerId).toBe('writer_2');
  });

  it('should validate action types', () => {
    const validTypes = [
      'expression_upgrade', 'pacing_adjustment', 'scene_reorder',
      'motif_fix', 'voice_refinement', 'imagery_injection', 'tension_enhancement',
    ] as const;

    for (const type of validTypes) {
      const data: ImprovementPlanRaw = {
        championAssessment: 'test',
        preserveElements: [],
        actions: [{ section: 's', type, description: 'd', source: 'w', priority: 'high' }],
        expressionSources: [],
      };
      const plan = parseSynthesisAnalyzerResponse(makeStructuredResponse(data));
      expect(plan.actions[0].type).toBe(type);
    }
  });

  it('should validate priority levels', () => {
    const validPriorities = ['high', 'medium', 'low'] as const;

    for (const priority of validPriorities) {
      const data: ImprovementPlanRaw = {
        championAssessment: 'test',
        preserveElements: [],
        actions: [{ section: 's', type: 'expression_upgrade', description: 'd', source: 'w', priority }],
        expressionSources: [],
      };
      const plan = parseSynthesisAnalyzerResponse(makeStructuredResponse(data));
      expect(plan.actions[0].priority).toBe(priority);
    }
  });

  it('should handle empty actions array', () => {
    const data: ImprovementPlanRaw = {
      championAssessment: 'テキストは優れている',
      preserveElements: ['全体の構成'],
      actions: [],
      expressionSources: [],
    };
    const plan = parseSynthesisAnalyzerResponse(makeStructuredResponse(data));
    expect(plan.actions).toHaveLength(0);
    expect(plan.championAssessment).toBe('テキストは優れている');
  });

  it('should work without optional structuralChanges', () => {
    const data: ImprovementPlanRaw = {
      championAssessment: 'test',
      preserveElements: [],
      actions: [],
      expressionSources: [],
    };
    const plan = parseSynthesisAnalyzerResponse(makeStructuredResponse(data));
    expect(plan.structuralChanges).toBeUndefined();
  });

  describe('createFallbackPlan', () => {
    it('should return a valid empty plan', () => {
      const plan = createFallbackPlan();
      expect(plan.championAssessment).toBeDefined();
      expect(plan.preserveElements).toHaveLength(0);
      expect(plan.actions).toHaveLength(0);
      expect(plan.expressionSources).toHaveLength(0);
    });
  });
});
