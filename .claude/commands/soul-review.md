---
description: "学習候補のレビューと承認。生成されたフラグメントをソウルテキストに統合する。"
allowed-tools: Read, Write, Bash, Grep, Glob
argument-hint: "[workspace-path]"
---

ユーザーが `/soul-review` を実行しました。学習候補のレビューワークフローを開始してください。

## 引数の解釈

- ワークスペースパスが指定された場合: そのディレクトリの `learning-candidates.json` を読み込む
- 指定なしの場合: `output/` 以下で最新のワークスペースを自動検出する

## レビューワークフロー

1. `learning-candidates.json` を読み込み、候補一覧を表示する
   - 各候補について: テキスト（50-300字）、カテゴリ、スコア、理由を表示

2. ユーザーと対話で各候補を approve / reject する
   - approve: 断片を `assets/soul/fragments/learned/{category}.json` に追記
   - reject: スキップ

3. `anti-soul-candidates.json` が存在する場合:
   - anti-soul 候補も提示し、approve / reject する
   - approve: パターンを `assets/soul/anti-soul.json` に追記

4. レビュー結果のサマリーを報告する:
   - 承認数 / 却下数
   - 統合先ファイルのパス

## 断片統合の形式

`assets/soul/fragments/learned/{category}.json` に追記する際のフォーマット:

```json
[
  {
    "id": "learned-{category}-{連番}",
    "text": "断片テキスト",
    "source": "generated",
    "score": 0.85
  }
]
```

ファイルが存在しない場合は新規作成する。存在する場合は既存の配列に追加する。
`learned/` ディレクトリが存在しない場合は `mkdir -p` で作成する。
