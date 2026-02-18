import type { WriterPersona } from '../schemas/writer-persona.js';
import type { WriterConfig } from '../agents/types.js';

export interface TemperatureSlot {
  label: string;
  range: [number, number];
  topPRange: [number, number];
}

export const DEFAULT_TEMPERATURE_SLOTS: TemperatureSlot[] = [
  { label: 'low', range: [0.4, 0.55], topPRange: [0.75, 0.85] },
  { label: 'mid', range: [0.55, 0.7], topPRange: [0.8, 0.9] },
  { label: 'mid-high', range: [0.7, 0.85], topPRange: [0.85, 0.92] },
  { label: 'high', range: [0.85, 0.95], topPRange: [0.9, 0.97] },
];

/**
 * Build personaDirective by merging directive and aestheticStance.
 */
function buildPersonaDirective(persona: WriterPersona): string | undefined {
  const parts: string[] = [];
  if (persona.directive) parts.push(persona.directive);
  if (persona.aestheticStance) parts.push(`\n【美学的態度】\n${persona.aestheticStance}`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

/**
 * Randomly select personas from pool and assign temperature slots with guaranteed dispersion.
 */
export function selectTournamentWriters(
  pool: WriterPersona[],
  slots: TemperatureSlot[] = DEFAULT_TEMPERATURE_SLOTS,
  count: number = 4,
): WriterConfig[] {
  if (pool.length === 0) {
    throw new Error('Writer persona pool is empty');
  }

  // Shuffle pool and take first `count`
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  // Assign each persona to a temperature slot (guaranteed dispersion)
  return selected.map((persona, i) => {
    const slot = slots[i % slots.length];
    const temp = slot.range[0] + Math.random() * (slot.range[1] - slot.range[0]);
    const topP = slot.topPRange[0] + Math.random() * (slot.topPRange[1] - slot.topPRange[0]);

    return {
      id: `writer_${persona.id}`,
      temperature: parseFloat(temp.toFixed(2)),
      topP: parseFloat(topP.toFixed(2)),
      style: 'balanced' as const,
      focusCategories: persona.focusCategories,
      personaDirective: buildPersonaDirective(persona),
      personaName: persona.name,
    };
  });
}
