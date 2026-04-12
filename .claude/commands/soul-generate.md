---
description: "ソウルテキストに基づく短編小説を生成する。テーマ指定 or --auto-theme で自動テーマ生成。"
allowed-tools: Read, Write, Bash, Agent, Grep, Glob
argument-hint: "<テーマ or シーン指示> [--auto-theme] [--chapters N] [--simple] [--seed N]"
---

ユーザーが `/soul-generate` を実行しました。soul-writer オーケストレーションスキルを起動してください。

引数の解釈:
- テキスト引数: 生成テーマまたはシーン指示
- `--auto-theme`: テーマを自動生成する（引数のテーマは無視）
- `--chapters N`: 章数を指定（デフォルト: 1）
- `--simple`: トーナメントのみ実行（後処理なし）
- `--seed N`: ランダムシード指定（テーマ生成の再現性用、`random-seed.sh --seed N` に渡す）

soul-writer スキルの SKILL.md を読み込み、パイプラインを実行してください。
