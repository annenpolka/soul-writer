# パイプライン全体像

## 概要

soul-writerの生成パイプラインは、ソウルテキスト（原典）に基づいて一貫した文体と世界観を維持しながら短編小説を自動生成する多段階プロセスである。

パイプラインは大きく2系統に分かれる:

| パイプライン | 用途 | DB永続化 | チェックポイント | 学習 |
|------------|------|---------|---------------|------|
| **SimplePipeline** | 高速生成・プロトタイプ | なし | なし | なし |
| **FullPipeline** | 本番生成・マルチチャプター | あり | あり | あり |

---

## エントリポイント

```
CLI (src/main.ts)
│
├─ generate --simple   → SimplePipeline
├─ generate            → FullPipeline
├─ resume              → FullPipeline.resume(taskId)
├─ review              → 学習候補レビュー
└─ factory             → BatchRunner → FullPipeline × N（並列）
```

### 主要CLIオプション

| オプション | 説明 |
|-----------|------|
| `--soul <dir>` | ソウルテキストディレクトリ |
| `--prompt <text>` | ストーリーの前提 |
| `--chapters <n>` | チャプター数（デフォルト: 5） |
| `--simple` | トーナメントのみ、後処理なし |
| `--auto-theme` | テーマ自動生成（+キャラクター開発+マクガフィン生成） |
| `--mode <mode>` | `tournament`（デフォルト）or `collaboration` |
| `--verbose` | デバッグログ出力 |
| `--include-raw-soultext` | 原典メモをプロンプトに含める |

---

## 全体データフロー

```
┌──────────────────────────────────────────────────────────────────┐
│ CLI: generate --soul X --prompt Y [--auto-theme] [--mode MODE]  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  --auto-theme?     │
                    └─────────┬──────────┘
                        YES   │   NO
                    ┌─────────▼──────────────────────┐
                    │  テーマ自動生成フェーズ          │
                    │  ├─ ThemeGeneratorAgent         │
                    │  ├─ CharacterDeveloperAgent     │
                    │  ├─ CharacterMacGuffinAgent     │
                    │  └─ PlotMacGuffinAgent          │
                    │                                 │
                    │  → themeContext                  │
                    │  → macGuffinContext              │
                    │  → developedCharacters           │
                    └─────────┬──────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
     ┌────────▼────────┐           ┌──────────▼──────────┐
     │ SimplePipeline   │           │ FullPipeline         │
     │ (--simple時)     │           │ (デフォルト)          │
     └────────┬────────┘           └──────────┬──────────┘
              │                               │
              ▼                               ▼
     テキスト出力（stdout）           DB保存 + 学習候補抽出
```

---

## SimplePipeline

**ファイル:** `src/pipeline/simple.ts`

DB永続化なしの高速パイプライン。テスト・プロトタイプ用途。

### `--simple` モード（トーナメントのみ）

```
トーナメント実行（Writer×4 → Judge×3 → Champion）
    │
    ▼
  結果出力
```

### 通常モード（後処理あり）

```
トーナメント or コラボレーション
    │
    ▼
Synthesis（チャンピオンの強化）
    │
    ▼
コンプライアンスチェック
    │
    ├─ 違反あり → 矯正ループ（最大3回）
    │                │
    │                ├─ 成功 → 続行
    │                └─ 3回失敗 → Anti-Soulに収集、ベストエフォートで続行
    │
    ▼
リテイクループ（品質改善）
    │
    ▼
読者陪審員評価
    │
    ├─ 不合格 → リテイク（最大2回、スコア悪化時は即中断・前版に戻す）
    │
    ▼
  結果出力
```

---

## FullPipeline

**ファイル:** `src/pipeline/full.ts`

DB永続化・チェックポイント・学習機能を持つ本番パイプライン。

