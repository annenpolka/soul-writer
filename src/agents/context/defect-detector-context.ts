import type { SoulText } from '../../soul/manager.js';
import type { EnrichedCharacter } from '../../factory/character-enricher.js';
import type { CrossChapterState, TextWeakness, AxisComment, Violation } from '../types.js';

/**
 * Input for buildDefectDetectorContext
 */
export interface DefectDetectorContextInput {
  soulText: SoulText;
  text: string;
  enrichedCharacters?: EnrichedCharacter[];
  toneDirective?: string;
  crossChapterState?: CrossChapterState;
  judgeWeaknesses?: TextWeakness[];
  judgeAxisComments?: AxisComment[];
  complianceWarnings?: Violation[];
  /** LLM reasoning from Judge — propagated as reference context */
  judgeReasoning?: string | null;
}

/**
 * Standard defect categories for detection
 */
const DEFECT_CATEGORIES = [
  { name: 'character_inconsistency', description: 'キャラクターの言動・性格が設定と矛盾' },
  { name: 'plot_contradiction', description: 'プロットの論理的矛盾、因果関係の破綻' },
  { name: 'pacing_issue', description: 'テンポの不均衡、冗長または唐突な展開' },
  { name: 'motif_fatigue', description: 'モチーフ・比喩の過度な繰り返し' },
  { name: 'motif_overuse', description: '身体的モチーフの過剰使用（3回ルール違反）。同一身体動作・感覚描写の作品内での過度な反復' },
  { name: 'style_deviation', description: '文体の逸脱、リズム・トーンの不整合' },
  { name: 'worldbuilding_error', description: '世界観設定との矛盾、用語の誤用' },
  { name: 'emotional_flatness', description: '感情表現の平板化、心理描写の浅さ' },
  { name: 'forbidden_pattern', description: '禁止語彙・禁止比喩の使用' },
  { name: 'agency_absence', description: '主人公の能動的行動・選択・介入の欠如。受動的ループの検出' },
  { name: 'character_flatness', description: '生成キャラクターの人格の平板化。プロット奉仕100%、身体的ディテール欠如、口調同質化' },
  { name: 'tone_drift', description: '指定されたトーンからの逸脱' },
  { name: 'character_state_regression', description: '前章で確立されたキャラクター状態からの退行（再紹介、初見描写の反復）' },
  { name: 'motif_exhaustion', description: '摩耗度が高いモチーフのそのままの再利用（変奏・記号化なし）' },
  { name: 'variation_axis_violation', description: '指定された変奏軸の方向に変化していない（前章と同一パターンの反復）' },
  { name: 'cross_chapter_repetition', description: '前章と同一の台詞・描写・感情パターンのコピペ' },
  { name: 'dynamics_unused', description: 'キャラクターの人格力学（渇望・充足行動）が文章に反映されていない' },
  { name: 'craving_explicit', description: '渇望や内面の傷が地の文で直接説明されている（show don\'t tell違反）' },
  { name: 'fulfillment_cliche', description: '歪んだ充足行動がテンプレ的（渇望から直線的に導かれる予測可能な行動）' },
  { name: 'sensory_flooding', description: '短い範囲（200文字以内）に3種以上の異なる感覚モダリティが集中。3種でminor、4種以上でmajor' },
  { name: 'chapter_redundancy', description: '異なる章で同一イベント・導入部が新情報の追加なしに再叙述。新情報比率30%未満でcritical、50%未満でmajor' },
  { name: 'thematic_over_verbalization', description: '構造が既にテーマを伝えているのに語り手がテーマを直接言語化・自問自答。同一テーマの直接言語化2回以上でmajor' },
];

/**
 * Build the full template context for a defect-detector prompt (pure function).
 */
