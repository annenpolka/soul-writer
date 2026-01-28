# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

soul-writerは、ソウルテキスト（原典の小説メモ）に基づいて一貫した文体と世界観を維持しながら短編小説（20,000字〜）を自動生成するLLMベースの「工場」システム。

## 開発状況

**現在は設計フェーズ。実装コードは未着手。**

- 言語: 未定（TypeScript/Deno, Python, Rust, Ruby が候補）
- データベース: SQLite（確定）
- LLM API: OpenAI互換API（Cerebras等）

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
| `soultext.md` | 原典の小説メモ（「わたしのライオン」） |

## ソウルテキストのファイル構成（予定）

```
soul/
├── constitution.json       # 第一層
├── fragments/              # 第二層（カテゴリ別）
├── world-bible.json        # 第三層
├── anti-soul.json          # 第四層
└── reader-personas.json    # 読者ペルソナ
```