```
1. タスク作成（DB: tasks テーブル）
    │
    ▼
2. プロット生成（PlotterAgent）
    │  → Plot { title, theme, chapters[] }
    │  → チェックポイント保存
    │
    ▼
3. チャプターごとの生成ループ ─────────────────────────┐
    │                                                  │
    │  ┌─────────────────────────────────────────────┐ │
    │  │ (a) テキスト生成                             │ │
    │  │     ├─ tournament: Writer×4 → Judge×3       │ │
    │  │     └─ collaboration: Writers + Moderator   │ │
    │  │                                             │ │
    │  │ (b) Synthesis（トーナメント時のみ）           │ │
    │  │     └─ チャンピオンに敗者の良い部分を統合    │ │
    │  │                                             │ │
    │  │ (c) コンプライアンスチェック                  │ │
    │  │     └─ 違反時: 矯正ループ（最大3回）        │ │
    │  │                                             │ │
    │  │ (d) リテイクループ（品質改善）                │ │
    │  │                                             │ │
    │  │ (e) 読者陪審員評価                           │ │
    │  │     └─ 不合格時: リテイク（最大2回）        │ │
    │  │                                             │ │
    │  │ (f) チェックポイント保存                      │ │
    │  └─────────────────────────────────────────────┘ │
    │                                                  │
    └──────── 次チャプター ────────────────────────────┘
    │
    ▼
4. 作品アーカイブ（DB: works, chapters テーブル）
    │
    ▼
5. 学習パイプライン
    │  高品質チャプター（compliance≥0.85 && reader≥0.80）
    │  → 断片抽出 → soul_candidates テーブル → 人間レビュー待ち
    │
    ▼
6. タスク完了
```

### チェックポイントと再開

FullPipelineはチャプターごとにチェックポイントを保存する。中断時は `resume` コマンドで最後のチェックポイントから再開できる。

```
resume(taskId)
    │
    ├─ 最新チェックポイント読み込み
    ├─ 完了済みチャプターをスキップ
    └─ 次の未完了チャプターから再開
```

---

## エージェント一覧と役割

### テキスト生成

| エージェント | ファイル | 役割 |
|-------------|---------|------|
| **WriterAgent** | `src/agents/writer.ts` | ソウルテキストに基づくテキスト生成 |
| **CollaborativeWriter** | `src/collaboration/` | コラボレーションモード用Writer |
| **PlotterAgent** | `src/agents/plotter.ts` | プロット（章構成）の生成 |
| **SynthesisAgent** | `src/synthesis/synthesis-agent.ts` | チャンピオンテキストの強化 |

### 評価・矯正

| エージェント | ファイル | 役割 |
|-------------|---------|------|
| **JudgeAgent** | `src/agents/judge.ts` | 2テキストの比較審査 |
| **CorrectorAgent** | `src/agents/corrector.ts` | コンプライアンス違反の修正 |
| **RetakeAgent** | `src/retake/retake-agent.ts` | フィードバックに基づく改善 |
| **ReaderJuryAgent** | `src/agents/reader-jury.ts` | 複数ペルソナによる多角的評価 |
| **ReaderEvaluator** | `src/agents/reader-evaluator.ts` | 個別ペルソナの評価実行 |

### 進行管理

| エージェント | ファイル | 役割 |
|-------------|---------|------|
| **ModeratorAgent** | `src/collaboration/` | コラボレーションの議論進行 |

### テーマ・キャラクター

| エージェント | ファイル | 役割 |
|-------------|---------|------|
| **ThemeGeneratorAgent** | `src/factory/` | テーマ自動生成 |
| **CharacterDeveloperAgent** | `src/agents/` | キャラクター深掘り |
| **CharacterMacGuffinAgent** | `src/agents/` | キャラクターの隠された秘密 |
| **PlotMacGuffinAgent** | `src/agents/` | 物語の謎・伏線 |

---

## トーナメントシステム

**ファイル:** `src/tournament/arena.ts`

4人のWriterが並列に生成し、トーナメント形式で最良のテキストを選出する。

```
Writer 1 (t=0.7, balanced)  ──┐
                               ├─ Judge → Winner A ──┐
Writer 2 (t=0.9, creative)  ──┘                      │
                                                      ├─ Final Judge → Champion
Writer 3 (t=0.5, conservative)──┐                    │
                                 ├─ Judge → Winner B ──┘
Writer 4 (t=0.8, moderate)  ────┘
```

### Writer設定の多様性

各Writerは異なるパラメータで多様なテキストを生成する:

| Writer | temperature | topP | スタイル |
|--------|-----------|------|---------|
| writer_1 | 0.7 | 0.9 | balanced（バランス型） |
| writer_2 | 0.9 | 0.95 | creative（創造的） |
| writer_3 | 0.5 | 0.8 | conservative（保守的） |
| writer_4 | 0.8 | 0.85 | moderate（中庸） |

