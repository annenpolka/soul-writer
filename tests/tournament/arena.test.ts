import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TournamentArena } from '../../src/tournament/arena.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';

// Mock LLM Client
let callCount = 0;
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockImplementation(() => {
    callCount++;
    // Writers return different texts
    if (callCount <= 4) {
      return Promise.resolve(`Generated text from writer ${callCount}`);
    }
    // Judges return evaluation results
    const isFirstMatch = callCount <= 6;
    return Promise.resolve(
      JSON.stringify({
        winner: isFirstMatch ? 'A' : 'B',
        reasoning: 'Test reasoning',
        scores: {
          A: { style: 0.8, compliance: 0.9, overall: 0.85 },
          B: { style: 0.7, compliance: 0.8, overall: 0.75 },
        },
      })
    );
  }),
  getTotalTokens: vi.fn().mockReturnValue(500),
};

// Mock Soul Text
const mockSoulText: SoulText = {
  constitution: {
    meta: { soul_id: 'test', soul_name: 'Test Soul', version: '1.0.0', created_at: '', updated_at: '' },
    sentence_structure: {
      rhythm_pattern: 'test',
      taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
      typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
    },
    vocabulary: {
      bracket_notations: [],
      forbidden_words: [],
      characteristic_expressions: [],
      special_marks: { mark: '×', usage: 'test', forms: [] },
    },
    rhetoric: {
      simile_base: 'test',
      metaphor_density: 'low',
      forbidden_similes: [],
      personification_allowed_for: [],
    },
    narrative: {
      default_pov: 'test',
      pov_by_character: {},
      default_tense: 'test',
      tense_shift_allowed: 'test',
      dialogue_ratio: 'test',
      dialogue_style_by_character: {},
    },
    thematic_constraints: {
      must_preserve: [],
      forbidden_resolutions: [],
    },
  },
  worldBible: {
    technology: {},
    society: {},
    characters: {},
    terminology: {},
    locations: {},
  },
  antiSoul: {
    categories: {
      theme_violation: [],
      mentor_tsurgi: [],
      lion_concretization: [],
      excessive_sentiment: [],
      explanatory_worldbuilding: [],
      character_normalization: [],
      cliche_simile: [],
    },
  },
  readerPersonas: { personas: [] },
  fragments: new Map(),
};

describe('TournamentArena', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;
  });

  describe('constructor', () => {
    it('should create a tournament arena', () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      expect(arena).toBeInstanceOf(TournamentArena);
    });
  });

  describe('runTournament', () => {
    it('should run a tournament with 4 writers', async () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      const result = await arena.runTournament('Write a scene');

      expect(result).toBeDefined();
      expect(result.champion).toBeDefined();
      expect(result.championText).toBeDefined();
      expect(result.rounds).toHaveLength(3); // 2 semifinals + 1 final
    });

    it('should have correct tournament structure', async () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      const result = await arena.runTournament('Write a scene');

      // Check rounds
      const [semi1, semi2, final] = result.rounds;
      expect(semi1.matchName).toBe('semifinal_1');
      expect(semi2.matchName).toBe('semifinal_2');
      expect(final.matchName).toBe('final');
    });

    it('should track all generated texts', async () => {
      const arena = new TournamentArena(mockLLMClient, mockSoulText);
      const result = await arena.runTournament('Write a scene');

      expect(result.allGenerations).toHaveLength(4);
      expect(result.allGenerations.map((g) => g.writerId)).toEqual([
        'writer_1',
        'writer_2',
        'writer_3',
        'writer_4',
      ]);
    });
  });
});
