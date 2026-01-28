# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

soul-writerは、ソウルテキスト（原典の小説メモ）に基づいて一貫した文体と世界観を維持しながら短編小説（20,000字〜）を自動生成するLLMベースの「工場」システム。

### ソースマテリアル「わたしのライオン」

ARタグシステムとMR（拡張現実）を背景にした近未来SF。
孤児の少女・御鐘透心が無関心な世界での存在確認を求めてクラスメイトを殺害（仮想）し続ける物語。
ハッカー・愛原つるぎとの出会いを通じて、真実への渇望と偽りの世界への反逆が描かれる。

**キャラクター**:
- **御鐘透心**: 孤児の学級委員長。他者への殺意をMRフロアで発散。無関心な中で唯一他人を覚えている矛盾。
- **愛原つるぎ**: 組織のハッカー、二重スパイ。「人間の皮を着たグリッチ」。支配ではなく「凝視」を求める視線ジャンキー。透心の殺意を「正解」と肯定。

**文体の特徴**:
- 内面独白とシーン描写の織り交ぜ
- 冷徹だが感受性豊かな語り口
- ARテクノロジーと感情の対比（デジタルvsアナログ）

## 開発状況

**現在は設計フェーズ。実装コードは未着手。**

- 言語: TypeScript (Deno)
- データベース: SQLite（確定）
- LLM API: OpenAI互換API（Cerebras等）

### TypeScript/Deno選択理由

- **型とJSONの相性**: ソウルテキスト四層構造はJSON。Zodによるランタイムバリデーション+型推論が強力
- **非同期が自然**: Promise.all、async/awaitがネイティブ。並列生成のコードが読みやすい
- **MCP親和性**: MCP SDKはTypeScriptがファーストクラス。将来的なMCPサーバー化に有利
- **Deno固有利点**: TypeScript直接実行、パーミッションシステム、`deno compile`でシングルバイナリ

## アーキテクチャ

### 三層構造

1. **エントリポイント層**: CLI, Web Server, Worker（バックグラウンドデーモン）
2. **コアエンジン層**: SoulText Manager, Pipeline Controller, Tournament Arena, Agents Registry
3. **ストレージ層**: SQLite, File System

### ソウルテキスト四層構造

生成の品質を担保する核心部分：

1. **憲法（Constitution）**: 絶対に守るべきルール（文構造、禁止語彙、「×」の使用規則）
2. **聖典断片（Scripture Fragments）**: カテゴリ別の参照サンプル（opening, killing, introspection, dialogue等）
3. **世界聖書（World Bible）**: 設定・用語・キャラクター定義
4. **反魂（Anti-Soul）**: 「こう書いてはいけない」の負例集（不合格生成物から自動収集）

### 生成パイプライン

1. プロット生成（Plotterエージェント）
2. 各章で4人トーナメント（Writer×4 → Judge → 勝者選出）
3. 適合度チェック（違反時は矯正ループ、3回失敗で反魂に追加）
4. 読者陪審員による多角的評価
5. アーカイブ + 自動学習候補抽出

## 重要ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/SPEC.md` | 詳細仕様（パイプライン、トーナメント、自動学習） |
| `docs/ARCHITECTURE.md` | システム構成図、データフロー、状態遷移図 |
| `docs/SOUL-FORMAT.md` | 四層構造のJSONスキーマと具体例 |
| `docs/soultext.md` | 原典の小説メモ（「わたしのライオン」のキャラクター設定・ストーリー・台詞断片） |

## ソウルテキストのファイル構成（予定）

```
soul/
├── constitution.json       # 第一層
├── fragments/              # 第二層（カテゴリ別）
├── world-bible.json        # 第三層
├── anti-soul.json          # 第四層
└── reader-personas.json    # 読者ペルソナ
```
