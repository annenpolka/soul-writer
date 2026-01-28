# soul-writer アーキテクチャ設計

## 1. システム構成図

```
┌─────────────────────────────────────────────────────────────────────┐
│                           soul-writer                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐    │
│  │      CLI       │    │   Web Server   │    │    Worker      │    │
│  │                │    │                │    │   (daemon)     │    │
│  │  - init        │    │  - REST API    │    │                │    │
│  │  - produce     │    │  - WebSocket   │    │  - 生成ループ  │    │
│  │  - status      │    │  - Dashboard   │    │  - キュー消化  │    │
│  │  - archive     │    │                │    │                │    │
│  │  - soul        │    │                │    │                │    │
│  │  - serve       │    │                │    │                │    │
│  └───────┬────────┘    └───────┬────────┘    └───────┬────────┘    │
│          │                     │                     │              │
│          └──────────┬──────────┴──────────┬──────────┘              │
│                     │                     │                          │
│          ┌──────────▼──────────┐ ┌────────▼─────────┐              │
│          │     Core Engine     │ │   Storage Layer  │              │
│          │                     │ │                  │              │
│          │  ┌───────────────┐  │ │  ┌────────────┐  │              │
│          │  │   SoulText    │  │ │  │  SQLite    │  │              │
│          │  │   Manager     │  │ │  │            │  │              │
│          │  └───────────────┘  │ │  │ - works    │  │              │
│          │                     │ │  │ - queue    │  │              │
│          │  ┌───────────────┐  │ │  │ - souls    │  │              │
│          │  │   Pipeline    │  │ │  │ - history  │  │              │
│          │  │   Controller  │  │ │  └────────────┘  │              │
│          │  └───────────────┘  │ │                  │              │
│          │                     │ │  ┌────────────┐  │              │
│          │  ┌───────────────┐  │ │  │   File     │  │              │
│          │  │   Tournament  │  │ │  │  System    │  │              │
│          │  │   Arena       │  │ │  │            │  │              │
│          │  └───────────────┘  │ │  │ - soul/    │  │              │
│          │                     │ │  │ - exports/ │  │              │
│          │  ┌───────────────┐  │ │  └────────────┘  │              │
│          │  │   Agents      │  │ └──────────────────┘              │
│          │  │   Registry    │  │                                    │
│          │  └───────────────┘  │                                    │
│          └──────────┬──────────┘                                    │
│                     │                                                │
│          ┌──────────▼──────────┐                                    │
│          │     LLM Client      │                                    │
│          │  (OpenAI互換API)    │                                    │
│          └─────────────────────┘                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. モジュール構成

### 2.1 エントリポイント層

| モジュール | 責務 |
|-----------|------|
| CLI | コマンドラインインターフェース |
| Web Server | REST API + WebSocket + 静的ファイル配信 |
| Worker | バックグラウンド生成ループ |

### 2.2 コアエンジン層

| モジュール | 責務 |
|-----------|------|
| SoulText Manager | ソウルテキストの読み込み・管理・適合度計算 |
| Pipeline Controller | 生成パイプラインの制御・チェックポイント |
| Tournament Arena | 4人トーナメントの実行 |
| Agents Registry | 各種エージェントの管理・呼び出し |

### 2.3 ストレージ層

| モジュール | 責務 |
|-----------|------|
| SQLite | 作品・履歴・キュー・候補の永続化 |
| File System | ソウルテキスト・エクスポートファイルの管理 |

---

## 3. データフロー

### 3.1 生成フロー

```
┌─────────┐
│ Request │  CLI: produce / Web: POST /api/produce
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────┐
│            Queue (SQLite)               │
│  INSERT INTO task_queue (...)           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│              Worker                     │
│  while (true) {                         │
│    task = dequeue()                     │
│    if (task) process(task)              │
│    else sleep()                         │
│  }                                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Pipeline Controller             │
│                                         │
│  1. Load SoulText                       │
│  2. Generate Plot (Plotter Agent)       │
│  3. For each chapter:                   │
│     a. Run Tournament                   │
│     b. Check Compliance                 │
│     c. Save Checkpoint                  │
│  4. Evaluate (Reader Jury)              │
│  5. Archive Result                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│            Archive (SQLite)             │
│  INSERT INTO works (...)                │
│  INSERT INTO generations (...)          │
│  INSERT INTO soul_candidates (...)      │
└─────────────────────────────────────────┘
```

### 3.2 トーナメントフロー

```
         ┌─────────────┐
         │   Input:    │
         │ Chapter Req │
         └──────┬──────┘
                │
     ┌──────────┼──────────┐
     │          │          │
     ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Writer 1│ │Writer 2│ │Writer 3│ │Writer 4│
