# soul-writer

ソウルテキスト（原典の小説メモ）に基づいて、一貫した文体と世界観を維持しながら短編小説を自動生成する「工場」システム。

## ソースマテリアル

原典となる小説メモは「わたしのライオン」。
ARタグシステムとMR（拡張現実）を背景に、孤児の少女・御鐘透心が無関心な世界での存在確認を求めてクラスメイトを殺害（仮想）し続ける物語。
ハッカー・愛原つるぎとの出会いを通じて、真実への渇望と偽りの世界への反逆が描かれる。

### 主なキャラクター

- **御鐘 透心（みかね とうこ）**: 孤児の学級委員長。無関心な他者への殺意をMRフロアで発散。他者を知り続けることの矛盾に苦しむ。
- **愛原 つるぎ（あいはら つるぎ）**: 組織のハッカー。支配ではなく「凝視」を求める視線ジャンキー。透心の殺意を「正解」と肯定する。

## 概要

soul-writerは、作家の文体・世界観・キャラクターの「魂」を四層構造で定義し、それに忠実な物語を大量生成するLLMベースのシステムです。

### 特徴

- **ソウルテキスト四層構造**: 憲法、聖典断片、世界聖書、反魂の4層で文体と世界観を定義
- **競争的生成（トーナメント）**: 4人の仮想作家が競い合い、最良の文章を選出
- **共作モード（コラボレーション）**: 複数Writerがモデレーター進行のもと議論・執筆を行う協調型生成
- **自動学習**: 成功した生成物から自動的に文体を学習（人間レビュー付き）
- **品質優先**: Token消費よりも文体の忠実度を重視
- **チェックポイント**: 長編生成の中断・再開に対応
- **工場バッチ生成**: ランダムテーマによる大量並列生成と統計分析
- **YAMLテンプレートエンジン**: 条件分岐・フィルタ・インクルード対応のプロンプト構築
- **コンプライアンスチェック**: 禁止語彙、視点一貫性、リズム等の自動検査

## 使い方

### セットアップ

```bash
npm install
# .env に CEREBRAS_API_KEY を設定
```

### CLIコマンド

```bash
# シンプル生成（トーナメントのみ、DB不要）
npx tsx src/main.ts generate --simple --prompt "透心の朝の独白を書いてください"

# フルストーリー生成（5章、DB使用）
npx tsx src/main.ts generate --prompt "透心とつるぎの出会い" --chapters 5

# テーマ自動生成（テーマ・キャラクター自動生成→ストーリー生成）
npx tsx src/main.ts generate --auto-theme --chapters 3

# コラボレーションモード（複数Writer共作）
npx tsx src/main.ts generate --auto-theme --chapters 2 --mode collaboration

# 中断タスク再開
npx tsx src/main.ts resume --task-id <uuid> --soul soul

# 学習候補レビュー
npx tsx src/main.ts review --soul soul

# 工場バッチ生成（configファイル）
npx tsx src/main.ts factory --config factory-config.json

# 工場バッチ生成（CLI引数）
npx tsx src/main.ts factory --count 5 --parallel 2 --chapters-per-story 3

# configファイル + CLI引数で上書き
npx tsx src/main.ts factory --config factory-config.json --count 20

# 工場バッチ生成（コラボレーションモード）
npx tsx src/main.ts factory --count 5 --parallel 2 --mode collaboration
```

## ドキュメント

- [詳細仕様書](docs/SPEC.md) - パイプライン、トーナメント、自動学習の仕様
- [アーキテクチャ](docs/ARCHITECTURE.md) - システム構成とデータフロー
- [ソウルフォーマット](docs/SOUL-FORMAT.md) - ソウルテキストのJSON仕様
- [原典小説メモ](docs/soultext.md) - 「わたしのライオン」のキャラクター設定・ストーリー・台詞断片

## 技術スタック

- **言語**: TypeScript (Node.js + tsx)
- **テスト**: Vitest
- **リンター**: oxlint
- **データベース**: SQLite (better-sqlite3 + Drizzle ORM)
- **LLM API**: Cerebras Cloud SDK
- **バリデーション**: Zod v4
- **テンプレート**: YAMLテンプレートエンジン（自作、js-yaml）

## 開発状況

主要機能は実装済み。詳細は[ドキュメント](docs/)を参照してください。

## ライセンス

TBD
