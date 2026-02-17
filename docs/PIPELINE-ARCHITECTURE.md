# パイプラインアーキテクチャ詳細分析

> 現行コードベース（2026-02-17時点）に基づく実装分析ドキュメント

## 目次

1. [システム全体像](#1-システム全体像)
2. [二系統パイプライン設計](#2-二系統パイプライン設計)
3. [FullPipeline 詳細フロー](#3-fullpipeline-詳細フロー)
4. [SimplePipeline 詳細フロー](#4-simplepipeline-詳細フロー)
5. [エージェント体系](#5-エージェント体系)
6. [トーナメントシステム](#6-トーナメントシステム)
7. [コラボレーションシステム](#7-コラボレーションシステム)
8. [品質保証パイプライン](#8-品質保証パイプライン)
9. [コンテキスト伝播アーキテクチャ](#9-コンテキスト伝播アーキテクチャ)
10. [ストレージ層](#10-ストレージ層)
11. [関数型パイプライン合成](#11-関数型パイプライン合成)
12. [LLMクライアント層](#12-llmクライアント層)
13. [耐障害性とフォールバック](#13-耐障害性とフォールバック)

---

## 1. システム全体像

### アーキテクチャ概要図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLI (src/main.ts)                            │
│  generate │ resume │ review │ factory                                  │
└─────┬─────┴────┬───┴────┬───┴────┬────────────────────────────────────┘
      │          │        │        │
      │          │        │        ▼
      │          │        │  ┌──────────────┐
      │          │        │  │ BatchRunner  │ ─→ FullPipeline × N (並列)
      │          │        │  └──────────────┘
      │          │        │        │
      │          │        │  ┌─────▼──────────────────┐
      │          │        │  │ テーマ自動生成フェーズ    │
      │          │        │  │ ├ ThemeGenerator        │
      │          │        │  │ ├ CharacterDeveloper    │
      │          │        │  │ ├ CharacterMacGuffin    │
      │          │        │  │ ├ PlotMacGuffin         │
      │          │        │  │ └ MotifAnalyzer         │
      │          │        │  └────────────────────────┘
      │          │        │
      ▼          ▼        ▼
┌───────────┐ ┌──────────────┐ ┌──────────────┐
│  Simple   │ │    Full      │ │   Review     │
│ Pipeline  │ │  Pipeline    │ │   (学習候補   │
│           │ │              │ │    承認)     │
└─────┬─────┘ └──────┬───────┘ └──────────────┘
      │              │
      │              │
      ▼              ▼
┌────────────────────────────────────────────────┐
│              コアエンジン層                       │
│  ┌────────────┐ ┌───────────────┐              │
│  │ Tournament │ │ Collaboration │              │
│  │ Arena      │ │ Session       │              │
│  └─────┬──────┘ └───────┬───────┘              │
│        │                │                      │
│        ▼                ▼                      │
│  ┌─────────────────────────────────────────┐   │
│  │         品質保証パイプライン               │   │
│  │ Synthesis → Compliance → Correction     │   │
│  │ → DefectDetector → Retake              │   │
│  └─────────────────────────────────────────┘   │
│                                                │
│  ┌─────────────────────────────────────────┐   │
│  │         学習パイプライン                   │   │
│  │ FragmentExtractor → SoulExpander        │   │
│  │ AntiSoulCollector                       │   │
│  └─────────────────────────────────────────┘   │
└──────────┬────────────────┬────────────────────┘
           │                │
     ┌─────▼─────┐   ┌─────▼──────┐
     │ SoulText  │   │  Storage   │
     │ Manager   │   │  (SQLite)  │
     └─────┬─────┘   └────────────┘
           │
     ┌─────▼──────┐
     │ LLM Client │
     │ (Cerebras) │
     └────────────┘
```

### 技術スタック

| レイヤー | 技術 | ファイル |
|---------|------|---------|
| エントリポイント | CLI (process.argv) | `src/main.ts` |
| LLM | Cerebras Cloud SDK | `src/llm/cerebras.ts` |
| ORM | Drizzle ORM + better-sqlite3 | `src/storage/` |
| バリデーション | Zod v4 | `src/schemas/` |
| テンプレート | YAML + js-yaml (自作エンジン) | `src/template/` |
| テスト | Vitest (544テスト通過) | `*.test.ts` |
| リンター | oxlint | `.oxlintrc.json` |

---

## 2. 二系統パイプライン設計

システムは用途に応じて2つのパイプラインを提供する。

| 特性 | SimplePipeline | FullPipeline |
|------|---------------|-------------|
| **ファイル** | `src/pipeline/simple.ts` | `src/pipeline/full.ts` |
| **用途** | 高速プロトタイプ・単章テスト | 本番マルチチャプター生成 |
| **DB永続化** | なし | あり (SQLite) |
| **チェックポイント** | なし | あり (中断再開可能) |
| **学習パイプライン** | なし | あり (断片抽出→候補プール) |
| **プロット生成** | なし (単章) | あり (Plotter 2フェーズ) |
| **キャラクター強化** | 外部注入のみ | Phase2自動強化 |
| **章間状態追跡** | なし | あり (CrossChapterState) |
| **アーキテクチャパターン** | 関数型パイプライン合成 | オブジェクト型ランナー |

### エントリポイントからの分岐

```
CLI: generate --soul ./soul --prompt "..."
    │
    ├─ --simple        → generateSimple()   → SimplePipeline
    ├─ (デフォルト)     → createFullPipeline() → FullPipeline
    │
    └─ --auto-theme    → テーマ自動生成 → いずれかのパイプラインへ
```

---

## 3. FullPipeline 詳細フロー

`src/pipeline/full.ts` — `createFullPipeline()` が返す `FullPipelineRunner`

### 3.1 全体シーケンス

```
generateStory(prompt)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 0: タスク作成                                          │
│   taskRepo.create() → taskRepo.markStarted()               │
│   → taskId 発行                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: プロット生成 (PlotterAgent)                         │
│   createPlotter() → plotter.generatePlot()                  │
│   → Plot { title, theme, chapters[] }                       │
│   ※ 2フェーズ: スケルトン生成 → チャプター制約付与            │
│   → チェックポイント保存 (plot_generation)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1.5: キャラクター強化 Phase2 (条件付き)                 │
│   config.enrichedCharacters に dialogueSamples がない場合    │
│   createCharacterEnricher() → enricher.enrichPhase2()       │
│   → プロット文脈を考慮した台詞サンプル追加                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: チャプター生成ループ (plot.chapters.forEach)         │
│                                                             │
│   各チャプターで:                                             │
│   ├─ (a) チャプタープロンプト構築 (buildChapterPrompt)        │
│   ├─ (b) テキスト生成 (トーナメント or コラボレーション)       │
│   ├─ (c) Synthesis V2 (トーナメント時のみ)                   │
│   ├─ (d) コンプライアンスチェック                             │
│   ├─ (e) 矯正ループ (違反時、最大3回)                        │
│   ├─ (f) DefectDetector 評価                                │
│   ├─ (g) リテイクループ (不合格時、最大2回)                   │
│   ├─ (h) 中国語汚染フィルタ                                  │
│   ├─ (i) 確立済みインサイト抽出                               │
│   ├─ (j) 章間状態抽出 (CrossChapterState更新)                │
│   └─ (k) チェックポイント保存 (chapter_done)                 │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: アーカイブ & 学習                                    │
│   workRepo.create() → 作品DB保存                             │
│   runLearningPipeline() → 高品質断片の候補プール追加           │
│   taskRepo.markCompleted()                                  │
│                                                             │
│   → FullPipelineResult {                                     │
│       taskId, plot, chapters[], totalTokensUsed,             │
│       compliancePassRate, verdictDistribution,               │
│       learningCandidates, antiPatternsCollected              │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 チャプタープロンプト構築

`src/pipeline/chapter-prompt.ts` — `buildChapterPrompt()`

複数のコンテキストソースを統合して、各Writerに渡すプロンプトを構築する。

```
buildChapterPrompt()
    │
    ├─ チャプター要約 (Plot → chapter.summary)
    ├─ テーマコンテキスト (emotion, timeline, tone)
    ├─ ナラティブルール (POV, 人称, 主人公)
    ├─ 開発済みキャラクター (role, description, voice)
    ├─ 強化キャラクター (physicalHabits, stance, dynamics, dialogueSamples)
    ├─ キャラクターマクガフィン (表出サインとして描写)
    ├─ プロットマクガフィン (雰囲気として漂わせる)
    ├─ モチーフ回避リスト (使い古されたモチーフを避ける)
    ├─ 確立済みインサイト (前章からの蓄積情報)
    ├─ 章間状態 (キャラクターアーク, モチーフ摩耗度)
    ├─ バリエーション軸制約 (Plotter Phase2で生成)
    └─ 前章分析 (analyzePreviousChapter() の結果)
```

### 3.3 章間コヒーレンス機構

`src/pipeline/cross-chapter-state.ts` + `src/agents/chapter-state-extractor.ts`

各章の生成後、LLMがテキストを分析して以下の状態を抽出・更新する。

```typescript
CrossChapterState {
  characterStates: CharacterState[]     // キャラクターの感情・関係の現在地
  motifWear: MotifWearEntry[]           // モチーフ使用回数と摩耗度
  variationHint: string | null          // 次章への推奨アプローチ
  chapterSummaries: ChapterSummary[]    // 各章の要約・トーン・ピーク強度
}
```

**モチーフ摩耗度 (Motif Wear)**:
- `fresh` (≤1回): 新鮮、積極的に使用可
- `used` (≤3回): 使用済み、控えめに
- `worn` (≤5回): 摩耗、別の表現を推奨
- `exhausted` (>5回): 消耗、使用を避ける

---

## 4. SimplePipeline 詳細フロー

`src/pipeline/simple.ts` — 関数型パイプライン合成パターンで構築

### 4.1 `--simple` モード (トーナメントのみ)

```
入力プロンプト → トーナメント/コラボレーション → 結果出力
```

### 4.2 通常モード (後処理あり)

```
入力プロンプト
    │
    ▼
生成ステージ (Tournament or Collaboration)
    │
    ▼
tryStage(SynthesisV2)  ← 失敗時はスキップ
    │
    ▼
ComplianceStage        ← 違反検出
    │
    ├─ 違反あり → when() → CorrectionStage (最大3回)
    │
    ▼
AntiSoulCollectionStage ← 失敗パターン収集
    │
    ▼
DefectDetectorStage    ← 多次元品質評価
    │
    ▼
PipelineResult
```

### 4.3 パイプライン合成 (実装詳細)

```typescript
// src/pipeline/simple.ts:86-93
pipe(
  generationStage,                                         // Tournament or Collaboration
  tryStage(createSynthesisV2Stage()),                      // エラー時スキップ
  createComplianceStage(),                                 // コンプライアンスチェック
  when(ctx => !ctx.complianceResult?.isCompliant,          // 条件付き実行
       createCorrectionStage(maxCorrections)),
  createAntiSoulCollectionStage(),                         // Anti-Soul収集
  createDefectDetectorStage(),                             // 品質評価
);
```

`pipe`, `when`, `tryStage` は `src/pipeline/compose.ts` に定義された合成ユーティリティ。

---

## 5. エージェント体系

### 5.1 全エージェント一覧

#### テキスト生成エージェント

| エージェント | ファイル | 入力 | 出力 | LLMモード |
|-------------|---------|------|------|----------|
| WriterAgent | `src/agents/writer.ts` | プロンプト + ソウルテキスト + コンテキスト | 生成テキスト | `complete()` (可変temperature) |
| CollaborativeWriter | `src/collaboration/collaborative-writer.ts` | プロンプト + ラウンドコンテキスト | アクション (proposal/feedback/draft/volunteer) | `callTools()` |
| PlotterAgent | `src/agents/plotter.ts` | テーマ + 章数 + ソウルテキスト | Plot (2フェーズ) | `completeStructured()` |
| SynthesisV2 | `src/synthesis/synthesis-v2.ts` | チャンピオン + 敗者テキスト群 | 強化テキスト (2パス) | `completeStructured()` + `complete()` |

#### 評価エージェント

| エージェント | ファイル | 入力 | 出力 | LLMモード |
|-------------|---------|------|------|----------|
| JudgeAgent | `src/agents/judge.ts` | テキストA + テキストB | 勝者 + スコア詳細 | `completeStructured()` |
| DefectDetector | `src/agents/defect-detector.ts` | テキスト + コンテキスト | Verdict + Defects | `completeStructured()` |
| ReaderJuryAgent | `src/agents/reader-jury.ts` | テキスト + ペルソナ群 | 多角的評価スコア | `completeStructured()` × N |
| ReaderEvaluator | `src/agents/reader-evaluator.ts` | テキスト + 単一ペルソナ | 個別評価 | `completeStructured()` |

#### 矯正・改善エージェント

| エージェント | ファイル | 入力 | 出力 | LLMモード |
|-------------|---------|------|------|----------|
| CorrectorAgent | `src/agents/corrector.ts` | テキスト + 違反リスト | 修正テキスト | `complete()` |
| RetakeAgent | `src/retake/retake-agent.ts` | テキスト + フィードバック + 欠陥 | 改善テキスト | `complete()` |

#### 進行管理エージェント

| エージェント | ファイル | 入力 | 出力 | LLMモード |
|-------------|---------|------|------|----------|
| ModeratorAgent | `src/collaboration/moderator.ts` | アクション群 + フェーズ状態 | 進行指示 + 合意度 | `callTools()` |

#### ファクトリーエージェント

| エージェント | ファイル | 入力 | 出力 | LLMモード |
|-------------|---------|------|------|----------|
| ThemeGenerator | `src/factory/theme-generator.ts` | 既存テーマ群 + 回避リスト | テーマ + キャラクター (2段階) | `completeStructured()` |
| CharacterDeveloper | `src/factory/character-developer.ts` | テーマ + キャラクター骨格 | DevelopedCharacter[] | `completeStructured()` |
| CharacterEnricher | `src/factory/character-enricher.ts` | DevelopedCharacter + Plot | EnrichedCharacter[] (2フェーズ) | `completeStructured()` |
| CharacterMacGuffin | `src/factory/character-macguffin.ts` | キャラクター群 | 隠された秘密 | `completeStructured()` |
| PlotMacGuffin | `src/factory/plot-macguffin.ts` | テーマ + キャラマクガフィン | 物語の謎 | `completeStructured()` |
| MotifAnalyzer | `src/factory/motif-analyzer.ts` | 過去作品群 | 頻出モチーフリスト | `completeStructured()` |
| ChapterStateExtractor | `src/agents/chapter-state-extractor.ts` | テキスト + 前章状態 | 章間状態 | `completeStructured()` |

### 5.2 エージェント生成パターン

全エージェントは**ファクトリー関数パターン**で実装されている。

```typescript
// 典型的なパターン
function createWriter(deps: WriterDeps): Writer {
  return {
    async generate(prompt: string): Promise<GenerationResult> {
      // 1. YAMLテンプレートをロード
      // 2. コンテキスト変数でレンダリング
      // 3. LLMClient.complete() を呼び出し
      // 4. 結果を返却
    }
  };
}
```

**依存注入のポイント**:
- `llmClient`: LLMへのアクセス
- `soulText`: ソウルテキスト四層構造
- `config`: エージェント固有の設定 (temperature, topP等)
- `narrativeRules`: 視点・人称ルール
- `themeContext`, `macGuffinContext`: コンテキスト情報

---

## 6. トーナメントシステム

`src/tournament/arena.ts` — `createTournamentArena()`

### 6.1 トーナメント構造

```
                       ┌─────────────────────┐
                       │    全Writer並列生成   │
                       │   Promise.all([     │
                       │     w1.generate(),   │
                       │     w2.generate(),   │
                       │     w3.generate(),   │
                       │     w4.generate()    │
                       │   ])                 │
                       └──────────┬──────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐          │
    │ Writer 1       │  │ Writer 2       │          │
    │ t=温度スロット1  │  │ t=温度スロット2  │          │
    └────────┬───────┘  └────────┬───────┘          │
             └────────┬──────────┘                   │
                      ▼                              │
              ┌───────────────┐                      │
              │  Semi-Final 1 │                      │
              │  (Judge)      │                      │
              └───────┬───────┘                      │
                      │ Winner A                     │
                      │                              │
    ┌─────────────────┼─────────────────────┐        │
    │                 │    ┌─────────────────▼────────▼──┐
    │                 │    │ Writer 3       │ Writer 4    │
    │                 │    │ t=温度スロット3  │ t=温度スロット4│
    │                 │    └────────┬───────┘───┬────────┘
    │                 │             └─────┬─────┘
    │                 │                   ▼
    │                 │           ┌───────────────┐
    │                 │           │  Semi-Final 2 │
    │                 │           │  (Judge)      │
    │                 │           └───────┬───────┘
    │                 │                   │ Winner B
    │                 │                   │
    │                 └────────┬──────────┘
    │                          ▼
    │                  ┌───────────────┐
    │                  │    Final      │
    │                  │   (Judge)     │
    │                  └───────┬───────┘
    │                          │
    │                          ▼
    │                  ┌───────────────┐
    │                  │   Champion    │
    │                  └───────────────┘
    │
    └─ TournamentResult {
         champion, championText, rounds[],
         allGenerations[], totalTokensUsed
       }
```

### 6.2 Writer多様性設計

温度スロットは `soul/prompt-config.yaml` で設定可能。

```yaml
tournament:
  temperature_slots:
    - label: low
      range: [0.4, 0.55]
      topP_range: [0.75, 0.85]
    - label: mid
      range: [0.55, 0.7]
      topP_range: [0.8, 0.9]
    - label: mid-high
      range: [0.7, 0.85]
      topP_range: [0.85, 0.92]
    - label: high
      range: [0.85, 0.95]
      topP_range: [0.9, 0.97]
```

ペルソナプール (`src/tournament/persona-pool.ts`) がスロットごとにWriterを選出し、温度範囲内でランダム値を割り当てる。

### 6.3 Judge評価軸

```
style            ── ソウルテキストの文体への忠実度
voice_accuracy   ── キャラクター声の再現度
originality      ── 原典の精神を拡張するオリジナリティ
structure        ── 構成、テンポ、シーン配置
amplitude        ── 感情曲線の振幅 (ピーク-ボトム差)
agency           ── キャラクターの能動的選択
stakes           ── 何が危険にさらされているかの明確さ
compliance       ── ルール遵守度
```

出力: `JudgeResult` (構造化出力、JSONスキーマ指定)

### 6.4 並列実行戦略

| 処理 | 実行方式 | 理由 |
|------|---------|------|
| Writer生成 (4名) | `Promise.all()` | 独立した生成、並列化で高速化 |
| Judge審査 (準決勝→決勝) | 逐次 | 前ラウンドの結果に依存 |
| 読者ペルソナ評価 | `Promise.all()` | 独立した評価 |
| コラボレーション各ラウンド | `Promise.allSettled()` | 部分失敗を許容 |

---

## 7. コラボレーションシステム

`src/collaboration/` — トーナメントの代替モード

### 7.1 フェーズ遷移

```
┌──────────────────────────────────────────────────────────┐
│ Proposal Phase (提案)                                     │
│   全Writerがアプローチ・構成を並列に提案                     │
│   Moderatorがアクションを分析                               │
│   → セクション割り当て or Discussion Phase へ遷移           │
├──────────────────────────────────────────────────────────┤
│ Discussion Phase (議論)                                   │
│   Writerが互いにフィードバックを提供                         │
│   Moderatorが合意度 (consensusScore) を計算                │
│   → 合意度が閾値未満: 議論継続                              │
│   → 合意度が閾値以上: Drafting Phase へ遷移                │
├──────────────────────────────────────────────────────────┤
│ Drafting Phase (起草)                                     │
│   割り当てセクションをWriter各自が執筆                       │
│   ドラフトを収集                                           │
│   → Review Phase へ遷移                                   │
├──────────────────────────────────────────────────────────┤
│ Review Phase (レビュー)                                    │
│   Writerが相互レビュー・改善提案                             │
│   Moderatorが最終合意度を評価                               │
│   → 合意 + ドラフト完成: 終了                               │
│   → 未達: 追加ラウンド (安全上限: 20ラウンド)               │
└──────────────────────────────────────────────────────────┘
          │
          ▼
   Moderator.composeText()
   → 最終テキスト統合
```

### 7.2 CollaborativeWriter アクション

```typescript
type CollaborativeAction =
  | { type: 'proposal'; content: string }      // アプローチ提案
  | { type: 'feedback'; content: string }      // 他者への意見
  | { type: 'draft'; content: string }         // セクション起草
  | { type: 'volunteer'; sections: string[] }  // 担当セクション立候補
```

### 7.3 トーナメントとの比較

| 観点 | トーナメント | コラボレーション |
|------|------------|----------------|
| 選出方式 | 競争的選出 (Judge) | 合意形成 (Moderator) |
| テキスト統合 | Synthesis V2 (チャンピオン+敗者) | Moderator composeText |
| 速度 | 高速 (3ラウンド固定) | 可変 (最大20ラウンド) |
| Writer間相互作用 | なし (独立生成) | あり (feedback, review) |
| 失敗時 | 敗者テキストも利用可 | 部分失敗を`allSettled`で許容 |

---

## 8. 品質保証パイプライン

### 8.1 Synthesis V2 (統合)

`src/synthesis/synthesis-v2.ts` — トーナメント後、チャンピオンテキストを強化

```
Pass 1: SynthesisAnalyzer (構造化出力)
    │
    │  入力:
    │  ├─ チャンピオンテキスト
    │  ├─ 全敗者テキスト
    │  ├─ Judgeの praised_excerpts (褒められた抜粋)
    │  └─ ラウンド結果
    │
    │  出力: SynthesisPlan {
    │    championAssessment    // チャンピオン評価
    │    preserveElements[]    // 保持すべき要素
    │    actions[]             // 改善アクション (insertion, replacement, style_enhancement)
    │    expressionSources[]   // 表現の借用元 (どの敗者から何を)
    │  }
    │
    ▼
Pass 2: SynthesisExecutor (テキスト生成)
    │
    │  入力: チャンピオンテキスト + SynthesisPlan
    │  出力: 強化されたテキスト
    │
    ▼
SynthesisV2Result { synthesizedText, plan, totalTokensUsed }
```

### 8.2 コンプライアンスチェック

`src/compliance/` — ルールベース + LLMベースの二重チェック

#### 同期ルール (即座に判定)

| ルール | ファイル | 検出対象 | 重要度 |
|-------|---------|---------|-------|
| ForbiddenWords | `rules/forbidden-words.ts` | 禁止語彙 (とても, 非常に等) | error |
| ForbiddenSimiles | `rules/forbidden-similes.ts` | 禁止比喩 (花のような等) | error |
| SpecialMarks | `rules/special-marks.ts` | × の誤用 | error |
| POVConsistency | `rules/pov-consistency.ts` | 視点・人称の揺れ | error |
| RhythmCheck | `rules/rhythm-check.ts` | 文の長さ制約 | warning |
| MarkdownContamination | `rules/markdown-contamination.ts` | Markdown構文混入 | error |
| ChineseContamination | `rules/chinese-contamination.ts` | 中国語テキスト漏れ | error |
| QuoteOriginality | `rules/quote-originality.ts` | 断片からの直接コピー | error |

#### 非同期ルール (LLM呼び出し)

| ルール | 検出対象 | 重要度 |
|-------|---------|-------|
| SelfRepetition | LLM自己模倣の検出 | warning |
| ChapterVariation | 章間の多様性不足 | warning |

**違反レベル**:
- `error`: 矯正必須 (isCompliant = false)
- `warning`: 助言的 (isCompliant には影響しないが、DefectDetectorに伝播)

### 8.3 矯正ループ

`src/correction/loop.ts` — `createCorrectionLoop()`

```
テキスト + 違反リスト
    │
    ▼
┌───────────────────────────────────────────┐
│ ループ (最大3回)                            │
│                                           │
│   Corrector.correct(text, violations)     │
│   → 修正テキスト                            │
│                                           │
│   Checker.check(修正テキスト)               │
│   → ComplianceResult                      │
│                                           │
│   ├─ isCompliant = true → 成功、脱出      │
│   └─ isCompliant = false → 次の試行       │
│                                           │
│   ※ マルチターン: 過去の修正試行を         │
│     メッセージ履歴として蓄積               │
└───────────────────────────────────────────┘
    │
    ├─ 成功 → 修正テキストを返却
    └─ 3回失敗 → AntiSoulCollector に失敗パターンを収集
                  ベストエフォートのテキストで続行
```

### 8.4 DefectDetector (欠陥検出)

`src/agents/defect-detector.ts` — `createDefectDetector()`

多次元の品質評価を行い、Verdict (判定) を出す新システム。

**評価次元**:

| 次元 | 評価内容 |
|------|---------|
| Style Consistency | 文体の一貫性 |
| Characterization | キャラクター動機・行動の真正性 |
| Plot Coherence | ストーリーロジック、テンポ |
| Thematic Integrity | テーマの実現度 |
| Emotional Impact | 読者への感情的影響 |
| Originality | 新鮮なアプローチ |
| Technical Execution | 文法、フロー |

**Verdict レベル**:

| レベル | 意味 | 学習パイプライン |
|-------|------|----------------|
| `exceptional` | 最小限の修正で出版可能 | 候補プールに追加 |
| `publishable` | 軽微な修正後に出版可能 | 候補プールに追加 |
| `developmental` | 大幅な改訂が必要 | スキップ |
| `rejected` | 根本的な問題あり | スキップ |

**欠陥カテゴリ**: `critical` / `major` / `minor`

### 8.5 リテイクループ

`src/retake/retake-agent.ts` — `createRetakeAgent()`

```
DefectDetector 不合格
    │
    ▼
buildRetakeFeedback(defects, judgeWeaknesses, verdictLevel)
    │  → 構造化フィードバック
    │
    ▼
┌───────────────────────────────────────────┐
│ ループ (最大2回)                            │
│                                           │
│   RetakeAgent.retake(text, feedback)      │
│   → 改善テキスト                            │
│                                           │
│   Checker.check(改善テキスト)               │
│   DefectDetector.detect(改善テキスト)       │
│                                           │
│   ├─ passed = true → 合格、脱出           │
│   └─ passed = false → 次のリテイク        │
└───────────────────────────────────────────┘
```

---

## 9. コンテキスト伝播アーキテクチャ

パイプラインを通じて各エージェントに伝播する主要なコンテキスト。

### 9.1 ThemeContext

テーマの感情・トーン・時系列を一貫して伝播。

```
ThemeGeneratorAgent
    │
    ▼ ThemeContext { emotion, timeline, premise, tone, narrative_type, scene_types }
    │
    ├─→ WriterAgent           (テンプレートコンテキスト)
    ├─→ JudgeAgent            (テーマ整合性の評価基準)
    ├─→ CorrectorAgent        (トーンを保持した矯正)
    ├─→ SynthesisV2           (テーマ一貫性を維持)
    ├─→ RetakeAgent           (感情的整合性を維持)
    ├─→ DefectDetector        (toneDirective として)
    └─→ CollaborativeWriter   (テーマ共有)
```

### 9.2 MacGuffinContext

キャラクターの秘密と物語の謎を、表層のサインとしてのみWriterに渡す。

```
CharacterMacGuffinAgent + PlotMacGuffinAgent
    │
    ▼ MacGuffinContext { characterMacGuffins[], plotMacGuffins[] }
    │
    ├─→ WriterAgent           (テンプレートコンテキストに注入)
    ├─→ PlotterAgent          (チャプターの描写指示に反映)
    ├─→ SynthesisV2           (一貫性維持)
    └─→ CollaborativeWriter   (コラボレーション時の共有)

    ※ JudgeAgent には渡さない (執筆品質のみで評価するため)
```

### 9.3 NarrativeRules

視点・人称・主人公の動的解決。

```typescript
NarrativeRules {
  pov: 'first-person' | 'third-person-limited' | 'mixed' | ...
  pronoun: 'わたし' | null
  protagonist: '透心' | null
  povDescription: string
  isDefaultProtagonist: boolean
}
```

`src/factory/narrative-rules.ts` — `resolveNarrativeRules()` が narrative_type とキャラクターリストから自動解決。

### 9.4 CrossChapterState

章間の累積コンテキスト。各章の生成後に更新され、次章のWriter/DefectDetectorに渡される。

```
Chapter 1 生成 → ChapterStateExtractor → CrossChapterState v1
Chapter 2 生成 → ChapterStateExtractor → CrossChapterState v2 (累積更新)
Chapter 3 生成 → ChapterStateExtractor → CrossChapterState v3 (累積更新)
    :
```

### 9.5 Judge分析データの下流伝播

```
Tournament
    │
    ▼ JudgeResult (最終ラウンド)
    │
    ├─→ judgeWeaknesses[]   → DefectDetector, RetakeAgent
    ├─→ judgeAxisComments[] → DefectDetector
    ├─→ judgeReasoning      → SynthesisV2, DefectDetector
    └─→ praised_excerpts    → SynthesisV2 (借用元の特定)
```

---

## 10. ストレージ層

`src/storage/` — SQLite + Drizzle ORM

### 10.1 データベーススキーマ

#### コアテーブル

| テーブル | 用途 | 主要カラム |
|---------|------|-----------|
| `works` | 完成作品 | id, soul_id, title, content, total_chapters, total_tokens, compliance_score, verdict_level |
| `chapters` | 各章のデータ | work_id, chapter_index, text, champion_writer_id |
| `tasks` | 生成タスク管理 | id, soul_id, status (pending/started/completed/failed), params |
| `checkpoints` | チェックポイント | task_id, phase, state (JSON), progress (JSON) |
| `soul_candidates` | 学習候補 | soul_id, work_id, category, text, score, status (pending/approved/rejected) |

#### 分析テーブル (オプション、非致命的)

| テーブル | 用途 |
|---------|------|
| `judge_sessions` | 各ラウンドのJudge評価詳細 |
| `chapter_evaluations` | DefectDetector結果 |
| `synthesis_plans` | Synthesis V2の改善計画 |
| `correction_history` | 矯正ループの履歴 |
| `cross_chapter_states` | 章間状態の推移 |
| `phase_metrics` | 各フェーズの所要時間・トークン使用量 |

### 10.2 リポジトリパターン

全リポジトリは関数型パターン (FP) で実装。

```typescript
// 例: TaskRepo
interface TaskRepo {
  create(data: CreateTaskData): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  markStarted(id: string): Promise<void>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
```

分析系リポジトリは**非致命的**設計:
- 保存失敗時は `logger?.debug()` で記録するのみ
- パイプラインの実行を妨げない

---

## 11. 関数型パイプライン合成

`src/pipeline/compose.ts` — SimplePipelineで使用される合成ユーティリティ

### 11.1 基本型

```typescript
type PipelineStage = (ctx: PipelineContext) => Promise<PipelineContext>;
```

### 11.2 合成関数

| 関数 | 役割 | 使用例 |
|------|------|-------|
| `pipe(...stages)` | ステージを逐次実行 | `pipe(gen, synth, compliance)` |
| `when(pred, stage)` | 条件付き実行 | `when(ctx => !ctx.isCompliant, correction)` |
| `tryStage(stage)` | エラー時スキップ | `tryStage(synthesisV2)` |

### 11.3 PipelineContext

```typescript
interface PipelineContext {
  text: string;                          // 現在のテキスト
  prompt: string;                        // 入力プロンプト
  tokensUsed: number;                    // 累積トークン数
  correctionAttempts: number;            // 矯正回数
  synthesized: boolean;                  // Synthesis実行済みフラグ
  readerRetakeCount: number;             // リテイク回数
  deps: PipelineDeps;                    // 依存オブジェクト群

  // 各ステージで追加される結果
  champion?: string;
  tournamentResult?: TournamentResult;
  complianceResult?: ComplianceResult;
  readerJuryResult?: ReaderJuryResult;
}
```

---

## 12. LLMクライアント層

`src/llm/cerebras.ts` — Cerebras Cloud SDK ラッパー

### 12.1 インターフェース

```typescript
interface LLMClient {
  complete(systemPrompt, userPrompt, options): Promise<string>;
  completeStructured(messages, schema, options): Promise<StructuredResponse>;
  callTools(messages, tools, options): Promise<ToolCallResponse>;
  getTotalTokens(): number;
}
```

### 12.2 呼び出しモード

| モード | 用途 | 使用エージェント |
|-------|------|----------------|
| `complete()` | フリーテキスト生成 | Writer, Corrector, RetakeAgent, SynthesisExecutor |
| `completeStructured()` | JSON構造化出力 | Judge, Plotter, DefectDetector, ThemeGenerator, 各種分析系 |
| `callTools()` | ツール呼び出し | FragmentExtractor, CollaborativeWriter, ModeratorAgent |

### 12.3 耐障害性

- **リトライ**: 最大5回、指数バックオフ
- **サーキットブレーカー**: 連続失敗時に一時停止
- **トークン追跡**: 全呼び出しで累積カウント
- **JSON Schema互換性**: Cerebras非対応キーワードの自動除去

---

## 13. 耐障害性とフォールバック

### 13.1 グレースフルデグラデーション

| コンポーネント | 失敗時の動作 |
|-------------|-------------|
| Judge (構造化出力パース失敗) | デフォルト結果にフォールバック |
| Synthesis V2 | チャンピオンテキストをそのまま使用 |
| 矯正ループ (3回失敗) | Anti-Soulに収集、ベストエフォートで続行 |
| 学習パイプライン | スキップ (非致命的) |
| 分析リポジトリ保存 | ログ出力のみ (非致命的) |
| 章間状態抽出 | 部分的状態で続行 |
| キャラクター強化 Phase2 | Phase1の情報のみで続行 |

### 13.2 チェックポイントと再開

```
チェックポイント保存タイミング:
  ├─ plot_generation  → プロット生成完了時
  └─ chapter_done     → 各チャプター完了時

再開フロー (resume コマンド):
  1. checkpointManager.getResumeState(taskId)
  2. 完了済みチャプターをロード
  3. CrossChapterState を再構築 (全完了章を再分析)
  4. 残りチャプターから生成を再開
```

### 13.3 中国語汚染フィルタ

`src/pipeline/filters/chinese-filter.ts` — `filterChineseContamination()`

LLMが誤って中国語テキストを混入させるケースに対応するポストプロセッシングフィルタ。各チャプター完了後に自動適用。

---

## 付録: データフロー全体図

```
                    ┌──────────────────────────────┐
                    │         User Input           │
                    │  (CLI: generate/factory)     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     auto-theme? ──YES──→     │
                    │  ┌────────────────────────┐  │
                    │  │ ThemeGenerator         │  │
                    │  │ CharacterDeveloper     │  │
                    │  │ CharacterEnricher P1   │  │
                    │  │ CharacterMacGuffin     │  │
                    │  │ PlotMacGuffin          │  │
                    │  │ MotifAnalyzer          │  │
                    │  └────────────────────────┘  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     PlotterAgent             │
                    │  Phase1: スケルトン生成        │
                    │  Phase2: 制約付与             │
                    │  → Plot { chapters[] }       │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  CharacterEnricher Phase2    │
                    │  (プロット文脈で台詞サンプル)   │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼──── チャプターループ ────┐
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   buildChapterPrompt()       │         │
              │     │   (12コンテキスト統合)          │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              │          ┌─────────┴──────────┐              │
              │          │                    │              │
              │     ┌────▼────┐         ┌─────▼──────┐      │
              │     │Tournament│        │Collaboration│     │
              │     │ W×4→J×3 │        │ W×N + Mod  │      │
              │     └────┬────┘         └─────┬──────┘      │
              │          └─────────┬──────────┘              │
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   Synthesis V2               │         │
              │     │   (トーナメント時のみ)          │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   Compliance Check           │         │
              │     │   → 違反あり → Correction     │         │
              │     │     (最大3回)                  │         │
              │     │   → 3回失敗 → AntiSoul収集    │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   DefectDetector             │         │
              │     │   → 不合格 → RetakeAgent     │         │
              │     │     (最大2回)                  │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   Chinese Contamination      │         │
              │     │   Filter                     │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   Cross-Chapter State        │         │
              │     │   Extraction & Update        │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              │     ┌──────────────▼───────────────┐         │
              │     │   Checkpoint Save            │         │
              │     └──────────────┬───────────────┘         │
              │                    │                         │
              └────────────────────┴── 次チャプター ─────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   Work Archive (DB)          │
                    │   Learning Pipeline          │
                    │   ├ FragmentExtractor        │
                    │   ├ SoulExpander             │
                    │   └ → soul_candidates        │
                    └──────────────────────────────┘
```