│ t=0.7  │ │ t=0.9  │ │ t=0.5  │ │ t=0.8  │
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
    │          │          │          │
    └────┬─────┘          └────┬─────┘
         │                     │
         ▼                     ▼
    ┌─────────┐           ┌─────────┐
    │ Judge 1 │           │ Judge 2 │
    │ (1 vs 2)│           │ (3 vs 4)│
    └────┬────┘           └────┬────┘
         │                     │
         │   Winner A          │   Winner B
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
               ┌─────────┐
               │  Final  │
               │  Judge  │
               └────┬────┘
                    │
                    ▼
              ┌───────────┐
              │  Champion │
              └───────────┘
```

### 3.3 自動学習フロー

```
┌─────────────────────────────────────────┐
│         High Score Detection            │
│  compliance >= 0.85 && reader >= 0.80   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Fragment Extraction             │
│  - カテゴリ推定                          │
│  - 断片の切り出し                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Candidate Pool (SQLite)         │
│  INSERT INTO soul_candidates            │
│  (status='pending')                     │
└────────────────┬────────────────────────┘
                 │
                 ▼ (定期的に)
┌─────────────────────────────────────────┐
│         Human Review (Dashboard)        │
│  - 候補一覧表示                          │
│  - 断片プレビュー                        │
│  - 承認 / 却下                           │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
      承認            却下
         │               │
         ▼               ▼
┌─────────────┐  ┌─────────────┐
│ Soul Update │  │   Archive   │
│ fragments/  │  │  or Anti    │
│ に追加      │  │  Soulに追加 │
└─────────────┘  └─────────────┘
```

---

## 4. 状態遷移図

### 4.1 タスクの状態

```
                    ┌─────────┐
                    │ pending │
                    └────┬────┘
                         │ dequeue
                         ▼
                   ┌───────────┐
          ┌───────│ in_progress│───────┐
          │       └─────┬─────┘       │
          │             │             │
      error │       complete      checkpoint
          │             │             │
          ▼             ▼             ▼
     ┌────────┐   ┌──────────┐  ┌──────────┐
     │ failed │   │ completed│  │ suspended│
     └────────┘   └──────────┘  └────┬─────┘
                                     │ resume
                                     ▼
                               ┌───────────┐
                               │ in_progress│
                               └───────────┘
```

### 4.2 章生成の状態

```
┌────────────────┐
│ plot_generation│
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ chapter_start  │ ◄─────────────────┐
└───────┬────────┘                   │
        │                            │
        ▼                            │
┌────────────────┐                   │
│  tournament    │                   │
└───────┬────────┘                   │
        │                            │
        ▼                            │
┌────────────────┐                   │
│  compliance    │                   │
└───────┬────────┘                   │
        │                            │
    ┌───┴───┐                        │
    │       │                        │
  pass    fail                       │
    │       │                        │
    │       ▼                        │
    │  ┌──────────┐                  │
    │  │correction│                  │
    │  └────┬─────┘                  │
    │       │                        │
    │   ┌───┴───┐                    │
    │   │       │                    │
    │ pass   fail (3回)              │
    │   │       │                    │
    │   │       ▼                    │
    │   │  ┌──────────┐              │
    │   │  │add_to_   │              │
    │   │  │anti_soul │              │
    │   │  └────┬─────┘              │
    │   │       │                    │
    └───┴───────┤                    │
                │                    │
                ▼                    │
        ┌────────────────┐           │
        │ chapter_done   │           │
        └───────┬────────┘           │
                │                    │
            ┌───┴───┐                │
            │       │                │
       last chapter │                │
            │       │                │
            ▼       └────────────────┘
    ┌────────────────┐       next chapter
    │ reader_jury    │
    └───────┬────────┘
            │
            ▼
    ┌────────────────┐
    │    archive     │
    └───────┬────────┘
            │
            ▼
    ┌────────────────┐
    │   completed    │
    └────────────────┘
```

---

## 5. インターフェース定義（言語非依存）

### 5.1 LLM Client Interface

```
interface LLMClient {
  // 基本的な補完
  complete(
    system_prompt: string,
    user_prompt: string,
    options: {
      temperature?: number,
      max_tokens?: number,
      top_p?: number
    }
  ): string

