import { describe, it, expect } from 'vitest';
import type {
  ImprovementAction,
  ImprovementPlan,
  SynthesisAnalyzerInput,
  SynthesisAnalyzerDeps,
  SynthesisAnalyzer,
  SynthesisExecutorDeps,
  SynthesisExecutorFn,
  SynthesizerV2,
  SynthesisV2Result,
} from '../../src/agents/types.js';
import type { GenerationResult } from '../../src/agents/types.js';
import type { MatchResult } from '../../src/tournament/arena.js';

describe('Synthesis V2 Type Definitions', () => {
  describe('ImprovementAction', () => {
    it('should accept valid action types', () => {
      const action: ImprovementAction = {
        section: '導入',
        type: 'expression_upgrade',
        description: '比喩表現を強化',
        source: 'writer_2',
        priority: 'high',
      };
      expect(action.section).toBe('導入');
      expect(action.type).toBe('expression_upgrade');
      expect(action.priority).toBe('high');
    });

    it('should accept all defined action types', () => {
      const types: ImprovementAction['type'][] = [
        'expression_upgrade',
        'pacing_adjustment',
        'scene_reorder',
        'motif_fix',
        'voice_refinement',
        'imagery_injection',
        'tension_enhancement',
      ];
      expect(types).toHaveLength(7);
    });

    it('should accept all priority levels', () => {
      const priorities: ImprovementAction['priority'][] = ['high', 'medium', 'low'];
      expect(priorities).toHaveLength(3);
    });
  });

  describe('ImprovementPlan', () => {
    it('should contain championAssessment, preserveElements, and actions', () => {
      const plan: ImprovementPlan = {
        championAssessment: '勝者テキストは文体が優れている',
        preserveElements: ['冒頭の比喩', 'ペーシング'],
        actions: [
          {
            section: '展開',
            type: 'imagery_injection',
            description: 'ARタグの視覚描写を追加',
            source: 'writer_3',
            priority: 'medium',
          },
        ],
        expressionSources: [
          {
            writerId: 'writer_2',
            expressions: ['月光が砕けた'],
            context: '情景描写のクライマックス',
          },
        ],
      };
      expect(plan.championAssessment).toBeDefined();
      expect(plan.preserveElements).toHaveLength(2);
      expect(plan.actions).toHaveLength(1);
      expect(plan.expressionSources).toHaveLength(1);
    });

    it('should allow optional structuralChanges', () => {
      const plan: ImprovementPlan = {
        championAssessment: 'assessment',
        preserveElements: [],
        actions: [],
        structuralChanges: ['シーン2と3を入れ替え'],
        expressionSources: [],
      };
      expect(plan.structuralChanges).toHaveLength(1);
    });

    it('should work without optional structuralChanges', () => {
      const plan: ImprovementPlan = {
        championAssessment: 'assessment',
        preserveElements: [],
        actions: [],
        expressionSources: [],
      };
      expect(plan.structuralChanges).toBeUndefined();
    });
  });

  describe('SynthesisAnalyzerInput', () => {
    it('should contain champion info and all generations', () => {
      const generations: GenerationResult[] = [
        { writerId: 'writer_1', text: 'text1', tokensUsed: 100 },
        { writerId: 'writer_2', text: 'text2', tokensUsed: 100 },
      ];
      const rounds: MatchResult[] = [
        {
          matchName: 'semi_1',
          contestantA: 'writer_1',
          contestantB: 'writer_2',
          winner: 'writer_1',
          judgeResult: {
            winner: 'A',
            reasoning: 'A is better',
            scores: {
              A: { style: 0.8, compliance: 0.9, overall: 0.85 },
              B: { style: 0.6, compliance: 0.7, overall: 0.65 },
            },
          },
        },
      ];

      const input: SynthesisAnalyzerInput = {
        championText: 'text1',
        championId: 'writer_1',
        allGenerations: generations,
        rounds,
      };
      expect(input.championText).toBe('text1');
      expect(input.championId).toBe('writer_1');
      expect(input.allGenerations).toHaveLength(2);
      expect(input.rounds).toHaveLength(1);
    });

    it('should accept optional plotContext', () => {
      const input: SynthesisAnalyzerInput = {
        championText: 'text1',
        championId: 'writer_1',
        allGenerations: [],
        rounds: [],
        plotContext: {
          chapter: {
            index: 1,
            title: '第一章',
            summary: 'summary',
            key_events: ['event1'],
            target_length: 4000,
          },
        },
      };
      expect(input.plotContext?.chapter?.title).toBe('第一章');
    });

    it('should accept optional chapterContext', () => {
      const input: SynthesisAnalyzerInput = {
        championText: 'text1',
        championId: 'writer_1',
        allGenerations: [],
        rounds: [],
        chapterContext: {
          previousChapterTexts: ['前章のテキスト'],
        },
      };
      expect(input.chapterContext?.previousChapterTexts).toHaveLength(1);
    });
  });

  describe('SynthesisAnalyzerDeps', () => {
    it('should extend AgentDeps with optional narrativeRules, themeContext, macGuffinContext', () => {
      // Type-level test: SynthesisAnalyzerDeps requires llmClient and soulText
      const deps: SynthesisAnalyzerDeps = {
        llmClient: {} as any,
        soulText: {} as any,
        narrativeRules: undefined,
        themeContext: undefined,
        macGuffinContext: undefined,
      };
      expect(deps.llmClient).toBeDefined();
      expect(deps.soulText).toBeDefined();
    });
  });

  describe('SynthesisAnalyzer', () => {
    it('should have an analyze method returning plan and tokensUsed', async () => {
      const analyzer: SynthesisAnalyzer = {
        analyze: async (_input) => ({
          plan: {
            championAssessment: 'good',
            preserveElements: [],
            actions: [],
            expressionSources: [],
          },
          tokensUsed: 500,
        }),
      };
      const result = await analyzer.analyze({
        championText: '',
        championId: '',
        allGenerations: [],
        rounds: [],
      });
      expect(result.plan).toBeDefined();
      expect(result.tokensUsed).toBe(500);
    });
  });

  describe('SynthesisExecutorDeps', () => {
    it('should extend AgentDeps with optional narrativeRules and themeContext', () => {
      const deps: SynthesisExecutorDeps = {
        llmClient: {} as any,
        soulText: {} as any,
        narrativeRules: undefined,
        themeContext: undefined,
      };
      expect(deps.llmClient).toBeDefined();
    });
  });

  describe('SynthesisExecutorFn', () => {
    it('should have an execute method returning synthesizedText and tokensUsed', async () => {
      const executor: SynthesisExecutorFn = {
        execute: async (_text, _plan) => ({
          synthesizedText: 'improved text',
          tokensUsed: 300,
        }),
      };
      const result = await executor.execute('text', {
        championAssessment: '',
        preserveElements: [],
        actions: [],
        expressionSources: [],
      });
      expect(result.synthesizedText).toBe('improved text');
      expect(result.tokensUsed).toBe(300);
    });
  });

  describe('SynthesizerV2', () => {
    it('should have a synthesize method returning SynthesisV2Result', async () => {
      const synth: SynthesizerV2 = {
        synthesize: async (_input) => ({
          synthesizedText: 'final text',
          plan: null,
          totalTokensUsed: 0,
        }),
      };
      const result = await synth.synthesize({
        championText: '',
        championId: '',
        allGenerations: [],
        rounds: [],
      });
      expect(result.synthesizedText).toBe('final text');
      expect(result.plan).toBeNull();
      expect(result.totalTokensUsed).toBe(0);
    });
  });

  describe('SynthesisV2Result', () => {
    it('should contain synthesizedText, plan, and totalTokensUsed', () => {
      const result: SynthesisV2Result = {
        synthesizedText: 'text',
        plan: {
          championAssessment: 'assessment',
          preserveElements: ['element'],
          actions: [],
          expressionSources: [],
        },
        totalTokensUsed: 800,
      };
      expect(result.synthesizedText).toBe('text');
      expect(result.plan?.championAssessment).toBe('assessment');
      expect(result.totalTokensUsed).toBe(800);
    });

    it('should allow null plan (for early return cases)', () => {
      const result: SynthesisV2Result = {
        synthesizedText: 'champion text',
        plan: null,
        totalTokensUsed: 0,
      };
      expect(result.plan).toBeNull();
    });
  });
});
