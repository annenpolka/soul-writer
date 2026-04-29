---
name: soul-writer
description: |
  ソウルテキスト四層構造（憲法・聖典断片・世界聖書・反魂）に基づいて短編小説を自動生成するオーケストレーションスキル。
  トーナメント方式で4人のライターエージェントが競作し、審査員が勝者を選出、統合して一貫した文体と世界観の小説を生成する。
  このスキルは /soul-generate コマンドの実行時、またはユーザーが「わたしのライオン」の世界観で小説を書きたいと言ったときに使用する。
  テーマ指定、自動テーマ生成、単章・多章生成に対応。
---

# Soul Writer — オーケストレーションスキル

このスキルはコーディングエージェント内で実行されるパイプライン型オーケストレーターである。あなた自身がオーケストレーターとして振る舞い、ソウルテキストを直接読み込み、コンテキストを保持しながら専門エージェントを順次スポーンする。

決定論的なルールチェックのみ `scripts/compliance-check.sh` に委譲する。それ以外の判断・構築・合成はすべてあなたのコンテキスト内で行う。

## パイプライン厳守ポリシー

以下のルールはパイプライン全体に適用される絶対的な制約である。

1. **省略禁止**: 本文書で定義された全Phase・全Stepは、明示的なスキップ条件（`--simple`モード、単章時、auto-theme未指定時等）に該当しない限り、必ず実行する。コンテキストウィンドウの制約、実行時間、エージェント呼び出し回数を理由とした省略は一切認めない。

2. **全章均等処理**: 多章生成時、第1章と第2章以降で処理を差別しない。全章に対して Step 3a〜3h の全ステップを等しく実行する。「第1章でフルパイプラインを実行したので第2章以降は簡略化する」という判断は禁止。

3. **トーナメント完全実施**: Step 3b のトーナメント生成は、全章で必ず4ペルソナ（orthodox, experimental, ascetic, empathic）を並列スポーンする。2ペルソナへの削減や、単一ペルソナでの生成は禁止。

4. **ジャッジ完全実施**: Step 3c のジャッジは、全章で必ず準決勝2試合+決勝1試合の計3試合を実施する。試合数の削減は禁止。

5. **リテイクループ完遂**: Step 3c.5, 3f, 3g の各リテイクループは、合格条件を満たすか最大回数に達するまで必ず実行する。「改善傾向があるのでここで打ち切る」「時間がかかるので採用する」という判断は禁止。最大回数に達して不合格の場合のみ、最新版を採用できる。

6. **読者陪審評価必須**: Step 3g の読者陪審評価は全章で必ず実行する。5ペルソナの並列評価、weightedScore算出、aggregatedScore判定、不合格時のリテイクループ（最大2回）を省略しない。

7. **学習パイプライン実行**: Phase 4.5 はゲート条件を満たす場合に必ず実行する。条件判定自体を省略しない。

8. **ファイル出力完全性**: 「ファイル構造」セクションに記載された全ファイルを、該当する条件下で必ず出力する。defect-report.json、reader-evaluation.json 等の中間成果物も省略しない。

参照ドキュメント:
- `references/aesthetics-creed.md` — 美学的信条（全エージェント共通の哲学的基盤）
- `references/output-schemas.md` — エージェント出力JSONスキーマ
- `references/spawn-context-format.md` — エージェントスポーン時のコンテキスト仕様
- `references/pipeline-overview.md` — パイプライン全体フロー図

## Phase 0: 初期化

1. ワークスペースディレクトリを作成:

       mkdir -p output/$(date +%Y%m%d-%H%M%S)

   以降、このディレクトリを `{ws}` と略す。

2. ソウルテキスト四層を読み込む:
   - `assets/soul/constitution.json` — 憲法（禁止語彙、文構造ルール、修辞制約、テーマ制約）
   - `assets/soul/world-bible.json` — 世界聖書（キャラクター、技術体系、社会構造、用語集）
   - `assets/soul/anti-soul.json` — 反魂（書いてはいけないパターン集）
   - `assets/soul/fragments/*.json` — 聖典断片（カテゴリ別の文体サンプル）
   - `assets/soul/writer-personas.json` — ライターペルソナ4種
   - `assets/soul/prompt-config.yaml` — プロンプト設定（トーン、シーン、タイムラインカタログ）
   - `assets/soul/reader-personas.json` — 読者ペルソナ5種
   - `assets/soul/diversity-catalog.json` — 多様性カタログ

   読み込んだ内容はコンテキストに保持し、以降のエージェントスポーン時に適切な部分を渡す。

## Phase 1: テーマ・キャラクター準備（auto-theme時のみ）

`--auto-theme` が指定された場合のみ。テーマ指定がある場合はスキップ。

