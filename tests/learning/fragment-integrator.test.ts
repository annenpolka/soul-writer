import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFragmentIntegrator } from '../../src/learning/fragment-integrator.js';
import type { SoulCandidate } from '../../src/storage/soul-candidate-repository.js';
import { FragmentCollectionSchema } from '../../src/schemas/fragments.js';

function makeSoulCandidate(overrides: Partial<SoulCandidate> = {}): SoulCandidate {
  return {
    id: 'cand-001',
    soulId: 'test-soul',
    sourceWorkId: 'work-abc',
    sourceChapterId: 'ch-1',
    fragmentText: 'テスト断片テキスト',
    suggestedCategory: 'opening',
    autoScore: 0.9,
    status: 'approved',
    reviewerNotes: null,
    createdAt: '2026-02-17T00:00:00Z',
    reviewedAt: '2026-02-17T01:00:00Z',
    ...overrides,
  };
}

describe('FragmentIntegrator', () => {
  let soulDir: string;

  beforeEach(() => {
    soulDir = mkdtempSync(join(tmpdir(), 'soul-test-'));
    mkdirSync(join(soulDir, 'fragments'));
  });

  afterEach(() => {
    rmSync(soulDir, { recursive: true, force: true });
  });

  describe('integrateOne', () => {
    it('should create learned directory and category file when none exists', async () => {
      const integrator = createFragmentIntegrator();
      const candidate = makeSoulCandidate();

      const result = await integrator.integrateOne(candidate, soulDir);

      expect(result.success).toBe(true);
      expect(result.category).toBe('opening');
      expect(result.fragmentId).toMatch(/^learned-opening-/);

      const learnedDir = join(soulDir, 'fragments', 'learned');
      expect(existsSync(learnedDir)).toBe(true);

      const filePath = join(learnedDir, 'opening.json');
      expect(existsSync(filePath)).toBe(true);

      const json = JSON.parse(readFileSync(filePath, 'utf-8'));
      const parsed = FragmentCollectionSchema.parse(json);
      expect(parsed.category).toBe('opening');
      expect(parsed.fragments).toHaveLength(1);
      expect(parsed.fragments[0].text).toBe('テスト断片テキスト');
      expect(parsed.fragments[0].origin).toBe('learned');
      expect(parsed.fragments[0].source).toBe('work:work-abc');
    });

    it('should append to existing learned category file', async () => {
      const integrator = createFragmentIntegrator();
      const learnedDir = join(soulDir, 'fragments', 'learned');
      mkdirSync(learnedDir);

      const existingCollection = {
        category: 'opening',
        fragments: [
          {
            id: 'learned-opening-001',
            text: '既存の学習断片',
            origin: 'learned',
            source: 'work:old-work',
            tags: [],
            added_at: '2026-01-01T00:00:00Z',
          },
        ],
      };
      writeFileSync(
        join(learnedDir, 'opening.json'),
        JSON.stringify(existingCollection, null, 2)
      );

      const candidate = makeSoulCandidate({ fragmentText: '新しい断片' });
      const result = await integrator.integrateOne(candidate, soulDir);

      expect(result.success).toBe(true);

      const json = JSON.parse(
        readFileSync(join(learnedDir, 'opening.json'), 'utf-8')
      );
      expect(json.fragments).toHaveLength(2);
      expect(json.fragments[0].text).toBe('既存の学習断片');
      expect(json.fragments[1].text).toBe('新しい断片');
    });

    it('should map extractor categories to valid FragmentCategory', async () => {
      const integrator = createFragmentIntegrator();
      const candidate = makeSoulCandidate({
        suggestedCategory: 'worldbuilding',
      });

      const result = await integrator.integrateOne(candidate, soulDir);

      expect(result.success).toBe(true);
      expect(result.category).toBe('world_building');

      const filePath = join(soulDir, 'fragments', 'learned', 'world_building.json');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should return error for unmappable categories', async () => {
      const integrator = createFragmentIntegrator();
      const candidate = makeSoulCandidate({
        suggestedCategory: 'unknown_category',
      });

      const result = await integrator.integrateOne(candidate, soulDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.fragmentId).toBeNull();
      expect(result.category).toBeNull();
    });

    it('should generate sequential IDs within a category', async () => {
      const integrator = createFragmentIntegrator();

      const result1 = await integrator.integrateOne(
        makeSoulCandidate({ id: 'c1', fragmentText: '断片1' }),
        soulDir
      );
      const result2 = await integrator.integrateOne(
        makeSoulCandidate({ id: 'c2', fragmentText: '断片2' }),
        soulDir
      );

      expect(result1.fragmentId).toBe('learned-opening-001');
      expect(result2.fragmentId).toBe('learned-opening-002');
    });

    it('should produce valid FragmentCollectionSchema output', async () => {
      const integrator = createFragmentIntegrator();
      await integrator.integrateOne(makeSoulCandidate(), soulDir);

      const filePath = join(soulDir, 'fragments', 'learned', 'opening.json');
      const json = JSON.parse(readFileSync(filePath, 'utf-8'));
      const result = FragmentCollectionSchema.safeParse(json);

      expect(result.success).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove a learned fragment by ID', async () => {
      const integrator = createFragmentIntegrator();
      const candidate = makeSoulCandidate();
      const intResult = await integrator.integrateOne(candidate, soulDir);

      const removed = await integrator.remove(soulDir, intResult.fragmentId!);
      expect(removed).toBe(true);

      const filePath = join(soulDir, 'fragments', 'learned', 'opening.json');
      const json = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(json.fragments).toHaveLength(0);
    });

    it('should return false when fragment ID does not exist', async () => {
      const integrator = createFragmentIntegrator();

      const removed = await integrator.remove(soulDir, 'nonexistent-id');
      expect(removed).toBe(false);
    });
  });
});
