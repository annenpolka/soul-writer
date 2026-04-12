# パイプライン全体フロー

soul-writer のオーケストレーションスキルは、以下のフェーズを逐次実行する。

## Phase 0: 初期化

1. ワークスペースディレクトリ `output/{timestamp}/` を作成
2. ソウルテキスト（`assets/soul/`）を読み込み
3. `reader-personas.json`, `diversity-catalog.json` を読み込み

## Phase 1: テーマ・キャラクター準備（auto-theme時のみ）

1. `scripts/random-seed.sh` を実行 → ランダム選択結果JSON取得
2. soul-theme-generator エージェントをスポーン → `theme.json`
3. soul-character-developer エージェントをスポーン → `characters.json`

## Phase 1.5: MacGuffin開発（auto-theme時のみ）

1. soul-macguffin-developer エージェントをスポーン → `macguffins.json`

## Phase 1.6: モチーフ分析

1. `scripts/find-past-works.sh` で過去作品を検索
2. 過去作品あり → soul-motif-analyzer エージェントをスポーン → `motif-analysis.json`

## Phase 2: プロット生成

1. soul-plotter エージェントをスポーン（+ macguffins + motifAvoidanceList）→ `plot.json`
2. JSON検証

## Phase 3: 章ごとの生成ループ

各章に対して以下を実行:

### 3a. コンテキスト準備
- 各ペルソナの writer スポーンプロンプトを構築（+ MacGuffin + 回避モチーフ）

### 3b. トーナメント生成
- soul-writer エージェントを4つ並列スポーン（orthodox, experimental, ascetic, empathic）
- `scripts/compliance-check.sh` でプレフィルタ（重大違反ドラフトを失格）

### 3c. ジャッジ
- soul-judge エージェントで準決勝2試合（並列可）→ 決勝1試合
- 優勝テキスト決定

### 3c.5. Judge Retake（条件付き）
- 優勝スコア overall < 70 or voice_accuracy < 60 の場合
- soul-writer retake → soul-judge 再比較（最大2回）

### 3d. 統合
- soul-synthesizer エージェントをスポーン（優勝テキスト + 全ドラフト + Judge分析）

### 3e. 適合度チェック + 矯正ループ（最大3回）
- `scripts/compliance-check.sh` → 違反あり → soul-corrector → 再チェック
- 3回失敗 → anti-soul候補として記録

### 3f. 欠陥検出 + リテイク（最大2回）
- soul-defect-detector → Verdict D以下 → soul-writer retakeモード → 再検出

### 3g. 読者陪審評価
- soul-reader-evaluator ×5（並列）→ weightedScore算出 → 集約
- aggregatedScore < 0.85 → soul-reader-jury → soul-writer retake（最大2回、スコア劣化で中止）

### 3h. 状態更新（多章時）
- soul-chapter-state-extractor で章間状態抽出

## Phase 4: 組み立て

1. 全章の final.txt を結合 → `story.txt`
2. メタデータJSON出力
3. ユーザーに完成を報告

## Phase 4.5: 学習パイプライン（条件付き）

ゲート: verdict が publishable/exceptional かつ compliance パス

1. soul-fragment-extractor → 高品質断片抽出
2. score >= 0.85 のみ保持 → `learning-candidates.json`
3. 矯正失敗パターンあれば → `anti-soul-candidates.json`
4. `/soul-review` でレビュー可能と報告

## エージェント呼び出しの推定コスト

| フェーズ | エージェント | モデル | 呼び出し数/章 |
|---|---|---|---|
| 1 | soul-theme-generator ×1 | inherit | 1 |
| 1 | soul-character-developer ×1 | inherit | 1 |
| 1.5 | soul-macguffin-developer ×1 | inherit | 1 |
| 1.6 | soul-motif-analyzer ×1 | haiku | 0-1 |
| 2 | soul-plotter ×1 | inherit | 1 |
| 3b | soul-writer ×4 | sonnet | 4 |
| 3c | soul-judge ×3 | haiku | 3 |
| 3c.5 | soul-writer retake + soul-judge | sonnet/haiku | 0-4 |
| 3d | soul-synthesizer ×1 | opus/inherit | 1 |
| 3e | soul-corrector ×0-3 | haiku | 0-3 |
| 3f | soul-defect-detector + soul-writer retake | haiku/sonnet | 1-5 |
| 3g | soul-reader-evaluator ×5 + soul-reader-jury | haiku | 6-16 |
| 3h | soul-chapter-state-extractor ×1 | haiku | 1 |
| 4.5 | soul-fragment-extractor ×0-1 | haiku | 0-1 |
| **章あたり合計** | | | **16-38** |
| **初期化（1回のみ）** | | | **3-5** |