0. **ランダムシード取得**: `scripts/random-seed.sh assets/soul/` を実行し、出力JSONを取得。emotion, timeline, strategy, concept, tone, narrative, opening の選択結果をテーマ生成プロンプトに含める。

1. **テーマ生成**: soul-theme-generator エージェントをスポーン
   - prompt-config.yaml から scene_catalog, timeline_catalog, ideation_strategies の要素をランダム選択してプロンプトに含める
   - world-bible.json のキャラクター・技術情報も含める
   - 出力（JSON）を `{ws}/theme.json` に保存

2. **キャラクター開発**: soul-character-developer エージェントをスポーン
   - theme.json の内容 + world-bible.json を入力
   - 出力を `{ws}/characters.json` に保存

## Phase 1.5: MacGuffin開発（auto-theme時のみ）

テーマ指定・auto-theme の両方で実行。CharacterDeveloper の後、Plotter の前。

1. soul-macguffin-developer エージェントをスポーン
   - theme.json + characters.json + world-bible（technology, society）を入力
   - 出力を `{ws}/macguffins.json` に保存

## Phase 1.6: モチーフ分析

1. `scripts/find-past-works.sh` を実行して過去の story.txt を検索
2. 過去作品が見つかった場合:
   - 各 story.txt の先頭2000字を読み込む
   - soul-motif-analyzer エージェントをスポーン
   - 出力を `{ws}/motif-analysis.json` に保存
3. `frequentMotifs` を以降の回避モチーフリストとして使用

## Phase 2: プロット生成（多章時のみ）

`--chapters` が2以上の場合に実行。単章はスキップ。

1. soul-plotter エージェントをスポーン
   - テーマ + キャラクター + world-bible の関連情報を入力, macguffins（Phase 1.5で生成した場合）, motifAvoidanceList（Phase 1.6で生成した場合）
   - 出力を `{ws}/plot.json` に保存

## Phase 3: 章生成ループ

各章に対して以下を順次実行。

### Step 3a: ライタースポーンプロンプトの構築

4つのペルソナそれぞれのスポーンプロンプトを、コンテキスト内の情報から直接構築する。

ペルソナと割り当て:
- **orthodox** (introspection, symbolism): 引き算を最大限重視。沈黙の力を信じる
- **experimental** (action, world_building): 予測を裏切る構成。安全な選択を避ける
- **ascetic** (killing, action): 不可逆な行動を信条とする。全シーンに身体行動
- **empathic** (dialogue, character_voice): 声を最優先。キャラクターの呼吸とリズム

各スポーンプロンプトに含める情報（`references/spawn-context-format.md` 参照）:
- ペルソナ指示（writer-personas.json から）
- クリティカルルール（POV、禁止語彙、マークダウン禁止等）
- 憲法の文体ルール要約
- キャラクター情報（名前、役割、口調、身体の癖、力学構造）
- 用語集
- 反魂パターン（カテゴリ別、各最大3例）
- 参考断片（フォーカスカテゴリは3件、他は1件）
- 回避モチーフ（あれば）
- 文体トーン指示
- 章プロンプト（プロットからの具体的執筆指示）
- MacGuffinコンテキスト（キャラクターの秘密と表面の兆候、プロットの隠し層）
- 回避モチーフリスト（Phase 1.6の出力、ある場合のみ）

### Step 3b: トーナメント生成

soul-writer エージェントを4つ**並列で**スポーン。各出力を `{ws}/ch{N}/draft-{persona}.txt` に保存。

スポーン後、各ドラフトに適合度チェック:

    bash scripts/compliance-check.sh {ws}/ch{N}/draft-{persona}.txt assets/soul/

error が3件以上のドラフトは失格（不戦敗）。

### Step 3c: ジャッジ（準決勝 + 決勝）

ブラケット:
- 準決勝1: orthodox vs experimental
- 準決勝2: ascetic vs empathic
- 決勝: 準決勝1勝者 vs 準決勝2勝者

各試合で soul-judge エージェントをスポーン。テキストA・B、評価基準、キャラクター声の参照をプロンプトに含める。準決勝2試合は並列可。

結果JSONを `{ws}/ch{N}/semifinal-1.json`, `semifinal-2.json`, `final.json` に保存。
優勝ドラフトを `{ws}/ch{N}/champion.txt` にコピー。

### Step 3c.5: Judge Retake（条件付き）

final.json の winner スコアを確認し、品質閾値を下回る場合にリテイクを実行する。

1. 条件: overall < 70 または voice_accuracy < 60
2. soul-writer をリテイクモードでスポーン（champion text + judge の weaknesses フィードバック）
3. リテイク版に `scripts/compliance-check.sh` を実行
4. soul-judge でオリジナル champion vs リテイク版を比較
5. リテイク版が勝利 → 新 champion として採用。敗北 → ロールバック
6. 最大2回リテイク
7. 結果を `{ws}/ch{N}/judge-retake-{i}.json` に保存