  // 構造化出力（JSON Schema対応）
  complete_structured<T>(
    system_prompt: string,
    user_prompt: string,
    schema: JSONSchema,
    options: CompletionOptions
  ): T

  // トークン消費量の取得
  get_total_tokens(): number
}
```

### 5.2 SoulText Interface

```
interface SoulText {
  // 基本情報
  id: string
  name: string

  // 四層構造
  constitution: Constitution
  fragments: Map<string, Fragment[]>
  world_bible: WorldBible
  anti_soul: Map<string, string[]>

  // 読者ペルソナ
  reader_personas: ReaderPersona[]

  // 操作
  check_compliance(text: string): ComplianceResult
  get_fragments_for_category(category: string): Fragment[]
  add_candidate(fragment: Fragment, category: string): void
}
```

### 5.3 Pipeline Interface

```
interface Pipeline {
  // 生成開始
  start(soul_id: string, params: GenerationParams): TaskID

  // 状態確認
  get_status(task_id: TaskID): TaskStatus

  // 中断・再開
  suspend(task_id: TaskID): void
  resume(task_id: TaskID): void

  // キャンセル
  cancel(task_id: TaskID): void
}
```

### 5.4 Storage Interface

```
interface Storage {
  // 作品
  save_work(work: Work): void
  get_work(id: string): Work
  search_works(query: SearchQuery): Work[]

  // キュー
  enqueue(task: Task): void
  dequeue(): Task?
  update_task(id: string, status: TaskStatus): void

  // 候補
  add_candidate(candidate: SoulCandidate): void
  get_pending_candidates(soul_id: string): SoulCandidate[]
  approve_candidate(id: string): void
  reject_candidate(id: string): void
}
```

---

## 6. エラーハンドリング戦略

### 6.1 リトライポリシー

```
retry_policy:
  max_attempts: 3
  base_delay_ms: 1000
  max_delay_ms: 30000
  exponential_base: 2

  retryable_errors:
    - rate_limit
    - timeout
    - temporary_failure

  non_retryable_errors:
    - invalid_api_key
    - invalid_request
    - content_policy_violation
```

### 6.2 フォールバック戦略

| シナリオ | フォールバック |
|---------|---------------|
| 全Writerが不合格 | 最高スコアのものを採用し、警告をログ |
| JSON パース失敗 | 再生成を要求（最大3回） |
| API完全停止 | タスクをsuspendし、人間に通知 |

---

## 7. 監視とログ

### 7.1 メトリクス

| メトリクス | 説明 |
|-----------|------|
| tokens_used_total | 累計Token消費量 |
| tokens_used_daily | 日次Token消費量 |
| works_generated | 生成作品数 |
| compliance_rate | 適合率 |
| correction_rate | 矯正発生率 |
| avg_generation_time | 平均生成時間 |

### 7.2 ログレベル

| レベル | 用途 |
|--------|------|
| ERROR | 即座に対応が必要なエラー |
| WARN | 注意が必要だが継続可能 |
| INFO | 重要なイベント（生成完了等） |
| DEBUG | デバッグ情報（API呼び出し詳細等） |

---

## 8. 言語選択

### 8.1 選定言語

**TypeScript (Deno)**

### 8.2 選定理由

| 観点 | 評価 | 理由 |
|------|------|------|
| 型とJSON | ◎ | ソウルテキスト四層構造はJSON。Zodによるランタイムバリデーション+型推論 |
| 非同期 | ◎ | Promise.all、async/awaitがネイティブ。並列生成が直感的 |
| MCP連携 | ◎ | MCP SDKはTypeScriptがファーストクラス |
| 開発速度 | ◎ | 高速なイテレーション |
| 配布 | ○ | `deno compile`でシングルバイナリ |

### 8.3 比較検討した言語

| 言語 | 不採用理由 |
|------|-----------|
| Python | LLMエコシステムは豊富だが、今回は薄いHTTPクライアントで十分 |
| Rust | 型安全性・パフォーマンス最強だが、試行錯誤フェーズには開発速度が落ちる |
| Ruby | 業務経験を活かせるが、LLM界隈での採用が少ない |
| Go | シンプルだがジェネリクスが弱く、LLM特化機能もない |

### 8.4 採用ライブラリ（予定）

| 用途 | ライブラリ |
|------|-----------|
| 型定義・バリデーション | Zod |
| SQLite | deno-sqlite |
| CLI | Cliffy |
| ロギング | std/log |
| HTTP | fetch (built-in) |