### 並列実行戦略

- **Writer生成**: `Promise.all()` — 4テキスト同時生成
- **Judge審査**: 逐次実行 — 前ラウンドの結果に依存
- **読者ペルソナ評価**: `Promise.all()` — 全ペルソナ同時評価
- **コラボレーション**: `Promise.allSettled()` — 部分失敗を許容

### Judge評価基準

| 基準 | 説明 |
|------|------|
| 語り声の再現 | ソウルテキストの文体との一致度 |
| 原作忠実度 | 世界観・設定との整合性 |
| 新奇さ（重み大） | オリジナリティと新鮮さ |
| 文体の一貫性 | 文章全体のトーン統一 |
| 禁止パターン回避 | コンプライアンス違反の有無 |
| 物語性 | ストーリーとしての完成度 |

---

## コラボレーションモード

**ファイル:** `src/collaboration/`

トーナメントの代替モード。複数WriterがModeratorの進行のもと協調して1つのテキストを作る。

```
┌─────────────────────────────────────────────────────┐
│ Proposal Phase                                      │
│   全Writerがアプローチ・構成を提案                    │
│   Moderatorがセクション割り当て                       │
├─────────────────────────────────────────────────────┤
│ Discussion Phase                                    │
│   Writerが互いにフィードバック                        │
│   Moderatorが合意度を追跡                            │
├─────────────────────────────────────────────────────┤
│ Drafting Phase                                      │
│   割り当てられたセクションを執筆                      │
│   ドラフトを収集                                     │
├─────────────────────────────────────────────────────┤
│ Review Phase                                        │
│   Writerが相互レビュー・改善提案                      │
│   Moderatorが合意度を評価                            │
│   終了条件: 合意スコア達成 or 最大ラウンド数到達       │
└─────────────────────────────────────────────────────┘
          │
          ▼
   最終テキスト統合
```

---

## コンプライアンスチェックと矯正ループ

### 検出される違反

| 違反タイプ | 説明 |
|-----------|------|
| `forbidden_word` | 禁止語彙の使用 |
| `sentence_too_long` | リズム制約超過 |
| `forbidden_simile` | 禁止比喩表現 |
| `special_mark_misuse` | 特殊記号の誤用 |
| `theme_violation` | テーマ的不整合 |
| `pov_violation` | 視点の逸脱 |
| `markdown_contamination` | Markdown構文の混入 |
| `quote_direct_copy` | 断片からの直接コピー |

### 矯正フロー

```
テキスト
  │
  ▼
コンプライアンスチェック
  │
  ├─ 違反なし → 合格
  │
  └─ 違反あり
      │
      ├─ 矯正 1回目 → チェック → 合格?
      ├─ 矯正 2回目 → チェック → 合格?
      └─ 矯正 3回目 → チェック → 合格?
                                    │
                                    └─ 不合格 → Anti-Soulに収集
                                                 ベストエフォートで続行
```

---

## 読者陪審員評価

**ファイル:** `src/agents/reader-jury.ts`

複数の読者ペルソナが並列にテキストを評価する。

### デフォルトペルソナ

| ペルソナ | 視点 |
|---------|------|
| SF愛好家 | SF設定・テクノロジー描写の質 |
| 文学少女 | 文学的表現・情感の深さ |
| ライトリーダー | 読みやすさ・エンターテインメント性 |
| 編集者 | 構成・完成度・商業的品質 |

### 評価カテゴリ

style, plot, character, worldbuilding, readability

### 合格閾値

- **合格スコア**: 0.85（85%）以上
- **リテイク上限**: 2回
- **スコア悪化時**: 即中断、前版にロールバック

### リテイクフロー

```
読者陪審員評価
  │
  ├─ スコア ≥ 0.85 → 合格
  │
  └─ スコア < 0.85
      │
      ├─ 全ペルソナのフィードバックを収集
      │  （良い点・課題・提案）
      │
      ├─ RetakeAgent: フィードバックに基づいて改善
      │
      ├─ 再評価
      │  ├─ スコア改善 → 次のリテイクor合格
      │  └─ スコア悪化 → 前版にロールバック、中断
      │
      └─ 最大2回まで繰り返し
         （フィードバック履歴は累積で渡される）
```

