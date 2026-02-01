import { describe, it, expect } from 'vitest';
import { selectTournamentWriters, DEFAULT_TEMPERATURE_SLOTS } from '../../src/tournament/persona-pool.js';
import type { WriterPersona } from '../../src/schemas/writer-persona.js';

const makePersona = (id: string): WriterPersona => ({
  id,
  name: `テスト${id}`,
  directive: 'あ'.repeat(200),
  focusCategories: ['opening'],
});

const pool: WriterPersona[] = Array.from({ length: 8 }, (_, i) => makePersona(`p${i}`));

describe('selectTournamentWriters', () => {
  it('should select exactly 4 writers by default', () => {
    const result = selectTournamentWriters(pool);
    expect(result).toHaveLength(4);
  });

  it('should assign distinct temperature slots (dispersion guarantee)', () => {
    const result = selectTournamentWriters(pool);
    const temps = result.map(w => w.temperature);

    // Each writer should fall within its assigned slot range
    for (let i = 0; i < result.length; i++) {
      const slot = DEFAULT_TEMPERATURE_SLOTS[i];
      expect(temps[i]).toBeGreaterThanOrEqual(slot.range[0]);
      expect(temps[i]).toBeLessThanOrEqual(slot.range[1]);
    }
  });

  it('should populate personaDirective and personaName', () => {
    const result = selectTournamentWriters(pool);
    for (const writer of result) {
      expect(writer.personaDirective).toBeDefined();
      expect(writer.personaDirective!.length).toBeGreaterThanOrEqual(200);
      expect(writer.personaName).toBeDefined();
    }
  });

  it('should use focusCategories from persona', () => {
    const result = selectTournamentWriters(pool);
    for (const writer of result) {
      expect(writer.focusCategories).toEqual(['opening']);
    }
  });

  it('should produce different persona combinations across runs', () => {
    const ids1 = selectTournamentWriters(pool).map(w => w.id).sort();
    let different = false;
    for (let i = 0; i < 20; i++) {
      const ids2 = selectTournamentWriters(pool).map(w => w.id).sort();
      if (JSON.stringify(ids1) !== JSON.stringify(ids2)) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });

  it('should handle pool smaller than count', () => {
    const smallPool = pool.slice(0, 2);
    const result = selectTournamentWriters(smallPool);
    expect(result).toHaveLength(2);
  });

  it('should throw for empty pool', () => {
    expect(() => selectTournamentWriters([])).toThrow('empty');
  });

  it('should accept custom temperature slots', () => {
    const customSlots = [
      { label: 'only', range: [0.5, 0.5] as [number, number], topPRange: [0.9, 0.9] as [number, number] },
    ];
    const result = selectTournamentWriters(pool, customSlots, 2);
    expect(result).toHaveLength(2);
    for (const w of result) {
      expect(w.temperature).toBe(0.5);
      expect(w.topP).toBe(0.9);
    }
  });
});
