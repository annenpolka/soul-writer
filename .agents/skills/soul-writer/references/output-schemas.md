# エージェント出力JSONスキーマ

各エージェントの期待出力フォーマットを定義する。オーケストレーターはこれらのスキーマに基づいて出力を検証する。

## Judge 評価結果スキーマ

    {
      "winner": "A" | "B",
      "reasoning": "選出理由（日本語、200字以上）",
      "scores": {
        "A": {
          "style": 0-100,
          "compliance": 0-100,
          "voice_accuracy": 0-100,
          "originality": 0-100,
          "structure": 0-100,
          "amplitude": 0-100,
          "agency": 0-100,
          "stakes": 0-100,
          "overall": 0-100
        },
        "B": { ... 同構造 ... }
      },
      "praised_excerpts": {
        "A": ["引用1", "引用2"],
        "B": ["引用1", "引用2"]
      },
      "weaknesses": {
        "A": [
          {
            "category": "style|voice|pacing|imagery|motif|worldbuilding|agency|stakes",
            "description": "弱点の説明",
            "suggestedFix": "改善案",
            "severity": "critical|major|minor"
          }
        ],
        "B": [ ... ]
      },
      "axis_comments": [
        {
          "axis": "style|voice_accuracy|originality|structure|amplitude|agency|stakes|compliance",
          "commentA": "テキストAの評価",
          "commentB": "テキストBの評価"
        }
      ]
    }

## Plotter プロット構造スキーマ

    {
      "title": "仮タイトル",
      "theme": {
        "core": "中核テーマ",
        "emotion": "支配的感情",
        "premise": "前提設定"
      },
      "chapters": [
        {
          "chapterIndex": 1,
          "title": "章タイトル",
          "purpose": "この章の物語的目的",
          "tensionLevel": 1-10,
          "keyEvents": ["イベント1", "イベント2"],
          "decisionPoints": [
            {
              "character": "キャラ名",
              "choice": "選択内容",
              "consequence": "帰結"
            }
          ],
          "targetLength": 4000
        }
      ]
    }

## DefectDetector 欠陥レポートスキーマ

    {
      "verdict_level": "exceptional|publishable|acceptable|needs_work|unacceptable",
      "defects": [
        {
          "severity": "critical|major|minor",
          "category": "forbidden_pattern|motif_overuse|sensory_flooding|chapter_redundancy|thematic_over_verbalization|agency_absence|character_flatness|tone_drift|dynamics_unused|craving_explicit|fulfillment_cliche|self_repetition|chapter_variation",
          "description": "欠陥の説明",
          "location": "該当箇所の概略",
          "quoted_text": "問題箇所の原文引用（50-150字）",
          "suggested_fix": "具体的修正方向"
        }
      ]
    }

## ThemeGenerator テーマスキーマ

    {
      "emotion": "支配的感情",
      "timeline": "時間軸の説明",
      "characters": [
        {
          "name": "キャラクター名",
          "isNew": true|false,
          "description": "役割と特徴"
        }
      ],
      "premise": "物語の前提（200字以上）",
      "scene_types": ["シーンタイプ1", "シーンタイプ2"],
      "narrative_type": "語りの種類",
      "tone": "文体トーン指示"
    }

## ChapterStateExtractor 章間状態スキーマ

    {
      "characterStates": [
        {
          "name": "キャラクター名",
          "lastEmotionalState": "感情状態",
          "physicalState": "身体状態",
          "knowledgeGained": ["新たに知った事実"]
        }
      ],
      "motifOccurrences": [
        {
          "motif": "モチーフ名",
          "count": 2,
          "wearLevel": "fresh|worn|exhausted"
        }
      ],
      "variationHint": "次章への変奏のヒント",
      "summary": "章の要約（100字以内）",
      "dominantTone": "支配的トーン",
      "peakIntensity": 1-10
    }

## Compliance チェック結果スキーマ（scripts/compliance-check.sh 出力）

    {
      "isCompliant": true|false,
      "violations": [
        {
          "rule": "forbidden-words|forbidden-similes|special-marks|pov-consistency|rhythm-check|markdown-contamination|chinese-contamination|quote-originality",
          "severity": "error|warning",
          "count": 1,
          "details": ["詳細1", "詳細2"]
        }
      ],
      "errorCount": 0,
      "warningCount": 0
    }

## ReaderEvaluation ペルソナ評価スキーマ

    {
      "categoryScores": {
        "style": 0.0-1.0,
        "plot": 0.0-1.0,
        "character": 0.0-1.0,
        "worldbuilding": 0.0-1.0,
        "readability": 0.0-1.0
      },
      "feedback": {
        "strengths": "最も優れた点",
        "weaknesses": "最も改善すべき点",
        "suggestion": "改善提案"
      }
    }

## ReaderJuryVerdict 陪審総合スキーマ

    {
      "summary": "評価の総合的なサマリー（200字以上）",
      "consensusStrengths": ["合意された強み"],
      "consensusWeaknesses": ["合意された弱み"],
      "prioritizedFeedback": "統合改善指針（不合格時のリテイク用）"
    }

## MacGuffin スキーマ

    {
      "characterMacGuffins": [
        {
          "characterName": "キャラクター名",
          "secret": "秘密の内容（50-150字）",
          "surfaceSigns": ["表面に漏れ出る兆候"],
          "narrativeFunction": "この秘密が物語に果たす役割"
        }
      ],
      "plotMacGuffins": [
        {
          "name": "謎の名前",
          "surfaceAppearance": "表面上の見え方",
          "hiddenLayer": "裏側の意味",
          "tensionQuestions": ["この謎が生む問い"],
          "presenceHint": "物語中での登場方法"
        }
      ]
    }

## MotifAnalysis モチーフ分析スキーマ

    {
      "frequentMotifs": ["モチーフ1", "モチーフ2", "..."]
    }

## FragmentExtraction 断片抽出スキーマ

    {
      "fragments": [
        {
          "text": "抽出した断片テキスト",
          "category": "opening|killing|introspection|dialogue|character_voice|symbolism|world_building|action",
          "score": 0.0-1.0,
          "reason": "この断片が優れている理由"
        }
      ]
    }

## LearningCandidate 学習候補スキーマ

    {
      "sourceWork": "ソース作品のワークスペースパス",
      "verdict": "publishable|exceptional",
      "extractedAt": "ISO 8601 タイムスタンプ",
      "fragments": [
        {
          "text": "断片テキスト",
          "category": "カテゴリ",
          "score": 0.0-1.0,
          "reason": "理由",
          "status": "pending|approved|rejected"
        }
      ]
    }