export function buildDefectDetectorContext(input: DefectDetectorContextInput): Record<string, unknown> {
  const { soulText, text } = input;
  const u = soulText.constitution.universal;

  // Constitution rules summary
  const constitutionRules = {
    forbiddenWords: u.vocabulary.forbidden_words,
    forbiddenSimiles: u.rhetoric.forbidden_similes,
    thematicMustPreserve: u.thematic_constraints.must_preserve,
    forbiddenResolutions: u.thematic_constraints.forbidden_resolutions,
  };

  // Anti-soul patterns (max 2 per category)
  const antiSoulPatterns: Array<{ category: string; text: string; reason: string }> = [];
  for (const [category, entries] of Object.entries(soulText.antiSoul.categories)) {
    for (const entry of entries.slice(0, 2)) {
      antiSoulPatterns.push({
        category,
        text: entry.text,
        reason: entry.reason,
      });
    }
  }

  // Character list from world bible
  const characters: Array<{ name: string; role: string }> = [];
  for (const [name, char] of Object.entries(soulText.worldBible.characters)) {
    characters.push({ name, role: char.role });
  }

  // Enriched character details for character_flatness detection
  const enrichedCharacters = input.enrichedCharacters?.map(c => ({
    name: c.name,
    stanceType: c.stance.type,
    stanceManifestation: c.stance.manifestation,
    blindSpot: c.stance.blindSpot,
    habits: c.physicalHabits.map(h => `${h.habit}（${h.trigger}、${h.sensoryDetail}）`).join('\n  '),
    craving: c.dynamics.craving,
    distortedFulfillment: c.dynamics.distortedFulfillment,
    surfaceContradiction: c.dynamics.surfaceContradiction,
  }));

  // Cross-chapter state for multi-chapter quality checks
  const crossChapterContext: Record<string, unknown> = {};
  if (input.crossChapterState) {
    const state = input.crossChapterState;
    if (state.characterStates.length > 0) {
      crossChapterContext.previousCharacterStates = state.characterStates.map(cs => ({
        name: cs.characterName,
        lastEmotionalState: cs.emotionalState,
        physicalState: cs.physicalState,
      }));
    }
    const wornMotifs = state.motifWear.filter(m => m.wearLevel === 'worn' || m.wearLevel === 'exhausted');
    if (wornMotifs.length > 0) {
      crossChapterContext.wornMotifs = wornMotifs.map(m => ({
        motif: m.motif,
        usageCount: m.usageCount,
        wearLevel: m.wearLevel,
      }));
    }
    if (state.chapterSummaries.length > 0) {
      crossChapterContext.previousChapterSummaries = state.chapterSummaries;
    }
  }

  // Judge analysis data for cross-referencing
  const judgeAnalysis: Record<string, unknown> | undefined =
    (input.judgeWeaknesses && input.judgeWeaknesses.length > 0) || (input.judgeAxisComments && input.judgeAxisComments.length > 0)
      ? {
          ...(input.judgeWeaknesses && input.judgeWeaknesses.length > 0
            ? {
                weaknesses: input.judgeWeaknesses.map(w => ({
                  category: w.category,
                  severity: w.severity,
                  description: w.description,
                  suggestedFix: w.suggestedFix,
                })),
              }
            : {}),
          ...(input.judgeAxisComments && input.judgeAxisComments.length > 0
            ? {
                axisComments: input.judgeAxisComments.map(ac => ({
                  axis: ac.axis,
                  comment: ac.commentA || ac.commentB,
                })),
              }
            : {}),
        }
      : undefined;

  // Compliance warnings
  const complianceWarnings =
    input.complianceWarnings && input.complianceWarnings.length > 0
      ? input.complianceWarnings.map(v => ({
          type: v.type,
          context: v.context,
          rule: v.rule,
        }))
      : undefined;

  return {
    text,
    constitutionRules,
    antiSoulPatterns,
    defectCategories: DEFECT_CATEGORIES,
    characters,
    ...(enrichedCharacters && enrichedCharacters.length > 0 ? { enrichedCharacters } : {}),
    ...(input.toneDirective ? { toneDirective: input.toneDirective } : {}),
    ...(Object.keys(crossChapterContext).length > 0 ? { crossChapterContext } : {}),
    ...(judgeAnalysis ? { judgeAnalysis } : {}),
    ...(complianceWarnings ? { complianceWarnings } : {}),
    ...(input.judgeReasoning ? { judgeReasoning: input.judgeReasoning } : {}),
  };
}
