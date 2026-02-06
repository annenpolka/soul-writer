import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReaderJury } from '../../src/agents/reader-jury.js';
import type { ReaderJuryDeps } from '../../src/agents/types.js';
import type { ReaderPersona } from '../../src/schemas/reader-personas.js';
import { createMockLLMClientWithTools } from '../helpers/mock-deps.js';
import { createMockSoulText } from '../helpers/mock-soul-text.js';

function createMockPersonas(): ReaderPersona[] {
  return [
    {
      id: 'persona_1',
      name: 'Persona 1',
      description: 'First test persona',
      preferences: ['pref1'],
      evaluation_weights: { style: 0.2, plot: 0.2, character: 0.2, worldbuilding: 0.2, readability: 0.2 },
    },
    {
      id: 'persona_2',
      name: 'Persona 2',
      description: 'Second test persona',
      preferences: ['pref2'],
      evaluation_weights: { style: 0.3, plot: 0.1, character: 0.3, worldbuilding: 0.1, readability: 0.2 },
    },
  ];
}

function createMockReaderJuryDeps(overrides?: {
  tokenCount?: number;
  personas?: ReaderPersona[];
}): ReaderJuryDeps {
  const toolResponse = {
    name: 'submit_reader_evaluation',
    arguments: {
      categoryScores: { style: 0.9, plot: 0.9, character: 0.9, worldbuilding: 0.9, readability: 0.9 },
      feedback: { strengths: 'Excellent', weaknesses: 'Minor issues', suggestion: 'Keep it up' },
    },
  };
  return {
    llmClient: createMockLLMClientWithTools(toolResponse, overrides?.tokenCount),
    soulText: createMockSoulText(),
    personas: overrides?.personas ?? createMockPersonas(),
  };
}

describe('createReaderJury (FP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a ReaderJury with evaluate method', () => {
    const deps = createMockReaderJuryDeps();
    const jury = createReaderJury(deps);
    expect(jury.evaluate).toBeInstanceOf(Function);
  });

  it('should evaluate text with all personas', async () => {
    const deps = createMockReaderJuryDeps();
    const jury = createReaderJury(deps);

    const result = await jury.evaluate('test text');
    expect(result.evaluations).toHaveLength(2);
    expect(result.evaluations[0].personaId).toBe('persona_1');
    expect(result.evaluations[1].personaId).toBe('persona_2');
  });

  it('should calculate aggregated score', async () => {
    const deps = createMockReaderJuryDeps();
    const jury = createReaderJury(deps);

    const result = await jury.evaluate('test text');
    expect(result.aggregatedScore).toBeGreaterThan(0);
    expect(result.aggregatedScore).toBeLessThanOrEqual(1);
  });

  it('should pass when aggregated score >= 0.85', async () => {
    const deps = createMockReaderJuryDeps();
    const jury = createReaderJury(deps);

    const result = await jury.evaluate('test text');
    // With all scores at 0.9, aggregated should be ~0.9, which passes
    expect(result.passed).toBe(true);
  });

  it('should generate summary string', async () => {
    const deps = createMockReaderJuryDeps();
    const jury = createReaderJury(deps);

    const result = await jury.evaluate('test text');
    expect(result.summary).toContain('読者陪審員の評価');
    expect(result.summary).toContain('Persona 1');
    expect(result.summary).toContain('Persona 2');
  });

  it('should use soulText personas when none provided in deps', async () => {
    const soulText = createMockSoulText();
    const toolResponse = {
      name: 'submit_reader_evaluation',
      arguments: {
        categoryScores: { style: 0.9, plot: 0.9, character: 0.9, worldbuilding: 0.9, readability: 0.9 },
        feedback: { strengths: 'Good', weaknesses: 'None', suggestion: 'Keep going' },
      },
    };
    const deps: ReaderJuryDeps = {
      llmClient: createMockLLMClientWithTools(toolResponse),
      soulText,
      // no personas - should fall back to soulText.readerPersonas.personas
    };
    const jury = createReaderJury(deps);

    const result = await jury.evaluate('test text');
    // soulText has 4 personas by default
    expect(result.evaluations).toHaveLength(4);
  });

  it('should pass previousResult to individual evaluators', async () => {
    const deps = createMockReaderJuryDeps();
    const jury = createReaderJury(deps);

    const previousResult = {
      evaluations: [
        {
          personaId: 'persona_1',
          personaName: 'Persona 1',
          categoryScores: { style: 0.5, plot: 0.5, character: 0.5, worldbuilding: 0.5, readability: 0.5 },
          weightedScore: 0.5,
          feedback: { strengths: 'ok', weaknesses: 'ok', suggestion: 'ok' },
        },
      ],
      aggregatedScore: 0.5,
      passed: false,
      summary: 'previous summary',
    };

    const result = await jury.evaluate('test text', previousResult);
    expect(result.evaluations).toHaveLength(2);
  });
});