---

## コンテキスト伝播

### ThemeContext

テーマの感情・トーン・時系列を全エージェントに一貫して伝播する。

```typescript
interface ThemeContext {
  emotion: string;        // 例: "孤独", "渇望"
  timeline: string;       // 例: "出会い前", "出会い後"
  premise: string;        // ストーリーの前提
  tone?: string;          // 文体の方向性
  narrative_type?: string; // 視点タイプ
  scene_types?: string[]; // 適用シーンの種類
}
```

**伝播先:**

```
ThemeGeneratorAgent
    │
    ▼ themeContext
    ├─ WriterAgent         → テンプレートコンテキストに注入
    ├─ JudgeAgent          → テーマ整合性の評価基準
    ├─ CorrectorAgent      → トーンを保持した矯正
    ├─ SynthesisAgent      → テーマ一貫性を維持した統合
    ├─ RetakeAgent         → 感情的整合性を維持した改善
    └─ CollaborativeWriter → コラボレーション時のテーマ共有
```

### MacGuffinContext

キャラクターの隠された秘密と物語の謎を、表層のサインとしてのみWriterに渡す。

```typescript
interface MacGuffinContext {
  characterMacGuffins?: CharacterMacGuffin[];  // 表出サインとして描写
  plotMacGuffins?: PlotMacGuffin[];            // 雰囲気として漂わせる
}
```

**伝播先:**

```
CharacterMacGuffinAgent + PlotMacGuffinAgent
    │
    ▼ macGuffinContext
    ├─ WriterAgent         → テンプレートコンテキストに注入
    ├─ PlotterAgent        → チャプターの描写指示に反映
    └─ CollaborativeWriter → コラボレーション時の共有

    ※ JudgeAgentには渡さない（執筆品質のみで評価するため）
```

---

## 学習パイプライン

高品質な生成結果から新しいソウルテキスト断片を抽出する自律的改善メカニズム。

### トリガー条件

```
compliance_score ≥ 0.85 かつ reader_score ≥ 0.80
```

### フロー

```
高品質チャプター
    │
    ▼
断片抽出（FragmentExtractor）
    │  LLMでカテゴリ推定・切り出し
    │
    ▼
候補プール（DB: soul_candidates, status='pending'）
    │
    ▼
人間レビュー（review コマンド）
    │
    ├─ 承認 → fragments/ に追加
    └─ 却下 → アーカイブ or Anti-Soulに追加
```

---

## Factory（バッチ生成）

**ファイル:** `src/factory/`

複数のストーリーを並列にバッチ生成する。

```
factory コマンド
    │
    ├─ configファイル or CLIオプションで設定
    │
    ▼
BatchRunner
    ├─ ThemeGenerator × N（テーマ並列生成）
    │  └─ motif avoidance: DB内既存テーマとの重複回避
    │
    ├─ FullPipeline × N（並列実行）
    │
    └─ Analytics（統計分析）
       ├─ 平均スコア
       ├─ Token消費量
       └─ 成功率
```

---

## トークン効率化の工夫

| 手法 | 説明 |
|------|------|
| Synthesis時の抽出限定 | 敗者の全文ではなく `praised_excerpts` のみ使用 |
| Anti-Soulの圧縮 | カテゴリ別1-2件、100-150文字に制限 |
| Fragmentのフォーカス制御 | 重点カテゴリは3件、その他は1件 |
| Plotterの構造化入力 | 簡潔なJSON形式でコンテキストを渡す |

---

## エラーハンドリングまとめ

| シナリオ | 対応 | 上限 |
|---------|------|------|
| コンプライアンス違反 | CorrectorAgentで矯正 | 3回 |
| 3回矯正失敗 | Anti-Soulに収集、ベストエフォートで続行 | — |
| 読者陪審員不合格 | RetakeAgentで改善 | 2回 |
| リテイクでスコア悪化 | 前版にロールバック、即中断 | — |
| パイプライン中断 | チェックポイントから再開可能（FullPipeline） | — |
| コラボレーション部分失敗 | `Promise.allSettled()` で部分失敗を許容 | — |
