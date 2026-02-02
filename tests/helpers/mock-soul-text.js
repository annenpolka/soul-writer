import { DEFAULT_PROMPT_CONFIG } from '../../src/schemas/prompt-config.js';
import { createMockConstitution } from './mock-constitution.js';
function deepMerge(base, override) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
        const val = override[key];
        if (val !== undefined && typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Map)) {
            result[key] = deepMerge((base[key] ?? {}), val);
        }
        else if (val !== undefined) {
            result[key] = val;
        }
    }
    return result;
}
/**
 * Creates a mock SoulText with the new universal/protagonist_specific constitution structure.
 * Supports both shorthand overrides and deep structural overrides.
 */
export function createMockSoulText(options) {
    const base = {
        constitution: createMockConstitution(),
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
                ar_reality_cliche: [],
            },
        },
        readerPersonas: {
            personas: [
                {
                    id: 'sf_fan',
                    name: 'SF愛好家',
                    description: 'SFの技術的整合性を重視する読者',
                    preferences: ['世界設定の緻密さ'],
                    evaluation_weights: { style: 0.2, plot: 0.2, character: 0.2, worldbuilding: 0.3, readability: 0.1 },
                },
                {
                    id: 'literary_girl',
                    name: '文学少女',
                    description: '文体の美しさを重視する読者',
                    preferences: ['文体の美しさ', '心理描写'],
                    evaluation_weights: { style: 0.35, plot: 0.15, character: 0.3, worldbuilding: 0.1, readability: 0.1 },
                },
                {
                    id: 'light_reader',
                    name: 'ライトリーダー',
                    description: 'テンポを重視する読者',
                    preferences: ['テンポ', '読みやすさ'],
                    evaluation_weights: { style: 0.1, plot: 0.3, character: 0.2, worldbuilding: 0.1, readability: 0.3 },
                },
                {
                    id: 'editor',
                    name: '編集者',
                    description: '商業的価値を重視',
                    preferences: ['構成', '商業的価値'],
                    evaluation_weights: { style: 0.2, plot: 0.3, character: 0.2, worldbuilding: 0.15, readability: 0.15 },
                },
            ],
        },
        writerPersonas: [],
        fragments: new Map(),
        promptConfig: DEFAULT_PROMPT_CONFIG,
    };
    if (!options)
        return base;
    // Apply shorthand overrides
    if (options.forbiddenWords) {
        base.constitution.universal.vocabulary.forbidden_words = options.forbiddenWords;
    }
    if (options.forbiddenSimiles) {
        base.constitution.universal.rhetoric.forbidden_similes = options.forbiddenSimiles;
    }
    if (options.thematicMustPreserve) {
        base.constitution.universal.thematic_constraints.must_preserve = options.thematicMustPreserve;
    }
    if (options.characters) {
        base.worldBible.characters = options.characters;
    }
    // Apply deep overrides
    if (options.deep) {
        return deepMerge(base, options.deep);
    }
    return base;
}
