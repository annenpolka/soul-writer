import { describe, it, expect, vi } from 'vitest';

/**
 * Test that SUBMIT_IMPROVEMENT_PLAN_TOOL includes 'agency_boost' in enum.
 * We access the tool schema indirectly through createSynthesisAnalyzer and the
 * mock LLM to verify the tool definition contains the expected enum value.
 */

describe('SUBMIT_IMPROVEMENT_PLAN_TOOL - agency_boost enum', () => {
  it('should include agency_boost in the actions type enum', async () => {
    // Dynamically import to get the module with the tool definition
    const mod = await import('../../src/synthesis/synthesis-analyzer.js');
    const deps = {
      llmClient: {
        complete: vi.fn(),
        completeWithTools: vi.fn().mockResolvedValue({
          toolCalls: [{
            function: {
              name: 'submit_improvement_plan',
              arguments: JSON.stringify({
                championAssessment: 'test',
                preserveElements: [],
                actions: [],
                expressionSources: [],
              }),
            },
          }],
        }),
        getTotalTokens: vi.fn().mockReturnValue(0),
        isToolCallingClient: true,
      },
      soulText: (await import('../helpers/mock-soul-text.js')).createMockSoulText(),
    };

    const analyzer = mod.createSynthesisAnalyzer(deps as any);
    await analyzer.analyze({
      championText: 'test',
      championId: 'writer_1',
      allGenerations: [
        { writerId: 'writer_1', text: 'test1', tokensUsed: 10 },
        { writerId: 'writer_2', text: 'test2', tokensUsed: 10 },
      ],
      rounds: [{
        matchName: 'semi_1',
        contestantA: 'writer_1',
        contestantB: 'writer_2',
        winner: 'writer_1',
        judgeResult: {
          winner: 'A' as const,
          reasoning: 'test',
          scores: {
            A: { style: 0.8, compliance: 0.9, overall: 0.85 },
            B: { style: 0.6, compliance: 0.7, overall: 0.65 },
          },
        },
      }],
    });

    // Extract the tool definition from the completeWithTools call
    const call = (deps.llmClient.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0];
    const tools = call[2] as Array<{ type: string; function: { parameters: any } }>;
    const toolParams = tools[0].function.parameters;
    const actionTypeEnum = toolParams.properties.actions.items.properties.type.enum as string[];

    expect(actionTypeEnum).toContain('agency_boost');
  });
});
