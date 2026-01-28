import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriterAgent, type WriterConfig } from '../../src/agents/writer.js';
import type { LLMClient } from '../../src/llm/types.js';
import type { SoulText } from '../../src/soul/manager.js';

// Mock LLM Client
const mockLLMClient: LLMClient = {
  complete: vi.fn().mockResolvedValue('Generated text from writer'),
  getTotalTokens: vi.fn().mockReturnValue(100),
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
      forbidden_words: ['とても'],
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
  antiSoul: { categories: {} },
  readerPersonas: { personas: [] },
  fragments: new Map(),
};

describe('WriterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a writer agent with default config', () => {
      const writer = new WriterAgent(mockLLMClient, mockSoulText);
      expect(writer).toBeInstanceOf(WriterAgent);
      expect(writer.getId()).toBe('writer_1');
    });

    it('should create a writer agent with custom config', () => {
      const config: WriterConfig = {
        id: 'custom_writer',
        temperature: 0.9,
        topP: 0.95,
        style: 'creative',
      };
      const writer = new WriterAgent(mockLLMClient, mockSoulText, config);
      expect(writer.getId()).toBe('custom_writer');
    });
  });

  describe('generate', () => {
    it('should generate text for a given prompt', async () => {
      const writer = new WriterAgent(mockLLMClient, mockSoulText);
      const result = await writer.generate('Write a scene about the morning');

      expect(result).toBe('Generated text from writer');
      expect(mockLLMClient.complete).toHaveBeenCalledOnce();
    });

    it('should use configured temperature and topP', async () => {
      const config: WriterConfig = {
        id: 'hot_writer',
        temperature: 0.9,
        topP: 0.95,
        style: 'creative',
      };
      const writer = new WriterAgent(mockLLMClient, mockSoulText, config);
      await writer.generate('Write something');

      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          temperature: 0.9,
          topP: 0.95,
        })
      );
    });
  });

  describe('DEFAULT_WRITERS', () => {
    it('should have 4 default writer configurations', async () => {
      const { DEFAULT_WRITERS } = await import('../../src/agents/writer.js');
      expect(DEFAULT_WRITERS).toHaveLength(4);
      expect(DEFAULT_WRITERS.map((w) => w.id)).toEqual([
        'writer_1',
        'writer_2',
        'writer_3',
        'writer_4',
      ]);
    });
  });
});
