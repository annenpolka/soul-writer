import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import type { SoulCandidate } from '../storage/soul-candidate-repository.js';
import type { FragmentCategoryType, Fragment } from '../schemas/fragments.js';
import { FragmentCollectionSchema } from '../schemas/fragments.js';
import { mapExtractorCategory } from './category-mapper.js';

export interface IntegrateOneResult {
  success: boolean;
  fragmentId: string | null;
  category: string | null;
  error?: string;
}

export interface FragmentIntegratorFn {
  integrateOne(
    candidate: SoulCandidate,
    soulDir: string
  ): Promise<IntegrateOneResult>;
  remove(soulDir: string, fragmentId: string): Promise<boolean>;
}

function getLearnedDir(soulDir: string): string {
  return join(soulDir, 'fragments', 'learned');
}

function ensureLearnedDir(soulDir: string): string {
  const dir = getLearnedDir(soulDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function readLearnedCollection(
  learnedDir: string,
  category: FragmentCategoryType
): { category: FragmentCategoryType; fragments: Fragment[] } {
  const filePath = join(learnedDir, `${category}.json`);
  if (existsSync(filePath)) {
    const json = JSON.parse(readFileSync(filePath, 'utf-8'));
    return FragmentCollectionSchema.parse(json);
  }
  return { category, fragments: [] };
}

function writeLearnedCollection(
  learnedDir: string,
  category: FragmentCategoryType,
  fragments: Fragment[]
): void {
  const filePath = join(learnedDir, `${category}.json`);
  const collection = { category, fragments };
  writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf-8');
}

function generateFragmentId(
  category: FragmentCategoryType,
  existingCount: number
): string {
  const seq = String(existingCount + 1).padStart(3, '0');
  return `learned-${category}-${seq}`;
}

export function createFragmentIntegrator(): FragmentIntegratorFn {
  return {
    async integrateOne(
      candidate: SoulCandidate,
      soulDir: string
    ): Promise<IntegrateOneResult> {
      const category = mapExtractorCategory(candidate.suggestedCategory);
      if (!category) {
        return {
          success: false,
          fragmentId: null,
          category: null,
          error: `Unknown category: ${candidate.suggestedCategory}`,
        };
      }

      const learnedDir = ensureLearnedDir(soulDir);
      const collection = readLearnedCollection(learnedDir, category);
      const fragmentId = generateFragmentId(
        category,
        collection.fragments.length
      );

      const fragment: Fragment = {
        id: fragmentId,
        text: candidate.fragmentText,
        source: `work:${candidate.sourceWorkId}`,
        origin: 'learned',
        tags: [],
        added_at: new Date().toISOString(),
      };

      collection.fragments.push(fragment);
      writeLearnedCollection(learnedDir, category, collection.fragments);

      return {
        success: true,
        fragmentId,
        category,
      };
    },

    async remove(soulDir: string, fragmentId: string): Promise<boolean> {
      const learnedDir = getLearnedDir(soulDir);
      if (!existsSync(learnedDir)) return false;

      const files = readdirSync(learnedDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = join(learnedDir, file);
        const json = JSON.parse(readFileSync(filePath, 'utf-8'));
        const collection = FragmentCollectionSchema.parse(json);
        const idx = collection.fragments.findIndex((f) => f.id === fragmentId);
        if (idx !== -1) {
          collection.fragments.splice(idx, 1);
          writeLearnedCollection(
            learnedDir,
            collection.category,
            collection.fragments
          );
          return true;
        }
      }
      return false;
    },
  };
}