### Step 3d: 統合

soul-synthesizer エージェントをスポーン。champion.txt + 全4ドラフト + Judge分析結果をプロンプトに含める。出力を `{ws}/ch{N}/synthesized.txt` に保存。

`--simple` モードでは 3d 以降をスキップし、champion.txt を final.txt とする。

### Step 3e: 適合度チェック + 矯正ループ（最大3回）

1. `scripts/compliance-check.sh` を実行
2. 違反あり → soul-corrector エージェントをスポーン（テキスト + 違反リスト）
3. 修正後、再度チェック。最大3回繰り返す
4. 3回失敗 → 違反を anti-soul 候補として記録し、最後の版を採用

### Step 3f: 欠陥検出 + リテイク（最大2回）

soul-defect-detector エージェントをスポーン。テキスト + 憲法ルール + キャラクター設定を入力。

- verdict が exceptional/publishable/acceptable → 合格、`{ws}/ch{N}/final.txt` に保存
- needs_work/unacceptable → soul-writer をリテイクモードでスポーン（元テキスト + 欠陥レポート）→ 再度 compliance-check + defect-detector
- 2回リテイクしても不合格なら最新版を final.txt として採用

### Step 3g: 読者陪審評価

1. soul-reader-evaluator を5つ**並列で**スポーン。各ペルソナ（reader-personas.json）× final text
2. 各評価の weightedScore を算出:
   `weightedScore = style×w.style + plot×w.plot + character×w.character + worldbuilding×w.worldbuilding + readability×w.readability`
3. aggregatedScore = 5つの weightedScore の平均
4. aggregatedScore >= 0.85 → 合格。`{ws}/ch{N}/reader-evaluation.json` に保存
5. 不合格 → リテイクループ（最大2回）:
   a. soul-reader-jury をスポーンしてフィードバック統合
   b. soul-writer をリテイクモードでスポーン（テキスト + prioritizedFeedback）
   c. `scripts/compliance-check.sh` 実行
   d. 5つの reader-evaluator を再スポーン（前回評価を比較コンテキストとして渡す）
   e. 新 aggregatedScore を算出
   f. **スコア劣化検出**: 新スコア <= 前回スコア → ロールバックしてリテイク中止
6. 最終評価を `{ws}/ch{N}/reader-evaluation.json` に保存

### Step 3h: 状態更新（多章時）

soul-chapter-state-extractor エージェントをスポーン（多章時のみ）。final.txt + 前章状態を入力。出力で cross-chapter state を更新。

## Phase 4: 組み立て

1. 全章の final.txt を結合して `{ws}/story.txt` を生成
2. メタデータ（タイトル、日時、章数、各章verdict）を `{ws}/metadata.json` に出力
3. ユーザーに完成を報告: story.txt のパス、各章verdict、エージェント呼び出し数

## Phase 4.5: 学習パイプライン（条件付き）

ゲート条件: 最終 DefectDetector verdict が publishable または exceptional、かつ compliance パス

1. soul-fragment-extractor をスポーン（story.txt + verdict）
2. score >= 0.85 の断片のみフィルタ
3. `{ws}/learning-candidates.json` に保存
4. 矯正3回失敗が発生した章がある場合: 失敗パターンを `{ws}/anti-soul-candidates.json` に記録
5. ユーザーに「学習候補があります。`/soul-review` で確認できます」と報告

## 中断からの再開

ワークスペースに既存の final.txt がある章はスキップし、未完了の章から再開する。

## ファイル構造

    {ws}/
    ├── theme.json          # (auto-theme時)
    ├── characters.json     # (auto-theme時)
    ├── macguffins.json     # (Phase 1.5)
    ├── motif-analysis.json # (Phase 1.6, 過去作品あり時)
    ├── plot.json           # (多章時)
    ├── ch1/
    │   ├── draft-orthodox.txt
    │   ├── draft-experimental.txt
    │   ├── draft-ascetic.txt
    │   ├── draft-empathic.txt
    │   ├── semifinal-1.json
    │   ├── semifinal-2.json
    │   ├── final.json
    │   ├── champion.txt
    │   ├── judge-retake-1.json   # (Step 3c.5, 発生時)
    │   ├── synthesized.txt
    │   ├── defect-report.json
    │   ├── reader-evaluation.json # (Step 3g)
    │   └── final.txt
    ├── cross-chapter-state.json  # (多章時)
    ├── learning-candidates.json  # (Phase 4.5)
    ├── anti-soul-candidates.json # (矯正失敗時)
    ├── story.txt
    └── metadata.json
