import type { LLMClient } from '../llm/types.js';

export interface ExtractedFragment {
  text: string;
  category: string;
  score: number;
  reason: string;
}

export interface ExtractionContext {
  complianceScore: number;
  readerScore: number;
}

export interface ExtractionResult {
  fragments: ExtractedFragment[];
  tokensUsed: number;
}

/**
 * Extracts high-quality fragments from generated text for potential soul expansion
 */
export class FragmentExtractor {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Extract notable fragments from text
   */
  async extract(text: string, context: ExtractionContext): Promise<ExtractionResult> {
    const systemPrompt = `あなたはソウルテキスト断片抽出エージェントです。
与えられた文章から、ソウルテキスト（文体テンプレート）に追加する価値のある断片を抽出してください。

## 抽出基準
- 独特の表現や比喩
- キャラクターの内面を深く描写する文
- 世界観を効果的に伝える描写
- 印象的な対話
- 場面の開始/終了に適した文

## カテゴリ
- opening: 章や場面の開始に適した文
- closing: 章や場面の終了に適した文
- introspection: 内省的な描写
- dialogue: 対話
- action: アクション描写
- worldbuilding: 世界観の描写
- character: キャラクター描写

## 出力形式
JSON形式で出力してください：
{
  "fragments": [
    {
      "text": "抽出した文章",
      "category": "カテゴリ名",
      "score": 0.0-1.0の品質スコア,
      "reason": "選出理由"
    }
  ]
}`;

    const userPrompt = `## 対象テキスト
${text}

## 品質コンテキスト
- コンプライアンススコア: ${context.complianceScore}
- 読者評価スコア: ${context.readerScore}

高品質な断片を抽出してください。見つからない場合は空配列を返してください。`;

    const response = await this.llmClient.complete(systemPrompt, userPrompt);
    const tokensUsed = this.llmClient.getTotalTokens();

    try {
      const parsed = JSON.parse(response) as { fragments: ExtractedFragment[] };
      return {
        fragments: parsed.fragments || [],
        tokensUsed,
      };
    } catch {
      return {
        fragments: [],
        tokensUsed,
      };
    }
  }

  /**
   * Filter fragments by minimum quality score
   */
  filterHighQuality(fragments: ExtractedFragment[], minScore: number): ExtractedFragment[] {
    return fragments.filter((f) => f.score >= minScore);
  }
}
