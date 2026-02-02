/**
 * Creates a mock Constitution with the new universal/protagonist_specific structure.
 * Accepts partial overrides for customization in individual tests.
 */
export function createMockConstitution(overrides) {
    return {
        meta: { soul_id: 'test', soul_name: 'Test Soul', version: '1.0.0', created_at: '', updated_at: '' },
        universal: {
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
            thematic_constraints: {
                must_preserve: [],
                forbidden_resolutions: [],
            },
            new_character_guide: {
                description: 'test guide',
                rules: ['rule1'],
            },
        },
        protagonist_specific: {
            sentence_structure: {
                rhythm_pattern: 'test',
                taigendome: { usage: 'test', frequency: 'test', forbidden_context: [] },
                typical_lengths: { short: 'test', long: 'test', forbidden: 'test' },
            },
            narrative: {
                default_pov: 'test',
                pov_by_character: {},
                default_tense: 'test',
                tense_shift_allowed: 'test',
                dialogue_ratio: 'test',
                dialogue_style_by_character: {},
            },
            scene_modes: {
                mundane: { description: 'test', style: 'test' },
                tension: { description: 'test', style: 'test' },
            },
            dry_humor: {
                description: 'test',
                techniques: ['test'],
                frequency: 'test',
            },
        },
        ...overrides,
    };
}
