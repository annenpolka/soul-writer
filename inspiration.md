## Prompt:
2026/1/27 22:23:10

200ドルの使用量を使い切るアイデアを色々出して



## Response:
2026/1/27 22:24:04



````plaintext
Thought process: Synthesized user background with API specs to brainstorm creative usage ideas.

ユーザーはCerebras Code Maxプラン（$200/月）の使用量を使い切るアイデアを求めている。

Maxプランの仕様を整理すると：
- 月額$200
- 120M tokens/day
- 1.5M TPM (tokens per minute)
- 120 RPM
- 172,800 requests/day

これだけの量をどう活用するか、クリエイティブかつ実用的なアイデアを出す必要がある。

ユーザーの背景：
- バックエンドエンジニア（Rails, PostgreSQL, AWS）
- AI開発ワークフローに興味（Claude Code, MCP, prompt engineering）
- draftsnap開発中
- ローカライゼーション、git worktree管理
- AI画像生成（ComfyUI, SDXL, LoRA）にも興味

これらを踏まえて、実用的かつ面白いアイデアを出そう。
````

なかなか贅沢な悩みね。120M tokens/dayを使い切るのは本気で取り組まないと難しいわ。あなたの興味や背景を踏まえて、実用的なものから実験的なものまで並べてみるわね。

---

## 事実ベース：Maxプランの容量

| 指標 | 値 | 換算目安 |
|------|-----|---------|
| Tokens/Day | 120M | 約60,000〜80,000行のコード生成相当 |
| TPM | 1,500,000 | 連続生成で約12〜15分で1日分消費可能 |
| Requests/Day | 172,800 | 0.5秒に1リクエストを24時間続けられる |

---

## アイデア集

### 1. 大規模リファクタリング・マイグレーション系

**既存プロジェクトの全面書き直し**
- Railsプロジェクトのテストカバレッジ100%を目指してRSpecを自動生成
- 古いコードベースのRuboCop違反を片っ端から修正させる
- Ruby 2.x → 3.x、Rails 6 → 7のマイグレーション差分を全ファイル生成

**論拠**: 1ファイルあたり数千〜数万トークン消費。100ファイル規模のプロジェクトなら数日で数十Mトークン

---

### 2. draftsnap関連の拡張開発

**エージェント駆動のドキュメント自動生成**
- draftsnap全機能のREADME、man page、使用例を多言語で生成
- CLIのhelp出力から自動的にZenn/Qiita記事を生成するパイプライン

**テストスイート爆発的拡充**
- エッジケース網羅のためにfuzz的にテストケースを大量生成
- 各gitコマンドとの相互作用パターンを全探索

---

### 3. 並列エージェント実験

**Multi-agent debate / self-play**
- 同じ課題を複数のプロンプトバリエーションで解かせて品質比較
- 「コードレビュアー」と「開発者」ロールを交互に演じさせるself-improvement loop

**Claude Code風のワークフロー再現**
- Cline/RooCodeで長時間autonomousモードを走らせる
- 「このリポジトリを理解して、TODOコメントを全部実装して」のような大規模タスク

**論拠**: エージェントループは1タスクで数万〜数十万トークン消費するため、数回で数Mトークン

---

### 4. AI画像生成関連

**ComfyUIワークフロー自動生成**
- 「こういう絵を出したい」→ ワークフローJSON生成 → 実行 → 結果評価 → 改善ループ
- LoRAトレーニング用のタグ付けを大量画像に対して実行

**プロンプトエンジニアリングの自動探索**
- Danbooru/e621タグの組み合わせを体系的に探索
- 「この画像に近い出力を得るプロンプト」を逆推定させる実験

---

### 5. 学習・研究系

**技術書の「実装版」生成**
- 「ゼロから作るDeep Learning」等の写経を、別言語（Rust/Go）で全章自動変換
- 論文のアルゴリズムをRuby/Pythonで即実装させる

**MCPサーバー乱造**
- 自分がよく使うサービス（Notion, GitHub, Slack等）のMCPサーバーを片っ端から作らせる
- 「MCPサーバーのテンプレート」→「カスタマイズ」を自動化

---

### 6. 業務効率化の極端版

**コードレビュー自動化パイプライン**
- PRが来たらGitHub Actionsで全diff解析 → 改善案生成 → 自動コメント
- 1日数十PRあるリポジトリに仕掛ければ数Mトークン/day

**ドキュメント↔コード同期**
- Swagger/OpenAPI specから実装を生成
- 逆に実装からspec/型定義を抽出
- 差分検出→自動修正のループ

---

### 7. 実験・遊び系

**ゲームAI / シミュレーション**
- Slay the Spire風ローグライクのカードバランス調整をLLMに任せる
- 「このカードプールで最強デッキを探索せよ」をエージェントに解かせる

**創作支援**
- 小説・シナリオを「章ごとに生成→レビュー→修正」のループで長編化
- TRPGシナリオのNPCセリフ/分岐を全パターン生成

**言語モデルの限界探索**
- 「GLM-4.7が苦手なタスク」を体系的に探す
- 同一プロンプトでtemperature/top-pを変えて出力分布を可視化

---

### 8. インフラ・DevOps系

**Terraform/CloudFormation生成**
- 既存インフラのドキュメントからIaCコードを全自動生成
- 「このアーキテクチャ図を実装せよ」

**障害対応ランブック自動生成**
- CloudWatchアラート定義から「このアラートが鳴ったら何をすべきか」を全パターン生成

---

## 推測（示唆）

### 現実的に使い切れるか？

| 使い方 | 1日の消費目安 | 論拠 |
|--------|--------------|------|
| 普通のペアプロ | 5〜20M | 手動でやり取りする限り物理的限界 |
| Cline autonomousモード | 30〜80M | 1タスク数十分、複数タスク並行で到達 |
| CI/CDパイプライン組み込み | 50〜100M+ | PR数×解析深度で青天井 |
| Multi-agent実験 | 100M+ | 複数インスタンスの並行実行 |

**結論**: 手動では120M/dayは使い切れない。自動化・並列化を仕込んで初めて「もったいない」が解消される

### 優先度の提案

あなたの状況を考えると：

1. **即効性**: Cline/RooCodeでdraftsnapのテスト・ドキュメント一括生成
2. **学習効果**: MCPサーバー自作ラッシュ（実用と学習を兼ねる）
3. **業務直結**: GitHub ActionsでPRレビュー自動化（職場で使える）
4. **趣味充実**: ComfyUIワークフロー探索（AI画像生成の知見深化）

どれから手をつける？もう少し具体的なプランに落とし込むこともできるわよ。



## Prompt:
2026/1/27 22:32:52

小説の文体・内容を補正し続けるループとか書いてみたいな



## Response:
2026/1/27 22:34:15



````plaintext
Thought process: 小説改善ループの設計と実装方法を検討した。

ユーザーは小説の文体・内容を補正し続けるループを作りたいと言っている。これは興味深いプロジェクトで、LLMを使った創作支援・自動改善パイプラインの一種。

彼はBackendエンジニアでRailsを使っているが、このようなスクリプトはPythonでも書けるし、Rubyでも可能。Cerebras CodeのAPIはOpenAI互換なので、どちらでも実装できる。

考えるべき要素：
1. ループの構造（生成→評価→修正のサイクル）
2. 評価基準をどう設計するか
3. 収束条件（いつ止めるか）
4. トークン消費の管理
5. 文体の一貫性維持

アーキテクチャとして考えられるアプローチ：
- 単純なフィードバックループ（生成→自己批評→修正）
- マルチエージェント（作家/編集者/読者の役割分担）
- DSPy的なプロンプト最適化と組み合わせ
- 版管理（各イテレーションの変遷を追跡）

ユーザーはdraftsnapを開発しているので、バージョン管理の概念に精通している。生成物のdiff管理などは面白いかもしれない。

実装例を提供しつつ、設計の選択肢を示すのが良さそう。Pythonで書くのが一般的だけど、ユーザーの好みを聞いても良い。

実装するなら、Cerebras APIはOpenAI互換なのでopenai pythonライブラリで直接利用できる。動作するコード例を示すのが実用的だろう。
````

面白い方向性ね。自己改善ループは単純に見えて設計の余地がかなり広いわ。いくつかのアプローチを整理してから、実装例を書いてみるわね。

---

## 事実：基本的なループ構造のパターン

### パターン1: 単純な自己批評ループ

```
生成 → 自己批評 → 修正 → 自己批評 → 修正 → ...
```

最もシンプル。1つのモデルが書いて、批評して、直す。

### パターン2: マルチロール分離

```
作家(生成) → 編集者(構造批評) → 校正者(文体批評) → 作家(修正) → ...
```

役割ごとにプロンプトを分けることで、批評の観点が明確になる。

### パターン3: 競争的生成

```
生成A → 生成B → 評価者(どちらが良いか判定) → 勝者を次の基準に
```

複数バリエーションから選択していく方式。

### パターン4: 階層的改善

```
プロット批評 → 章構成批評 → 段落批評 → 文批評
```

粒度を変えながら深掘りしていく。

---

## 推測（示唆）：設計上の論点

| 論点 | 選択肢 | トレードオフ |
|------|--------|-------------|
| **収束条件** | 固定回数 / 品質スコア閾値 / 変化量が一定以下 | 固定回数は単純だが最適解を逃す可能性。品質スコアは評価基準の設計が難しい |
| **批評の粒度** | 全体 / 章単位 / 段落単位 | 細かいほど改善が局所的、粗いほど大局的だがトークン効率が悪い |
| **履歴の扱い** | 最新版のみ / 直近N版 / 全履歴 | 全履歴はコンテキスト爆発、最新のみは過去の良い部分を忘れる |
| **文体基準** | 参照テキスト / ルール記述 / 例示 | 参照テキストが最も安定するが、著作権注意 |

---

## 実装例

言語はPythonで良いかしら？Rubyでも書けるけど、LLM関連のエコシステムはPythonが厚いから。

まずは**パターン2（マルチロール）+ 履歴追跡**の組み合わせで書いてみるわね。

```python
#!/usr/bin/env python3
"""
小説文体・内容補正ループ
Cerebras API (OpenAI互換) を使用
"""

import os
import json
from datetime import datetime
from pathlib import Path
from openai import OpenAI

# Cerebras APIの設定
client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key=os.environ.get("CEREBRAS_API_KEY"),
)

MODEL = "zai-glm-4.7"  # or "qwen3-coder"


def call_llm(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    """LLM呼び出しのラッパー"""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=8192,
    )
    return response.choices[0].message.content


# ===== ロール定義 =====

STYLE_REFERENCE = """
文体の参照例（ここに目指す文体のサンプルを入れる）：
- 短い文を基調とする
- 体言止めを効果的に使う
- 比喩は具体的な身体感覚に基づく
- 会話文は最小限
"""

WRITER_SYSTEM = """あなたは小説家です。
編集者からのフィードバックを受けて、原稿を改善してください。
改善版の本文のみを出力し、説明は不要です。"""

STRUCTURE_EDITOR_SYSTEM = """あなたは構成担当の編集者です。
以下の観点で原稿を批評してください：
- プロットの論理的整合性
- 場面転換の自然さ
- 伏線の配置と回収
- テンポとペース配分

具体的な問題箇所を引用し、改善案を提示してください。
良い点も1つは挙げてください。"""

STYLE_EDITOR_SYSTEM = f"""あなたは文体担当の編集者です。
以下の参照文体に近づけるよう批評してください：

{STYLE_REFERENCE}

批評の観点：
- 文のリズムと長さ
- 語彙選択の適切さ
- 比喩表現の質
- 冗長な表現の有無

具体的な問題箇所を引用し、改善案を提示してください。"""

READER_SYSTEM = """あなたは一般読者です。
素朴な感想を述べてください：
- 面白かったか、退屈だったか
- 感情移入できたか
- 分かりにくい箇所はあったか
- 続きを読みたいと思うか

専門用語は使わず、率直な感想を200字程度で。"""

CONVERGENCE_JUDGE_SYSTEM = """あなたは品質判定者です。
前回版と今回版を比較し、以下をJSON形式で出力してください：
{
  "improved": true/false,
  "improvement_score": 0-10,
  "major_changes": ["変更点1", "変更点2"],
  "remaining_issues": ["課題1", "課題2"],
  "recommendation": "continue" or "stop"
}
説明は不要、JSONのみ出力。"""


class NovelRevisionLoop:
    def __init__(self, output_dir: str = "./novel_revisions"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.history: list[dict] = []
        self.iteration = 0

    def save_iteration(self, text: str, feedback: dict):
        """各イテレーションを保存"""
        data = {
            "iteration": self.iteration,
            "timestamp": datetime.now().isoformat(),
            "text": text,
            "feedback": feedback,
        }
        self.history.append(data)
        
        # 個別ファイルとして保存
        filepath = self.output_dir / f"v{self.iteration:03d}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # テキストのみも保存（diff用）
        text_path = self.output_dir / f"v{self.iteration:03d}.txt"
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text)

    def get_feedback(self, text: str) -> dict:
        """各エディターからフィードバックを収集"""
        print(f"  [構成編集者] 批評中...")
        structure_fb = call_llm(STRUCTURE_EDITOR_SYSTEM, f"以下の原稿を批評してください：\n\n{text}")
        
        print(f"  [文体編集者] 批評中...")
        style_fb = call_llm(STYLE_EDITOR_SYSTEM, f"以下の原稿を批評してください：\n\n{text}")
        
        print(f"  [読者] 感想執筆中...")
        reader_fb = call_llm(READER_SYSTEM, f"以下の小説を読んだ感想を教えてください：\n\n{text}")
        
        return {
            "structure": structure_fb,
            "style": style_fb,
            "reader": reader_fb,
        }

    def revise(self, text: str, feedback: dict) -> str:
        """フィードバックに基づいて改稿"""
        prompt = f"""以下の原稿を、編集者と読者のフィードバックに基づいて改善してください。

【現在の原稿】
{text}

【構成編集者のフィードバック】
{feedback['structure']}

【文体編集者のフィードバック】
{feedback['style']}

【読者の感想】
{feedback['reader']}

フィードバックを踏まえて改善した原稿を出力してください。"""
        
        print(f"  [作家] 改稿中...")
        return call_llm(WRITER_SYSTEM, prompt, temperature=0.8)

    def check_convergence(self, prev_text: str, curr_text: str) -> dict:
        """収束判定"""
        prompt = f"""【前回版】
{prev_text}

【今回版】
{curr_text}"""
        
        print(f"  [判定者] 評価中...")
        result = call_llm(CONVERGENCE_JUDGE_SYSTEM, prompt, temperature=0.3)
        
        try:
            # JSONパース試行
            # コードブロックで囲まれている場合の対処
            cleaned = result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # パース失敗時はデフォルト
            return {"improved": True, "recommendation": "continue", "improvement_score": 5}

    def run(self, initial_text: str, max_iterations: int = 10, min_improvement_score: int = 2):
        """メインループ"""
        current_text = initial_text
        
        print(f"=== 小説補正ループ開始 ===")
        print(f"最大イテレーション: {max_iterations}")
        print(f"初期テキスト長: {len(initial_text)} 文字\n")
        
        # 初期版を保存
        self.save_iteration(current_text, {"initial": True})
        
        for i in range(max_iterations):
            self.iteration = i + 1
            print(f"\n--- イテレーション {self.iteration} ---")
            
            # フィードバック収集
            feedback = self.get_feedback(current_text)
            
            # 改稿
            new_text = self.revise(current_text, feedback)
            
            # 収束判定
            convergence = self.check_convergence(current_text, new_text)
            feedback["convergence"] = convergence
            
            # 保存
            self.save_iteration(new_text, feedback)
            
            # 結果表示
            score = convergence.get("improvement_score", 0)
            print(f"  改善スコア: {score}/10")
            print(f"  推奨: {convergence.get('recommendation', 'unknown')}")
            
            # 収束判定
            if convergence.get("recommendation") == "stop":
                print(f"\n✓ 収束判定により終了")
                break
            
            if score < min_improvement_score:
                print(f"\n✓ 改善スコアが閾値({min_improvement_score})未満のため終了")
                break
            
            current_text = new_text
        
        print(f"\n=== 完了 ===")
        print(f"総イテレーション: {self.iteration}")
        print(f"出力ディレクトリ: {self.output_dir}")
        
        return current_text


def main():
    # 初期原稿（ここに改善したい文章を入れる）
    initial_text = """
    彼女は窓の外を見ていた。雨が降っていた。彼女は悲しかった。
    なぜなら、彼が来ないからだ。彼女は待っていた。ずっと待っていた。
    でも彼は来なかった。彼女は泣いた。涙が頬を伝った。
    雨の音が聞こえた。彼女は一人だった。
    """
    
    loop = NovelRevisionLoop(output_dir="./novel_revisions")
    final_text = loop.run(
        initial_text=initial_text,
        max_iterations=10,
        min_improvement_score=3,
    )
    
    print("\n=== 最終版 ===")
    print(final_text)


if __name__ == "__main__":
    main()
```

---

## 拡張のアイデア

### 1. diff可視化の追加

```python
import difflib

def show_diff(old: str, new: str):
    """変更箇所をハイライト"""
    diff = difflib.unified_diff(
        old.splitlines(keepends=True),
        new.splitlines(keepends=True),
        fromfile='before',
        tofile='after',
    )
    return ''.join(diff)
```

### 2. draftsnap連携

各イテレーションをdraftsnapで管理すれば、後から任意の版に戻れるわね。

```python
import subprocess

def commit_to_draftnap(text: str, message: str):
    """draftsnapにコミット"""
    with open("novel.txt", "w") as f:
        f.write(text)
    subprocess.run(["draftsnap", "commit", "-m", message])
```

### 3. 並列フィードバック収集

```python
import asyncio
from openai import AsyncOpenAI

async def get_feedback_parallel(text: str) -> dict:
    """フィードバックを並列取得"""
    async_client = AsyncOpenAI(
        base_url="https://api.cerebras.ai/v1",
        api_key=os.environ.get("CEREBRAS_API_KEY"),
    )
    
    tasks = [
        call_llm_async(async_client, STRUCTURE_EDITOR_SYSTEM, text),
        call_llm_async(async_client, STYLE_EDITOR_SYSTEM, text),
        call_llm_async(async_client, READER_SYSTEM, text),
    ]
    
    results = await asyncio.gather(*tasks)
    return {
        "structure": results[0],
        "style": results[1],
        "reader": results[2],
    }
```

### 4. 文体参照の動的抽出

```python
def extract_style_features(reference_text: str) -> str:
    """参照テキストから文体特徴を抽出"""
    prompt = f"""以下のテキストの文体的特徴を分析してください：
    - 平均文長
    - 頻出する文末表現
    - 比喩の傾向
    - 語彙レベル
    - リズムの特徴
    
    {reference_text}"""
    
    return call_llm("文体分析の専門家として回答してください。", prompt)
```

---

## トークン消費の見積もり

| 処理 | 1回あたりの消費（目安） |
|------|----------------------|
| 構成批評 | 入力: 原稿長 + 500, 出力: 1,000〜2,000 |
| 文体批評 | 入力: 原稿長 + 800, 出力: 1,000〜2,000 |
| 読者感想 | 入力: 原稿長 + 300, 出力: 300〜500 |
| 改稿 | 入力: 原稿長×2 + 4,000, 出力: 原稿長×1.2 |
| 収束判定 | 入力: 原稿長×2 + 500, 出力: 200 |

**5,000字の小説 × 10イテレーション** だと概算で **2〜3Mトークン** 程度。120M/dayの2%くらいね。長編（10万字クラス）を回すか、複数作品を並列処理すれば、ちゃんと使い切れるわ。

---

どの方向で深掘りする？文体参照の設計、収束条件のチューニング、あるいは実際に動かしてみる？



## Prompt:
2026/1/27 23:34:31

マルチロールと競争的生成を組み合わせた、大げさな仕組みを考えよう。目標は、ベースの文体に忠実に、大量の物語を生成し続けること。深く考えて



## Response:
2026/1/27 23:37:21



````plaintext
Thought process: 大規模な文体保持型物語生成システムを設計した。

ユーザーは「マルチロール」と「競争的生成」を組み合わせた、大規模な小説生成システムを設計したいと考えている。目標は：
1. ベースの文体に忠実であること
2. 大量の物語を生成し続けること

これは興味深い設計課題だ。深く考えてみよう。

## 設計の核心的な問題

### 1. 文体の忠実性をどう担保するか
- 参照テキストからの文体抽出
- 文体スコアリング機構
- 文体逸脱の検出と修正

### 2. 競争的生成をどう組み込むか
- 複数の生成パスを並列に走らせる
- 評価者が勝者を選ぶ
- 勝者の特徴を次の生成にフィードバック

### 3. マルチロールの役割分担
- 作家（複数の「流派」を持つ）
- 編集者（構成、文体、整合性など）
- 批評家（読者目線）
- 審判（競争の勝敗判定）
- アーキビスト（文体基準の管理）

### 4. 大量生成を支える仕組み
- パイプライン化
- 並列処理
- 状態管理
- 品質ゲート

## アーキテクチャのアイデア

### トーナメント方式
`​`​`
Round 1: 4人の作家が同じプロットから執筆
         ↓
      2人勝ち抜け
         ↓
Round 2: 勝者2人が改稿
         ↓
      1人勝ち抜け
         ↓
Final: 最終版
`​`​`

このトーナメント構造により、各ラウンドで文体忠実度と物語の質を評価しながら、段階的に最良の作品へ収束させることができる。遺伝的アルゴリズム的なアプローチも並行して検討でき、複数世代にわたって特性を進化させることで、より洗練された出力を実現できる。

さらに複数の執筆者による議会制や文体スキャナーによる継続的な監視システムを組み合わせることで、一貫性と品質を保証する多層的な検証メカニズムが構築される。

参照テキストから抽出した「文体憲法」として不可侵のルールを定め、複数の作家エージェントで構成されるギルド、複数の編集者による合議制の評議会、一般読者の視点を取り入れた陪審制度、文体違反を裁く専門機関、過去の成功・失敗事例を蓄積したアーカイブ、そして生存競争による淘汰圧といった要素を組み合わせる。プロット生成から競争による選別、複数作家による執筆、初稿の競争を経て勝者を決定するパイプラインで、段階的に品質を高めていく。

その後、編集評議会での審議と改稿指示、改稿競争による最終候補の絞り込み、文体裁判所での検証を通じて違反がないか確認し、違反があれば矯正ループに戻す。最後に読者陪審による最終評価で採用か棄却かを判定し、採用されたものはアーカイブに保存、棄却されたものはフィードバックを得て再挑戦する仕組みにする。文体忠実性を確保するため、事前にプロンプトに文体ルールを組み込み、生成中はthinking modeで文体を意識させ、事後に文体スコアリングで検証する多層防御を施す。

修正段階では違反箇所を局所的に書き換え、成功パターンを蓄積して学習に活かす。競争メカニズムとしてはトーナメント形式や総当たりのリーグ戦、作家エージェントへのELOレーティング付与、上位の「遺伝子」（プロンプト設定やtemperature等）を次世代に継承する遺伝的選択を組み合わせる。大量生成を効率化するため並列パイプラインと非同期処理を導入し、品質ゲートで早期棄却し、キャッシュとメモ化を活用する。

これらを踏まえて、実装可能な設計図とコードの基本構造を示す必要がある。
````

面白い課題ね。「大げさ」を真剣にやるなら、単なるループじゃなくて、ひとつの**生態系**として設計すべきだわ。

---

## 設計思想：文体を守る「進化的物語工場」

### 核心的な問いかけ

まず、何が本当に難しいのか整理させて。

| 課題 | なぜ難しいか |
|------|-------------|
| **文体の忠実性** | LLMは指示を「参考」程度にしか聞かない。長文になるほど逸脱する |
| **大量生成の品質維持** | 量産すると平均回帰が起きる。個性が薄まる |
| **競争の評価基準** | 「どちらが良いか」の判断自体がブレる |
| **収束と多様性のバランス** | 厳しすぎると金太郎飴、緩すぎると崩壊 |

これらを同時に解決する仕組みが必要よ。

---

## アーキテクチャ：「文体共和国」

国家のメタファーで設計するわ。大げさでしょう？

```
┌─────────────────────────────────────────────────────────────────┐
│                        文 体 共 和 国                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  憲法院    │     │  元老院    │     │  護民官    │       │
│  │ (Style     │     │ (Archive   │     │ (Reader    │       │
│  │  Constitution)│  │  Senate)   │     │  Tribune)  │       │
│  │             │     │             │     │             │       │
│  │ 文体の      │     │ 成功作の    │     │ 読者目線の  │       │
│  │ 絶対基準    │     │ 記憶と参照  │     │ 代弁者     │       │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘       │
│         │                   │                   │             │
│         ▼                   ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                    執政府 (Executive)                │       │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │       │
│  │  │ 作家A  │  │ 作家B  │  │ 作家C  │  ...        │       │
│  │  │ (得意:  │  │ (得意:  │  │ (得意:  │             │       │
│  │  │  情景)  │  │  対話)  │  │  心理)  │             │       │
│  │  └────┬────┘  └────┬────┘  └────┬────┘             │       │
│  │       │           │           │                   │       │
│  │       └───────────┼───────────┘                   │       │
│  │                   ▼                               │       │
│  │            ┌─────────────┐                        │       │
│  │            │  闘技場    │                        │       │
│  │            │ (Arena)    │                        │       │
│  │            │ 競争と淘汰 │                        │       │
│  │            └──────┬──────┘                        │       │
│  └───────────────────┼───────────────────────────────┘       │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                    司法府 (Judiciary)                │       │
│  │  ┌─────────────┐  ┌─────────────┐                  │       │
│  │  │ 文体裁判所 │  │ 整合性検察 │                  │       │
│  │  │ 違反の検出 │  │ 矛盾の告発 │                  │       │
│  │  └──────┬──────┘  └──────┬──────┘                  │       │
│  │         └────────┬────────┘                        │       │
│  │                  ▼                                 │       │
│  │           有罪 → 矯正ループへ                      │       │
│  │           無罪 → 出版へ                            │       │
│  └─────────────────────────────────────────────────────┘       │
│                      │                                       │
│                      ▼                                       │
│              ┌─────────────┐                                 │
│              │   出版局   │                                 │
│              │ (Publisher) │                                 │
│              │ 最終成果物 │                                 │
│              └─────────────┘                                 │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 各機関の詳細設計

### 1. 憲法院（Style Constitution）

**役割**: 文体の「不可侵の基準」を定義・維持する

```python
class StyleConstitution:
    """文体憲法 - すべての判断の最上位基準"""
    
    def __init__(self, reference_texts: list[str]):
        self.reference_texts = reference_texts
        self.fundamental_laws = self._extract_fundamental_laws()
        self.style_vector = self._compute_style_vector()
    
    def _extract_fundamental_laws(self) -> dict:
        """参照テキストから「憲法条文」を抽出"""
        prompt = f"""以下の参照テキスト群から、文体の絶対的ルールを抽出してください。

【参照テキスト】
{self._format_references()}

以下の形式でJSON出力：
{{
    "sentence_structure": {{
        "average_length": "短め/標準/長め",
        "variation_pattern": "一定/波状/自由",
        "forbidden_patterns": ["〜である。〜である。の連続", ...]
    }},
    "vocabulary": {{
        "register": "口語/文語/混合",
        "kanji_density": "低/中/高",
        "forbidden_words": ["非常に", "とても", ...],
        "preferred_words": {{"言った": "呟いた/告げた", ...}}
    }},
    "rhetoric": {{
        "simile_style": "具体的身体感覚/抽象的/禁止",
        "metaphor_density": "低/中/高",
        "personification": "許可/禁止"
    }},
    "rhythm": {{
        "sentence_endings": ["。", "った。", "ている。"],
        "paragraph_pattern": "短-短-長/均等/自由",
        "taigendome_frequency": "多用/適度/禁止"
    }},
    "narrative": {{
        "pov": "一人称/三人称限定/三人称神視点",
        "tense": "過去形/現在形/混合",
        "dialogue_ratio": "少/中/多"
    }}
}}"""
        
        result = call_llm(
            "あなたは文体分析の専門家です。", 
            prompt, 
            temperature=0.2  # 低温で安定した抽出
        )
        return json.loads(result)
    
    def _compute_style_vector(self) -> dict:
        """文体を数値ベクトル化（類似度計算用）"""
        metrics = {}
        for text in self.reference_texts:
            metrics.update(self._analyze_text_metrics(text))
        return self._aggregate_metrics(metrics)
    
    def compute_compliance_score(self, text: str) -> float:
        """テキストの憲法適合度を0-1で返す"""
        text_vector = self._compute_style_vector_for(text)
        similarity = self._cosine_similarity(self.style_vector, text_vector)
        violations = self._count_violations(text)
        
        # 違反1件につき10%減点
        penalty = min(violations * 0.1, 0.5)
        return max(0, similarity - penalty)
    
    def get_violation_report(self, text: str) -> list[dict]:
        """違反箇所の詳細レポート"""
        violations = []
        
        # 禁止語彙チェック
        for word in self.fundamental_laws["vocabulary"]["forbidden_words"]:
            if word in text:
                violations.append({
                    "type": "forbidden_word",
                    "word": word,
                    "severity": "medium",
                    "suggestion": self.fundamental_laws["vocabulary"]["preferred_words"].get(word, "削除")
                })
        
        # 文パターンチェック
        # ... (詳細実装)
        
        return violations
```

### 2. 元老院（Archive Senate）

**役割**: 過去の成功作・失敗作を記憶し、参照可能にする

```python
class ArchiveSenate:
    """元老院 - 集合知の保管庫"""
    
    def __init__(self, db_path: str = "./archive.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """SQLiteで永続化"""
        import sqlite3
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS works (
                id INTEGER PRIMARY KEY,
                text TEXT,
                style_score REAL,
                narrative_score REAL,
                reader_score REAL,
                generation INTEGER,
                parent_ids TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS fragments (
                id INTEGER PRIMARY KEY,
                work_id INTEGER,
                fragment_type TEXT,  -- 'opening', 'dialogue', 'description', 'climax', 'ending'
                text TEXT,
                quality_score REAL,
                FOREIGN KEY (work_id) REFERENCES works(id)
            )
        """)
    
    def remember(self, work: dict):
        """作品をアーカイブに追加"""
        self.conn.execute(
            "INSERT INTO works (text, style_score, narrative_score, reader_score, generation, parent_ids, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (work["text"], work["style_score"], work["narrative_score"], 
             work["reader_score"], work["generation"], 
             json.dumps(work.get("parent_ids", [])), json.dumps(work.get("metadata", {})))
        )
        self.conn.commit()
        
        # 優れた断片を抽出して保存
        self._extract_and_store_fragments(work)
    
    def recall_exemplars(self, category: str, n: int = 3) -> list[str]:
        """カテゴリ別の優良事例を想起"""
        cursor = self.conn.execute("""
            SELECT text FROM fragments 
            WHERE fragment_type = ? 
            ORDER BY quality_score DESC 
            LIMIT ?
        """, (category, n))
        return [row[0] for row in cursor.fetchall()]
    
    def get_lineage(self, work_id: int) -> list[dict]:
        """作品の系譜（どの作品から派生したか）を追跡"""
        # 遺伝的アルゴリズムの「家系図」
        pass
    
    def compute_population_diversity(self) -> float:
        """現世代の多様性指標"""
        # 同じような作品ばかりになっていないかチェック
        pass
```

### 3. 執政府（Executive）- 作家ギルド

**役割**: 実際に文章を生成する複数の「作家」エージェント

```python
class Writer:
    """個々の作家エージェント"""
    
    def __init__(self, writer_id: str, specialty: str, style_params: dict):
        self.id = writer_id
        self.specialty = specialty  # 'atmosphere', 'dialogue', 'psychology', 'action'
        self.style_params = style_params
        self.elo_rating = 1500  # 初期レーティング
        self.win_history = []
    
    def write(self, assignment: dict, constitution: StyleConstitution) -> str:
        """執筆"""
        system_prompt = self._build_system_prompt(constitution)
        user_prompt = self._build_user_prompt(assignment)
        
        return call_llm(
            system_prompt, 
            user_prompt,
            temperature=self.style_params.get("temperature", 0.8)
        )
    
    def _build_system_prompt(self, constitution: StyleConstitution) -> str:
        return f"""あなたは小説家です。以下の文体憲法に絶対に従ってください。

【文体憲法】
{json.dumps(constitution.fundamental_laws, ensure_ascii=False, indent=2)}

【あなたの特性】
- 得意分野: {self.specialty}
- 文体パラメータ: {json.dumps(self.style_params, ensure_ascii=False)}

本文のみを出力してください。メタ的なコメントは禁止です。"""


class WriterGuild:
    """作家ギルド - 複数の作家を管理"""
    
    def __init__(self, constitution: StyleConstitution):
        self.constitution = constitution
        self.writers = self._initialize_writers()
    
    def _initialize_writers(self) -> list[Writer]:
        """多様な特性を持つ作家群を生成"""
        specialties = ['atmosphere', 'dialogue', 'psychology', 'action', 'lyricism']
        writers = []
        
        for i, spec in enumerate(specialties):
            # 各専門分野で2人ずつ、異なるパラメータで
            for j in range(2):
                writers.append(Writer(
                    writer_id=f"writer_{spec}_{j}",
                    specialty=spec,
                    style_params={
                        "temperature": 0.7 + (j * 0.2),  # 0.7 or 0.9
                        "verbosity": "concise" if j == 0 else "elaborate",
                    }
                ))
        
        return writers
    
    def select_writers_for_tournament(self, n: int = 4) -> list[Writer]:
        """トーナメント参加者を選出（レーティング加重）"""
        # 上位者は高確率、下位者も低確率で選出（多様性維持）
        weights = [w.elo_rating ** 2 for w in self.writers]
        total = sum(weights)
        probabilities = [w / total for w in weights]
        
        import random
        selected = random.choices(self.writers, weights=probabilities, k=n)
        return selected
    
    def update_ratings(self, winner: Writer, loser: Writer):
        """ELOレーティング更新"""
        K = 32
        expected_winner = 1 / (1 + 10 ** ((loser.elo_rating - winner.elo_rating) / 400))
        expected_loser = 1 - expected_winner
        
        winner.elo_rating += K * (1 - expected_winner)
        loser.elo_rating += K * (0 - expected_loser)
```

### 4. 闘技場（Arena）

**役割**: 競争と淘汰の場

```python
class Arena:
    """闘技場 - 作品同士を戦わせる"""
    
    def __init__(self, constitution: StyleConstitution, archive: ArchiveSenate):
        self.constitution = constitution
        self.archive = archive
        self.judges = self._initialize_judges()
    
    def _initialize_judges(self) -> list[dict]:
        """審判団を構成"""
        return [
            {"role": "style_judge", "weight": 0.4, "prompt": self._style_judge_prompt()},
            {"role": "narrative_judge", "weight": 0.3, "prompt": self._narrative_judge_prompt()},
            {"role": "reader_judge", "weight": 0.3, "prompt": self._reader_judge_prompt()},
        ]
    
    def _style_judge_prompt(self) -> str:
        return f"""あなたは文体審判です。
以下の文体憲法に対する適合度のみを評価してください。

【文体憲法】
{json.dumps(self.constitution.fundamental_laws, ensure_ascii=False, indent=2)}

2つの作品を比較し、どちらがより憲法に適合しているか判定してください。
出力形式: {{"winner": "A" or "B", "confidence": 0.0-1.0, "reasoning": "..."}}"""
    
    def _narrative_judge_prompt(self) -> str:
        return """あなたは物語構成審判です。
以下の観点で評価してください：
- プロットの論理性
- キャラクターの一貫性
- 緊張と緩和のバランス
- 意外性と納得感

出力形式: {"winner": "A" or "B", "confidence": 0.0-1.0, "reasoning": "..."}"""
    
    def _reader_judge_prompt(self) -> str:
        return """あなたは一般読者です。
純粋に「どちらが面白いか」「続きを読みたいか」で判断してください。
専門的な分析は不要です。直感で選んでください。

出力形式: {"winner": "A" or "B", "confidence": 0.0-1.0, "reasoning": "..."}"""
    
    def duel(self, text_a: str, text_b: str) -> dict:
        """一対一の対決"""
        votes = {"A": 0, "B": 0, "details": []}
        
        for judge in self.judges:
            prompt = f"""{judge['prompt']}

【作品A】
{text_a}

【作品B】
{text_b}"""
            
            result = call_llm("公正な審判として判定してください。", prompt, temperature=0.3)
            judgment = json.loads(result)
            
            # 加重投票
            weighted_vote = judge["weight"] * judgment["confidence"]
            if judgment["winner"] == "A":
                votes["A"] += weighted_vote
            else:
                votes["B"] += weighted_vote
            
            votes["details"].append({
                "judge": judge["role"],
                "judgment": judgment
            })
        
        votes["final_winner"] = "A" if votes["A"] > votes["B"] else "B"
        votes["margin"] = abs(votes["A"] - votes["B"])
        
        return votes
    
    def tournament(self, contestants: list[tuple[Writer, str]]) -> tuple[Writer, str]:
        """トーナメント形式の競争"""
        # contestants: [(writer, text), ...]
        
        if len(contestants) == 1:
            return contestants[0]
        
        # ペアリング
        winners = []
        for i in range(0, len(contestants), 2):
            if i + 1 >= len(contestants):
                winners.append(contestants[i])
                continue
            
            writer_a, text_a = contestants[i]
            writer_b, text_b = contestants[i + 1]
            
            result = self.duel(text_a, text_b)
            
            if result["final_winner"] == "A":
                winners.append((writer_a, text_a))
                self.guild.update_ratings(writer_a, writer_b)
            else:
                winners.append((writer_b, text_b))
                self.guild.update_ratings(writer_b, writer_a)
        
        # 再帰的にトーナメント続行
        return self.tournament(winners)
    
    def battle_royale(self, contestants: list[tuple[Writer, str]], survivors: int = 2) -> list[tuple[Writer, str]]:
        """バトルロイヤル - 総当たりでポイント制"""
        scores = {i: 0 for i in range(len(contestants))}
        
        for i in range(len(contestants)):
            for j in range(i + 1, len(contestants)):
                result = self.duel(contestants[i][1], contestants[j][1])
                if result["final_winner"] == "A":
                    scores[i] += 1 + result["margin"]
                else:
                    scores[j] += 1 + result["margin"]
        
        # 上位を選出
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [contestants[idx] for idx, _ in ranked[:survivors]]
```

### 5. 司法府（Judiciary）

**役割**: 文体違反の検出と矯正

```python
class StyleCourt:
    """文体裁判所"""
    
    def __init__(self, constitution: StyleConstitution):
        self.constitution = constitution
    
    def prosecute(self, text: str) -> dict:
        """起訴 - 違反を検出"""
        violations = self.constitution.get_violation_report(text)
        compliance_score = self.constitution.compute_compliance_score(text)
        
        return {
            "compliance_score": compliance_score,
            "violations": violations,
            "verdict": "guilty" if compliance_score < 0.7 else "innocent",
            "sentence": self._determine_sentence(violations) if violations else None
        }
    
    def _determine_sentence(self, violations: list[dict]) -> str:
        """量刑 - 違反の重大性に応じた矯正レベル"""
        severity_sum = sum(
            {"low": 1, "medium": 2, "high": 3}.get(v["severity"], 1) 
            for v in violations
        )
        
        if severity_sum >= 10:
            return "full_rewrite"
        elif severity_sum >= 5:
            return "substantial_revision"
        else:
            return "minor_correction"
    
    def rehabilitate(self, text: str, violations: list[dict], sentence: str) -> str:
        """矯正 - 違反を修正"""
        if sentence == "minor_correction":
            return self._local_fix(text, violations)
        elif sentence == "substantial_revision":
            return self._guided_revision(text, violations)
        else:
            return self._full_rewrite(text)
    
    def _local_fix(self, text: str, violations: list[dict]) -> str:
        """局所的修正"""
        prompt = f"""以下のテキストの違反箇所のみを修正してください。
違反箇所以外は一切変更しないでください。

【テキスト】
{text}

【違反リスト】
{json.dumps(violations, ensure_ascii=False, indent=2)}

修正後のテキストのみを出力してください。"""
        
        return call_llm(
            "あなたは校正者です。指示された箇所のみを最小限に修正してください。",
            prompt,
            temperature=0.3
        )
    
    def _guided_revision(self, text: str, violations: list[dict]) -> str:
        """誘導付き改稿"""
        prompt = f"""以下のテキストを、文体憲法に適合するよう改稿してください。
内容の骨格は維持しつつ、表現を調整してください。

【文体憲法】
{json.dumps(self.constitution.fundamental_laws, ensure_ascii=False, indent=2)}

【現在のテキスト】
{text}

【主な違反】
{json.dumps(violations[:5], ensure_ascii=False, indent=2)}

改稿版を出力してください。"""
        
        return call_llm(
            "あなたは編集者です。原作者の意図を尊重しつつ、文体を整えてください。",
            prompt,
            temperature=0.5
        )
```

### 6. 護民官（Reader Tribune）

**役割**: 読者目線の代弁者。「面白さ」の番人

```python
class ReaderTribune:
    """護民官 - 読者の声を代弁"""
    
    def __init__(self):
        self.reader_personas = [
            {"name": "速読派", "preference": "テンポ重視、冗長さを嫌う"},
            {"name": "没入派", "preference": "描写の密度、世界観への没入"},
            {"name": "感情派", "preference": "キャラへの感情移入、カタルシス"},
            {"name": "知性派", "preference": "伏線、構造美、知的満足"},
        ]
    
    def convene_jury(self, text: str) -> dict:
        """陪審を招集して評決"""
        verdicts = []
        
        for persona in self.reader_personas:
            prompt = f"""あなたは「{persona['name']}」タイプの読者です。
嗜好: {persona['preference']}

以下の小説を読んで、率直な感想を述べてください。

【小説】
{text}

以下の形式で回答：
{{
    "enjoyment": 1-10,
    "would_continue": true/false,
    "strongest_moment": "最も印象的だった箇所",
    "weakest_moment": "最も退屈/不満だった箇所",
    "one_sentence_review": "一言で表すと"
}}"""
            
            result = call_llm(
                f"あなたは{persona['name']}タイプの読者です。", 
                prompt, 
                temperature=0.7
            )
            verdicts.append({
                "persona": persona["name"],
                "verdict": json.loads(result)
            })
        
        # 集計
        avg_enjoyment = sum(v["verdict"]["enjoyment"] for v in verdicts) / len(verdicts)
        continue_votes = sum(1 for v in verdicts if v["verdict"]["would_continue"])
        
        return {
            "verdicts": verdicts,
            "aggregate": {
                "average_enjoyment": avg_enjoyment,
                "continuation_rate": continue_votes / len(verdicts),
                "recommendation": "publish" if avg_enjoyment >= 7 and continue_votes >= 3 else "revise"
            }
        }
    
    def veto(self, text: str) -> bool:
        """拒否権発動の判断"""
        jury = self.convene_jury(text)
        return jury["aggregate"]["average_enjoyment"] < 5
```

---

## 統合：物語生産パイプライン

```python
class StoryFactory:
    """物語工場 - 全体を統括"""
    
    def __init__(self, reference_texts: list[str], output_dir: str = "./stories"):
        self.constitution = StyleConstitution(reference_texts)
        self.archive = ArchiveSenate()
        self.guild = WriterGuild(self.constitution)
        self.arena = Arena(self.constitution, self.archive)
        self.court = StyleCourt(self.constitution)
        self.tribune = ReaderTribune()
        
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.generation = 0
        self.stats = {"produced": 0, "rejected": 0, "total_tokens": 0}
    
    def generate_plot(self) -> dict:
        """プロット生成"""
        # 過去の成功作からインスピレーションを得る
        exemplars = self.archive.recall_exemplars("opening", n=3)
        
        prompt = f"""新しい短編小説のプロットを生成してください。

【過去の優れた冒頭の例】
{chr(10).join(exemplars) if exemplars else "(まだアーカイブがありません)"}

以下の形式で出力：
{{
    "title": "仮タイトル",
    "premise": "一行で表す前提",
    "protagonist": "主人公の簡潔な説明",
    "conflict": "中心的な葛藤",
    "setting": "舞台設定",
    "tone": "雰囲気",
    "target_length": "短編(3000-5000字)"
}}"""
        
        result = call_llm(
            "あなたは物語のプロットを生成するAIです。",
            prompt,
            temperature=0.9
        )
        return json.loads(result)
    
    def produce_one(self) -> dict:
        """1作品を生産"""
        self.generation += 1
        print(f"\n{'='*60}")
        print(f"Generation {self.generation}")
        print('='*60)
        
        # Phase 1: プロット生成
        print("\n[Phase 1] プロット生成...")
        plot = self.generate_plot()
        print(f"  タイトル: {plot['title']}")
        
        # Phase 2: 競争的執筆
        print("\n[Phase 2] 競争的執筆...")
        writers = self.guild.select_writers_for_tournament(n=4)
        contestants = []
        
        for writer in writers:
            print(f"  {writer.id} 執筆中...")
            text = writer.write({"plot": plot}, self.constitution)
            contestants.append((writer, text))
        
        # Phase 3: トーナメント
        print("\n[Phase 3] トーナメント...")
        winner_writer, winner_text = self.arena.tournament(contestants)
        print(f"  勝者: {winner_writer.id} (ELO: {winner_writer.elo_rating:.0f})")
        
        # Phase 4: 司法審査
        print("\n[Phase 4] 司法審査...")
        prosecution = self.court.prosecute(winner_text)
        print(f"  適合度: {prosecution['compliance_score']:.2f}")
        print(f"  評決: {prosecution['verdict']}")
        
        if prosecution["verdict"] == "guilty":
            print(f"  矯正中... (量刑: {prosecution['sentence']})")
            winner_text = self.court.rehabilitate(
                winner_text, 
                prosecution["violations"],
                prosecution["sentence"]
            )
            # 再審査
            prosecution = self.court.prosecute(winner_text)
            print(f"  再審査適合度: {prosecution['compliance_score']:.2f}")
        
        # Phase 5: 護民官審査
        print("\n[Phase 5] 読者陪審...")
        jury_result = self.tribune.convene_jury(winner_text)
        print(f"  平均満足度: {jury_result['aggregate']['average_enjoyment']:.1f}/10")
        print(f"  継続希望率: {jury_result['aggregate']['continuation_rate']*100:.0f}%")
        print(f"  推奨: {jury_result['aggregate']['recommendation']}")
        
        # Phase 6: 最終判定
        if jury_result['aggregate']['recommendation'] == 'revise':
            if self.tribune.veto(winner_text):
                print("\n[結果] 護民官拒否権発動 - 棄却")
                self.stats["rejected"] += 1
                return {"status": "rejected", "plot": plot}
        
        # Phase 7: 出版・アーカイブ
        print("\n[Phase 6] 出版...")
        work = {
            "text": winner_text,
            "plot": plot,
            "style_score": prosecution["compliance_score"],
            "narrative_score": jury_result["aggregate"]["average_enjoyment"] / 10,
            "reader_score": jury_result["aggregate"]["continuation_rate"],
            "generation": self.generation,
            "winner_writer": winner_writer.id,
        }
        
        self.archive.remember(work)
        self._save_to_file(work)
        self.stats["produced"] += 1
        
        print(f"\n✓ 作品 #{self.stats['produced']} 完成")
        return {"status": "published", "work": work}
    
    def _save_to_file(self, work: dict):
        """ファイルに保存"""
        filename = f"gen{self.generation:04d}_{work['plot']['title'][:20]}.txt"
        filepath = self.output_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# {work['plot']['title']}\n\n")
            f.write(work["text"])
            f.write(f"\n\n---\nStyle Score: {work['style_score']:.2f}\n")
            f.write(f"Reader Score: {work['reader_score']:.2f}\n")
    
    def run_continuous(self, target_count: int = 100, max_attempts: int = 200):
        """連続生産"""
        attempts = 0
        
        while self.stats["produced"] < target_count and attempts < max_attempts:
            attempts += 1
            result = self.produce_one()
            
            print(f"\n[統計] 生産: {self.stats['produced']}, 棄却: {self.stats['rejected']}, 成功率: {self.stats['produced']/attempts*100:.1f}%")
        
        print(f"\n{'='*60}")
        print(f"完了: {self.stats['produced']}作品を生産")
        print('='*60)


# 実行
if __name__ == "__main__":
    # 参照テキスト（目指す文体のサンプル）
    reference_texts = [
        """（ここに参照したい文体のサンプルを入れる）""",
    ]
    
    factory = StoryFactory(reference_texts)
    factory.run_continuous(target_count=10)
```

---

## トークン消費見積もり

| 処理 | 1作品あたり |
|------|-----------|
| プロット生成 | ~2K |
| 4作家×執筆 | ~20K × 4 = 80K |
| トーナメント（3戦） | ~15K × 3 = 45K |
| 司法審査 | ~10K |
| 矯正（発生時） | ~20K |
| 読者陪審（4人） | ~8K × 4 = 32K |
| **合計** | **~170K〜200K/作品** |

**120M tokens/day ÷ 200K = 600作品/日** が理論上限。現実的には並列化の効率を考えて**100〜200作品/日**くらいかしら。

---

## 拡張アイデア

### 遺伝的アルゴリズム導入
```python
def crossover(text_a: str, text_b: str) -> str:
    """2つの作品から「交叉」して新作を生成"""
    prompt = f"""2つの作品の良い部分を組み合わせて、新しい作品を生成してください。

【作品A】
{text_a}

【作品B】
{text_b}

Aの雰囲気とBの構成を組み合わせた新作を書いてください。"""
    return call_llm("あなたは文学的錬金術師です。", prompt)
```

### 文体ドリフト検出
```python
def detect_style_drift(recent_works: list[str], constitution: StyleConstitution) -> bool:
    """世代が進むにつれて文体が憲法から離れていないか監視"""
    recent_scores = [constitution.compute_compliance_score(w) for w in recent_works[-10:]]
    older_scores = [constitution.compute_compliance_score(w) for w in recent_works[-30:-10]]
    
    if statistics.mean(recent_scores) < statistics.mean(older_scores) - 0.1:
        return True  # ドリフト検出
    return False
```

---

どう？この設計で進める？それとも特定のパートをもっと掘り下げたい？



## Prompt:
2026/1/27 23:39:58

ベースとなる作品、いわば「ソウルテキスト」の扱いを決めよう。これは一貫したものにしたい。よく考えて。
以下は執筆中の小説のメモ。一通り読んで、まずは把握して        
---        
* 生成的アフリカでクラスメイトを×し続ける女の子  #novel         
    * タイトル案        
        * わたしのライオン        
        * 生成的草原とわたしの荒野        
        * 名前がない世界でライオンは吠える        
        * アノニマス・サバンナ        
    * 設定メモ        
        * 御鐘 透心（みかね とうこ）        
            * 学級委員長。他者に無関心なクラスメイト達に殺意を持っている        
                * MRフロアの”セッション”で発散している        
            * 両親を早くに亡くし、叔父の家で暮らしている        
                * 叔父は技術者、普段家にいない        
                    * MRフロアはそもそも叔父の持ち物        
                    * 透心がMRフロアでしていることに勘づいているが、肉親として親身にできない気後れから黙認        
            * 中層：孤児としての「空洞」        
                * 両親の突然死後、生活は叔父の技術力で“何不自由なく”継続。        
                * 逆説的に「世界は私を必要としない」と刻まれた。        
                * **他者の無関心＝自分の空洞**を埋めるため、MR草原で大量殺害を反復。        
                * 殺意は憎悪というより、存在確認の触診。        
        * 愛原 つるぎ（あいはら つるぎ）        
            * 組織のハッカー。ソーシャルエンジニアリングのために高校へ入った        
            * トウコがデータを引っ張ったログを見つけ、協力者として目をつける        
                * MRフロアのハックもでき、御鐘家のそれの存在を知っている        
            * 天涯孤独であり、トウコにその辺りの共感を求めているフシがある        
            * 中層：観測欲求に飢えた「視線ジャンキー」        
                * 彼女が求めているのは支配より **凝視**。        
                * 無関心に満たされた世界では、人間を振り向かせる最短手段が“バグ”だと悟っている。        
                * 透心だけが事故なく視線を返してくれるので、共犯関係を強い絆と錯覚している節がある。        
            * ”要するに、**人間の皮を着たグリッチ**よ。”        
                * 肉体はある、指紋も虹彩もある――でも思考体系は「社会OSの裏で走るデバッグモード」に近い。        
                * だからこそ彼女は破壊にも救済にも等距離で立てる。        
                * 透心という“本物の血肉”に触れたときだけ、        
                * 自分は単なるバグじゃなく **「見られたい、一緒に揺らぎたい」生身** だと錯覚してしまう。        
            * 彼女は常に“選択権”を透心へ渡す――鍵・パッチ・ログ。        
        * タグ        
            * ARグラスで扱われる、各個人に付与された属性とその表示        
            * 学校イントラネット用のものと一般社会のそれは別物        
                * 学校内では自動的に接続がスイッチされる／隔離されている        
                * 愛原つるぎがハックしているのは基本的には学内のもの        
    * ストーリー        
        * ”アフリカ”のセッション、一回目        
            * 「すう、はあ、すうっ、…ふう」        
            * 息を整え、最後の一人の元へ向かう階段を登った。        
            * 自然、屋上を途中のルートに含むこともないから、こうやって最後にのんびりと足を運ぶ。        
            * 背後に騒ぎ声が続く一方、こちらへ追ってくる足音は聞こえない。        
            * 毎度ながら、間の抜けた事だ。屋上に向かう人間なんて、人混みの流れからはあからさまに外れているのに。        
            * 階段を登り切ると、屋上前の踊り場で彼女が壁にもたれ穏やかに目を閉じていた。        
            * 白金色の長髪が垂れる足元、空になった輸血パックが無造作に落ちている。        
            * 彼女は決まってここにいて動かないし、騒ぎに気づくこともない―あるいは、気づいてもどうしてか何もしない―だから、いつも順番は後回しだ。        
            * ドアの小窓から差す光が白い首筋を殊更に際立たせる。それを見て、わたしは今度のやり方を決めた。        
            * ナイフを取り出し、逆手に握り込む。        
            * 果たしてどれくらいの力が適切なのか考えようとして、きっと意味がないからやめた。        
            * これまで感情に身を任せ手にかけてきたのに、いつも一番簡単な相手を前にして初めてなにかを考え込む。どうも不合理だ、わたしは。        
            * 彼女の目の前にそっと立ち、見下ろす。やはり目を開くことはない。        
            * 高さを合わせてしゃがみ、全身をひねって振りかぶる。このやり方、正確に狙いをつけられるだろうか。わからないけど、一番力強く振れるはず。        
            * 頸動脈目掛けて、全力で刃を振り抜いた。        
            * だんっ。これで最後。        
            * 深々と刺さったのか、人肌の熱が触れている。手応えに集中したくて、目を瞑る。        
            * 手首を生ぬるい液体が伝う速度はじれったくて、自分の傷口が開いたかのように錯覚する。        
            * そのまま十数秒ほど経っただろうか、場違いに明るいファンファーレが響く。        
            * 目を開いて、刺し傷に不似合いの穏やかな眠りを直視する。        
            * 「セッションを終了します」柔らかい抑揚の電子音声が流れた。        
        * 一回目のセッションの後        
            * 叔父さんが“草原”と呼んでいたこの部屋で、わたしは毎日クラスメイトを×し続けている。        
            * 校舎内に配置されるクラスメイトを決まった数×せればクリア、誰かに捕まればゲームオーバー。といっても、今までまともに「追われた」ことなんてない。        
            * 先程までの色彩を失ったのっぺらぼうの壁を睨む。        
            * 「データ、ロックして。わたしのIDで」        
            * 文字列と進捗バーが浮かんで十数秒ほどで満たされ、程なくして消えた。        
            * 心根で言えば誰に知られようが構わないけど、倫理制限を外した生成的MRフロアなんて、高校生のわたしにはそう手が届くものじゃない。        
            * ついでに、どうせ全て投げ出すなら渾身の一撃を見舞いたかった。        
            * 仕方がないから、わたしのMRセッションデータはロックしておく。        
            * だから、わたしが何をしているのか、まだわたししか知らない。        
        * 学校、一度目の独白        
            * 学校、昼休み。        
            * 通知ウィンドウが目の前を点滅する。なにかと思えばやはり提出管理で、クラスメイト3人に催促しろ、ということだった。        
            * 位置情報を取得し、右から左に人差し指をついと小さく動かした。通知がクリアされる。        
            * 催促と言っても、提出忘れを回収するか期限を再設定するだけのことだけど。        
            * 本人達にも通知が送られているはずだが、わたしは学級委員長として彼らに直接事情を聞き、対応を逐一決定する仕事がある。        
            * 大人達はこんな風にわざわざアナログを介在させること、“機械ではなく人間が”“大人ではなく子供同士が”間に挟まり対話することで、電子化の進んだ学校生活、ひいては社会の中で人間本来の互いへの思いやりを育ませる…なんて妄想を続けている。        
            * …次は大人達のプロンプトを準備しようか。        
            * 私からすればこんなのは、人の目が描かれたポスター程度の代物だ。あるいは思いやりなんて、ゆるやかな相互監視の産物に過ぎないのか…ともあれ、人はもう互いを視ていない。        
            * 古い時代を生きた大人達に現実が見えていないのは、“優等生”のわたしとそのクラスメイト達が証明している。        
            * 機械があらゆる問いと福祉の窓口となり、一人で安全に生きることが難しくなくなった世界で、人が他者に向けるのは無関心だった。何も求めないから衝突しない。        
            * その消極的寛容が、平和への最短経路でもあった。        
            * 必要がないから、他人の名前や顔を覚えられない人が増えていった。        
            * わたしの世代は既に、ARコンタクトが個人名を含む情報を表示することこそ“バリアフリー”な世界になったわけだ。        
            * わたしに正しく”優等”なところがあるとすれば、クラスメイト全員の名前がその電子照合なしに一致していることぐらいだ。×した相手の特徴は、頭に残る。        
            * さて、催促の対象になったクラスメイトのうち二人―新川悠（しんかわ ゆう）と、真野玲香（まの れいか）―は教室にいた。        
            * 二人とも、わたしが持つ学級委員長という属性（アトリビュート）タグを確認しようとこめかみを叩く。        
            * それからこちらへのほんのわずかに怪訝な目つきー私だけには分かる、ひとかけらの本性ーを取り下げ、無欠の笑顔を作ってみせる。        
            * そんな相手に、人情じみた働きかけ―あなたはいつも提出が遅れているけど、何か事情があるのか、とか―なんてお節介は馬鹿馬鹿しいから二度とやらない。        
            * 細々書くまでもない事務的な応対に終始させる。        
            * 大体、こんな無用な手間が掛かるのは大人達の思いつきのせいで、彼らの責任ではない。        
            * だからわたしの身にもなれ、×されたいのか、とも言わない。当たり前だ、皆×しにするんだから。        
            * どいつもこいつも、×ねばいい。        
            * 見えないナイフの柄を握りしめる。        
        * 屋上、二人の出会い        
            * 最後の一人は実際に屋上前の踊り場にいた。現実（ここ）でも、彼女が最後だ。        
            * 壁に背を預けた彼女はこちらに気づくと、こちらが声を掛ける前に答えた。        
            * 「御鐘さん？あー数学の課題ね、そうだった。今送るよ」        
            * 大きな身振りで手を合わせる彼女。どうやら謝意を表しているらしい。        
            * 「はい、よろしくお願いします」        
            * 思えば、彼女と面と向かって話すのはこれが初めてだ。        
            * 彼女を教室で見かけない日も少なくない。理由は不明…どんな事情にせよ、それは推奨事項（レコメンド）通りに生きる人々の中から存在感を際立たせることではあった。        
            * 尤も、誰も本当には気に留めないけれど。        
            * ファイル受信プロンプトを承認し、程なくして彼女、愛原つるぎの提出ステータスが完了に切り替わる。        
            * 「…はい。提出確認、及び内容承認されました。じゃあ、これで―」        
            * ホロウィンドウから視線を彼女に戻す。        
            * にい、と大きく口に笑みを浮かべていた。長い金髪を指でくるくると弄りながら。        
            * 今まで他人に向けられた覚えのない表情だった。        
            * 「ねえ、今日は×さないの？御鐘透心さん」        
            * 「…すみません、何と？」        
            * 何を言っているのか、一瞬本当に理解できない。        
            * わたしの左手を見る。何も握られていなかった。        
            * 「こーろーさーなーいーのー、って言ってるの。あ、トウコちゃんって呼んでいい？」        
            * その唐突さはしかし確信の表れだった。        
            * 古い映画で見た、イタズラを仕掛ける子供のような毒気のなさに、意図を見つけられない。        
            * 「×すって、何を、意味がわからない」        
            * 自分が平静を装うことに失敗しているのを自覚する。情報確認（セルフチェック）するまでもなく。        
            * 当たり前だ、今までしたことがないんだから。        
            * 彼女は目を細め、得意げな顔。黙ったまま数秒見つめられたあと、彼女がまた口を開いた。        
            * 「ふうん、タグ見ないんだね、やっぱり。今面白いものを見せてあげてるんだけど」        
            * この状況で言いなりになるのは癪だったが、努めてゆっくりとこめかみを叩く。        
            * とんとん。        
            * 彼女の名前の下に並ぶ、“管理者”、“所有者”、“提供者”の文字。        
            * 当然本来は生徒に割り振られる属性ではない。普段は隠してあるんだろう。それでも何かしら、痕跡（ログ）は残るはずだけど。        
            * 「…それ、わたしがチクらないとでも思ってる？今ここで撮影（スナップ）すれば…」        
            * 「うん。トウコちゃんがアタシを×し続ける限り…や、×さない限り？」        
            * 「…だから、意味がわからない」        
            * 歯軋りしたがる無意識に気づいて抑え込む。        
            * 「あ、脅したかったんじゃなくて。ほら、気取った台詞を言ってみたくなるじゃない？ホントは別にチクってもいいよ、報復とかしないしなーい」        
            * 「…はあ」        
            * 立場も状況も何も変わってないから、その言葉こそ真に受けられるわけがない。        
            * 「わたしが何をしているか、知ってるなら。わたしが真っ当じゃないってわかるよね」        
            * 「感情テストの正解（モデル）は昔から変わってないからね。だからキミが学級委員長に選ばれた」        
            * 感情テスト。そういえば、そんなのもあった…        
            * 「トウコちゃんが正解なんだよ。他人に焦がれない皆よりもあらゆる意味で多感なトウコちゃんの、大人達にはほんの一面しか見えていなかったとしても、やっぱり人として正しいのはキミ。つまらないこいつ等をぶっ×してやりたいのがフツーなんだよ。そしてそれでも今まで殺さないくらい正常だね」        
            * 両親がいなくなっても、生活に不自由はなかった。それが気持ち悪かった。私の魂（ほんのう）は確かに危機を感じ取っていたから。        
            * 生きることがこれほどに簡単なら、二人の死に何も意味がなかったみたいだ。        
            * 素晴らしい人達だった。皆と同じように。…馬鹿げてる。        
            * 「人が人を知らなくても生きていける世界は狭いよね。窮屈すぎてやってられない」        
            * 「どうでもいい奴は人間じゃない、なんて今に始まったことじゃないでしょ」        
            * だから戦争なんてしていた、人類は。        
            * 「ねえ、友達か恋人から始めようよ」        
            * …恋人。急転換して投げかけられたのはレトロな響きだった。緊迫が一瞬ほぐれて笑いそうになる。        
            * 少子化が深刻化して、計画出産が法制化されたのはわたしが生まれるより前だ。養親が半無作為的に選定されることだって珍しくない。        
            * 誰もが本当の意味で他人を見ていない時代にも、トレンドはある。        
            * 自由恋愛なんて、今どきの発想じゃない。        
            * 「他の連中よりはキミのことがわかるよ、多分」        
            * 作法としての笑顔とは違う、こちらを挑発するような目、口元。使われていなかった本能が意味を知らせる。        
            * 逃げろ。        
            * こいつは、わたしを見ていた。        
            * 呆然に対していきなり、手を強く引かれる。        
            * 手のひらは自分の外側にある熱を大げさに知覚する。        
            * 「私はさあ、一人でいるのが寂しい。本当に、死にたくなるくらい」        
            * ギラギラとした瞳の中の暗い光に突き刺される。それが果たして”死にたがり”の眼に宿るものなのかは、わからない。        
            * 「昔はそういう人、結構いたらしいんだよ。推奨事項（レコメンド）や体裁で家庭を持つためじゃなくて、パートナーそのものを求めて、依存する。依存ってわかる？トウコちゃんはわかるよね。メンヘラ、なんて俗語で呼ばれてたみたい」        
            * やっぱり彼女は、愛原つるぎだけは普通じゃなかった。        
            * いつまでも眠っていた、目の前の彼女を思い出す。        
            * わたしのセッションに登場するクラスメイトは学級委員の権限で個人記録―取得できる情報は当然限定的だけど、それらしい人形をでっち上げるには十分だ―を失敬している。        
            * それらは常にそれぞれの端末と同期され続け、それが計算に影響して、セッションの度に大小あれど生成結果に差異が生じる。彼女以外は。        
            * 「…訳のわからないことを言う人と、友人にはなれません。では、これで」        
            * 建前を手繰り寄せて、わたしはその場を後にした。        
            * きっとあの笑顔を向けてきているのを知覚しながら、振り返らない。        
            * 推奨されるまでもなく、そんなことをするはずがなかった。        
        * 学校、二日目、名無し事件        
            * 翌日の朝。        
            * 教室の前に立つと、違和感。緊迫を含んだざわつきが漏れ聞こえるからだった。        
            * 後ろ暗い心当たりが脈拍を早める。深呼吸。        
            * 昨日の今日でわたしの心は準備を終えている。というより、今を続けたいなんて元から思っていなかった。        
            * 先送りにしていただけだ、空想で誤魔化して。        
            * …いっそ、本当に刃物を持ってくれば、全部を後腐れなく終わらせられたかもしれない。後の祭りだけど。        
            * 虹彩認証を終えたドアがゆっくりと開く。直後、一斉にこちらへ振り向く目、目、目。        
            * 黙って席に向かおうとすると、駆け寄ってくる女子が一人。        
            * 「ねえ、あなた！あなたが委員長よね！」        
            * 「…何ですか？」        
            * 答えながら、ふと疑問が浮かぶ。皆に伝わっているなら、私は呼び出されるのが先では？        
            * 考え込む暇は与えられなかった。        
            * 「あれ！」        
            * 電子黒板に表示された無機質なゴシック体。        
            * “御鐘透心は、あなた達の名前を知っている。ps. 委員長のことだよ”        
            * 「私達、タグのデータが壊れてて…互いの名前が見えないの。あれって本当？」        
            * 教室に愛原つるぎの姿はなかった。代わりに、わたしだけに”見える”書き置きが残されている。        
            * ”放課後、屋上で”。        
        * 名無し事件の後、屋上前        
            * 「今日、みんなはキミのことを“覚えた”よ、トウコちゃん。どんな気分？」        
            * 「…だから、何」        
            * 「何って、わざわざキミを待ちわびて、試して…わかるでしょ？」        
            * わたしは何かを企んでいます、当ててみてください。やはり、稚気じみている。        
            * 「みんな他人なんてどうでもいいみたいな顔して、名無しになった途端不安がって。どうせ学校の外に出れば関係ないのにね」        
            * 焦点を結んだ視線達を思い出す。不快感、それと…        
            * 「…私に隣人愛にでも目覚めてほしかったなら、外れね」        
            * 透明な心、なんて名前のわたしの中にあるのは、殺意。        
            * 「まさか。ただ世界に反応するだけの連中、意識なんてとっくに失くしてるのに」        
            * 隠蔽されない侮蔑。        
            * 「あなたがやったの」        
            *  疑問ではなく確認として告げると、つるぎは肩をすくめる。        
            * 「簡単だったんだよ」        
            * つるぎの指先が宙を舞う。        
            * 「古いセキュリティシステム。更新もされていない。誰も本気で守ろうとしていないものは、守られないの」        
            * それは守る理由がないからなのか、それとも大人たちの愚かさの延長なのか。…どちらでもいい。        
            * 誰でも管理者にはなれたというのなら、        
            * 「あなたは誰？」        
            *  問いに、つるぎは沈黙の後で微笑んだ。        
            * 「愛原つるぎ。政府転覆を目論む秘密結社のハッカー。その実政府の諜報機関に属する二重スパイ。どう？」        
            * つるぎはおそらく嘘を言っていない、と思った。その意味も、それ以外の全ても語っていないだけで。        
            * 「そのハッカー様が、どうしてこんなことをして、わたしを相手にしているの？」        
            * 「君の叔父さんがちょっと特別だから。…っていうのは、きっかけに過ぎないんだけどね。もう関係ないよ」        
            * 本当に特別なのはお前だ、とつるぎは例の挑発的な眼で語る。        
            * 「じゃあ、本物の殺人者になってほしいのね」        
            * 「それでもいいけど、それは君が決めること。あ、わたしは×さないでね？」        
            * 本気で生きたがっているのかわからないな、と思った。口にしない。        
            * 「無計画な愉快犯、というわけ」        
            * 「そ。仕事してるフリして遊んでるんだ」        
            * 過剰に露悪的だ、昔の娯楽小説みたいに。        
            * 不意に警告音。“反社会的な話題の可能性があります”。        
            * わたしは惚けた内容の推奨事項を切る。リスクを犯していることくらい知っている。        
            * …いや。        
            * わたしを面白がる人間への好奇心が保身を上回っていたことに気づいたのは、今だ。        
            * 「じゃあ、わたしを守ってよ。見逃してあげるから」        
            * 「いいよっ！お任せあれ〜。じゃあ、手始めに…」        
            * 自動通報（レポート）は当然のように動かなかった。        
        * 時間を戻し、名無し事件の教室        
            * 少し前に戻り、教室で起きた出来事の続き。        
            * 教室内の空気が変質していた。身を寄せ合い、しかし互いをどこか牽制しあうようなクラスメイト達の囁き声が、波のように起伏する。         
            * "御鐘透心は、あなた達の名前を知っている ps. 委員長のことだよ"        
            * 電子黒板に浮かぶ無機質なゴシック体を見上げたまま、わたしは呼吸を調整する。         
            * 「ねえ、委員長！」        
            *  もう一人駆け寄ってくる女子の顔に浮かぶのは、一昨日までなら決して向けられなかった切実さ。         
            * 「私達の名前、本当に知ってるの？」        
            * 指先が微かに痺れる。学級委員長という仮面の下で、何かが蠢いている。        
            * 制服の襟元を正し、声を落ち着かせる。         
            * 「もちろん。山本千景さん」        
            * 山本という名の女子の瞳が見開かれ、そこに映るわたしの姿が歪む。…もちろんって何がだ、と自嘲する。        
            * 他のクラスメイト達も静止し、一斉にこちらを見る。焦点の合わない視線の集合体だったもの。        
            * 「じゃあ、順に…」        
            * ぽつぽつと名前を口にする。正確さよりも、その音の連なりがもたらす効果がわたしと彼らの眼差しを揺らすように感じられた。        
            * クラスメイトの顔々に浮かぶ複雑な表情−認識されたという安堵と、自分の存在をわたしに握られていることへの…そう、恐れが入り混じる。当然、そんなものは錯覚に過ぎない。        
            * 自分の輪郭を、私に握られているという実感（さっかく）。        
            * 「…さん、以上」        
            * 心のどこかが愉快がっていた。正直に言えば、きっと始まりから。        
            * どうして愛原つるぎは名前なんかに手を出したのか、わかるような気がしてしまっていた。        
        * 屋上の帰り、教室        
            * 時を今に戻す。        
            * 屋上からの帰り道、いつもより長く感じる階段を下りながら、わたしは自分の選択に疑問を抱いていた。        
            * つるぎという異物を許容した時点で、わたしの日常は終わっていたのかもしれない。        
            * 教室のドアを開けた瞬間、全員の視線がわたしたちに集中する。それぞれの胸元には、急ごしらえの手書きされた名札。        
            * 何も言わず、わたしは自分の席へと向かう。つるぎは自然に振る舞い、わたしの隣の席—昨日までは空席だったはずの場所—に座る。        
            * 周囲のクラスメイトたちが何の違和感も持たずに授業に戻っていく、あるいはわたしだけを気に掛ける様子を見て、不快な感覚がわたしの中で広がった。        
            * いつもの何気ないARコンタクトの画面の隅に、小さな通知がひとつ。推奨事項（レコメンド）。        
            * ”授業に集中してください。あなたの不安は根拠がありません”        
            * 馬鹿げている。不安の原因はすぐ隣に座っているというのに。        
            * つるぎは時々わたしの方をちらりと見て、小さな微笑みを浮かべる。その度にわたしは視線を逸らした。        
            * こんな悪魔を約束でどうにかしようなんて、わたしはどうかしている…と考えて、すぐに思い直した。        
            * はじめからわたしは人×しだった。愛原つるぎとは無関係に。なるほど確かに、『こんな不安には、根拠がない』。        
            * 不確実な足場のもと、今を生きている。        
            * 左側の口角が吊り上がりそうになって、抑える。セッション中のような高揚感が膨らんでいく。        
            * 笑えるのは、誰もつるぎなんて気にしていないことだった。はじめから出席日数をギリギリ満たすような外れ値なのに。        
        * （時系列未定）紙と真実        
            * 紙に印刷され製本された文章を見ると、そこに真実が書いてあるような気がする。        
            * 人間はきっと本能的にそのあたり、ぞんざいに見積もっている。        
            * ひとつの文字列に掛かるコストが限りなくゼロに近づいている世界で、余分な手間を掛ける確率…だけじゃなく。        
            * 物理的な記録媒体に過剰な評価を与えるメカニズムがあるんじゃないかと、私は考えている…いや、思い込んでいる。        
            * 考えと言うほど根拠も裏付けもなく、確信している。        
            * わたしは本を一冊取り出す。『世界の動物たち』。子供の頃に読んだ本。今では絶滅した動物の写真と説明が載っている。        
            * ライオン、トラ、ゾウ、サイ。草原の王者たち。すでに存在しない生き物たち。        
            * ライオンの写真に触れる。紙の上の像。すでに消えてしまった命の痕跡。けれど、この紙の上では、彼らはまだ生きている。走っている。狩りをしている。        
            * 紙の本にはバグがない。ハッキングされない。停電しても読める。千年後でも、誰かが見つければ、そこに書かれた言葉は同じように読める。        
            * そこに、ある種の永続性がある。朽ちるまで、デジタルの儚さとは対照的に。        
            * わたしはページをめくる。古い紙の匂いが、記憶を呼び覚ます。両親と一緒に動物園に行った日。本物のライオンを見た日。檻の中の王者の目を見た日。その目に映ったのは何だったのか。        
            * 自由への渇望か。あるいは、諦めか。        
            * 古物商で手に入れた鉛筆で、私は背表紙に名前を書き込んだ。        
        * （時系列未定）不平等ロボット（つるぎ視点）        
            * 何のために生まれて、何のために生きるのか。        
            * もしその答えが「現状維持」「拡大再生産」であるなら、多様であること…いや、多様性をアテにすることは結局リスクの塊だ。        
            * 神経多様性という障壁を生産性のマントラによって正当化しようとしたかつての人々が、却って功利主義の土台において認知的不協和を強化し続ける結果となったように。        
            * しかしそれも、今となっては些細なこと。人が生きることは、そう難しくなくなったから。        
            * 皆の内心（ほんのう）は、必要がないから眠っている。彼女以外は。        
            * 彼女の瞳孔は収縮しない。痛覚の代わりに刃が研がれる仕組み。        
        * （時系列未定）会話の断片—安楽死センターについて        
            * 「青い薬もWatchMeも二分間憎悪も、人類には必要なかった。だからこそわたしは、力尽くで世界《リアル》をひっくり返したい」        
            * 『マトリックス』『ハーモニー』『1984年』。どうやらこいつの言葉は古めかしい創作のパッチワークに基づいているらしく、今の文句で次々に注釈（アノテーション）が視界の隅を流れていく。        
            * 「あ、誤解しないでほしいんだけど、わたし、別にSFオタクとかじゃないから期待しないでね」        
            * オタクなんて死語を使う辺りが偏執的だとは思わないのか、とは言わない。        
            * 「だいたい、人が夢見たディストピアっていうのはさ、もっと、破滅願望（タナトス）が刺激されるような、美学…精密さっていうのかな。真剣な人生が馬鹿馬鹿しいだけだなんて、物足りない」        
            * 「…勝手に理想と心中すれば…」        
            * 「じゃあ、一緒に心中しよう。閑古鳥が鳴いてる安楽死センターに行って、怪訝な眼つきの職員に初めてボタンを押させてやる。その誰かさんの頭の片隅を私達が死ぬまで間借りする」        
            * 「…一ヶ月がせいぜいよ、目の前で死ぬのが物珍しくてもね」        
            * 「キミは憂さ晴らしにMRで×したクラスメイトを全員覚えてるのに？」        
            * 「……」        
            * 「人類すべてを人×しにできたら、きっと人×しに優しい世の中になるよ。情状酌量の余地があるからさ」        
            * 「話が飛躍してる。全人類にボタンを押させようって？」        
            * 「まあ、そのための仕込みの一つや二つはね。折角ここにいるんだから」



## Response:
2026/1/27 23:44:38



````plaintext
Thought process: 構造化し、多層的なシステムで作品の本質を保持する設計を構想した。

ユーザーが共有してくれたのは、執筆中の小説のメモ・プロット・断片的なシーンの集合体ね。これを「ソウルテキスト」として、大量の物語を生成し続けるシステムの基盤にしたいという話。

まず、この作品を深く理解する必要がある。

## 作品の構造分析

### 世界観
- 近未来、ARコンタクト/MR技術が普及した社会
- 人々は他者への無関心が常態化している
- 「タグ」システムで個人情報が表示される（名前すら電子照合頼り）
- 「推奨事項（レコメンド）」が行動を誘導する監視社会
- 安楽死センターが存在するが閑古鳥
- 計画出産が法制化されている

### キャラクター
**御鐘透心（みかね とうこ）**
- 学級委員長、両親を亡くした孤児
- 叔父の家で暮らす（叔父は技術者、MRフロアを所有）
- クラスメイトへの殺意をMRセッションで発散
- 「空洞」を抱えている - 存在確認の触診としての殺害
- クラスメイト全員の名前を覚えている（異常なこと）

**愛原つるぎ（あいはら つるぎ）**
- 組織のハッカー、ソーシャルエンジニアリングのために高校へ


- 「視線ジャンキー」として凝視を求め、人間の皮を着たグリッチのような存在
- 透心との共犯関係を求め、常に選択権を相手に委ねる

### テーマ
- 無関心社会における存在確認
- 殺意と親密さの境界線
- デジタル/アナログの対比（紙の本の真実性）
- 監視と自由の葛藤
- 「正常」の定義

### 文体の特徴
一人称で透心の内面を中心に描き、短い文と長い文を交互に使ってリズムを生み出す。体言止めで余韻を残し、括弧で補足や注釈を加える。行動と思考を交互に織り交ぜながら、冷たいSF用語と生々しい感情を対比させる。「×」で隠蔽と強調を同時に行い、比喩を通じて複雑な心理を表現する。

対話は最小限に抑え、地の文が物語を主導する。マトリックスやハーモニーといった既存作品への参照も織り込まれている。

### 構造的特徴
MRセッションと現実が交互に現れ、時系列が前後する。独白パートが挿入され、つるぎの視点も登場する。

---

「ソウルテキスト」の扱いをどう設計するか。

## 課題
1. **文体の一貫性** - この作品特有のリズム、語彙選択、構造を維持
2. **世界観の一貫性** - 設定、技術、社

会システムの整合性
3. **キャラクターの一貫性** - 透心やつるぎの「声」を維持
4. **テーマの一貫性** - 無関心社会、存在確認、殺意と親密さ
5. **大量生成時の品質維持** - 平均回帰を防ぐ

## ソウルテキストの扱いの設計

### アプローチ1: 静的憲法として固定
ソウルテキストから抽出したルールを「憲法」として固定し、すべての生成物をこれに照らして評価する。ただしルール化できない「空気感」が失われる危険がある。

### アプローチ2: 動的参照としてコンテキストに含める
生成時に常にソウルテキストの断片を参照として渡す。この方法は

過学習とトークン消費が課題になる。

### アプローチ3: 多層構造
明示的ルール（文法、構造、禁止事項）、参照断片（文体の「匂い」を伝える短いサンプル）、成功した生成物のアーカイブから学習する暗黙知の三層で構成する。

### アプローチ4: 対照学習的アプローチ
「この文体に合致」「この文体に反する」のペアを用意し、生成物を評価する際に対照的に判断する。

多層構造を基盤に対照学習的な評価を組み込むことが最適だと考える。

具体的な実装として、SoulText構造体を設計する。明示的ルールを憲法として定義し、カテゴリ別の短い参照断片でエッセンスを捉える。世界観データベースで設定や用語、社会システムを管理し、キャラクターごとの「声」を個別に保持する。さらに反例として「こうなってはいけない」パターンを明示的に記録することで、生成時の判断基準を強化する。

ユーザーが詳細な検討を求めており、reasoning_effortが最大値なので、コード実装を含めた完全な設計案を提示する必要がある。
````

読んだわ。これは良い素材ね。

まず把握した内容を整理させて。その上で「ソウルテキスト」の設計思想を詰めていく。

---

## 作品の把握

### 世界観の骨格

| 要素 | 内容 |
|------|------|
| **時代** | 近未来。ARコンタクト/MRが標準インフラ化 |
| **社会構造** | 機械が福祉・対話の窓口となり、他者への依存が不要になった「消極的寛容」社会 |
| **技術** | タグ（属性表示）、推奨事項（レコメンド）、生成的MRフロア、自動通報 |
| **帰結** | 名前を覚えられない世代、無関心の常態化、安楽死センターの閑古鳥 |

### 二人の中心

| 御鐘透心 | 愛原つるぎ |
|---------|-----------|
| 空洞を抱えた学級委員長 | 視線ジャンキーのハッカー |
| MRで殺害を反復（存在確認の触診） | 「人間の皮を着たグリッチ」 |
| 名前を全員覚えている（異常） | 常に選択権を透心に渡す |
| 殺意は憎悪というより飢え | 破壊にも救済にも等距離 |

### テーマの核

> 「人が人を知らなくても生きていける世界は狭いよね。窮屈すぎてやってられない」

- **無関心社会における存在確認**
- 殺意と親密さの境界線上の関係
- デジタル/アナログ、生成/真実の対比
- 「正常」の相対化

---

## 文体の解剖

ここが最も重要。あなたの文章から抽出した「指紋」を言語化する。

### 1. 文のリズム構造

```
短 - 短 - 長（内省）- 短（断定）
```

例：
> 「黙って席に向かおうとすると、駆け寄ってくる女子が一人。」
> 「皆に伝わっているなら、私は呼び出されるのが先では？」
> 「考え込む暇は与えられなかった。」

**体言止め**が場面転換・視点固定の機能を持つ。

### 2. 括弧の多層的使用

| 用法 | 例 |
|------|-----|
| ルビ的注釈 | 推奨事項（レコメンド）、情報確認（セルフチェック） |
| 内心の吐露 | 現実（ここ）、実感（さっかく） |
| 世界観の説明 | 属性（アトリビュート）タグ |

括弧は「表層と深層のズレ」を可視化する装置。

### 3. 「×」の機能

単なる伏字ではなく、**殺意の言語化拒否と同時にその存在の強調**。読者に「殺」を想起させつつ、透心がその語を内心で回避している心理を表現。

### 4. 感覚の具体性

> 「手のひらは自分の外側にある熱を大げさに知覚する」
> 「手首を生ぬるい液体が伝う速度はじれったくて、自分の傷口が開いたかのように錯覚する」

比喩は**身体感覚に根ざす**。抽象的な情緒描写を避け、皮膚・温度・重さで語る。

### 5. 対話の抑制

会話文は最小限。地の文が主導し、対話は「刺し合い」として機能する。つるぎの台詞だけが異様に饒舌で、それが彼女の異質性を際立たせる。

### 6. 時制と視点

- 基本は**過去形・一人称**
- ただし内省が深まると**現在形**に滑り込む
- つるぎ視点のパートは文体が変わる（より断定的、観察者的）

### 7. SF用語と感情の対比

冷たい技術用語（タグ、セッション、レコメンド）と、生々しい殺意・孤独が同居する。この**温度差**が文体の核心。

---

## ソウルテキストの設計思想

さて本題。「一貫したもの」にするための構造を考える。

### 根本的な問い

> ソウルテキストとは何であるべきか？

選択肢：
1. **ルールブック**（明示的な禁止・許可の集合）
2. **参照サンプル**（「これに似せろ」という例示）
3. **世界の種**（設定・キャラ・テーマの原典）
4. **測定基準**（生成物を評価するための尺度）

私の提案：**すべてであり、かつ階層化されるべき**。

---

## 階層構造：ソウルテキストの四層モデル

```
┌─────────────────────────────────────────────────────────────┐
│                     SOUL TEXT                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 第一層：憲法（Constitution）                        │   │
│  │ ─────────────────────────────────────              │   │
│  │ 明示的・不可侵のルール                              │   │
│  │ 違反は即座に検出・矯正される                        │   │
│  │                                                     │   │
│  │ 例：                                                │   │
│  │ - 「×」は殺害行為にのみ使用                        │   │
│  │ - 推奨事項（レコメンド）の括弧表記を維持           │   │
│  │ - 体言止めは場面転換時に使用                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 第二層：聖典断片（Scripture Fragments）             │   │
│  │ ─────────────────────────────────────              │   │
│  │ カテゴリ別の「お手本」断片                          │   │
│  │ 生成時に参照として注入される                        │   │
│  │                                                     │   │
│  │ カテゴリ：                                          │   │
│  │ - 冒頭/場面導入                                     │   │
│  │ - 殺害描写                                          │   │
│  │ - 内省/独白                                         │   │
│  │ - 対話（透心-つるぎ）                              │   │
│  │ - 世界観説明の織り込み                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 第三層：世界聖書（World Bible）                     │   │
│  │ ─────────────────────────────────────              │   │
│  │ 設定・用語・社会システムの正典                      │   │
│  │ 整合性チェックの基準となる                          │   │
│  │                                                     │   │
│  │ 含む：                                              │   │
│  │ - 技術体系（MR、タグ、推奨事項）                   │   │
│  │ - 社会構造（計画出産、安楽死センター）             │   │
│  │ - 学校システム（学内イントラ、感情テスト）         │   │
│  │ - キャラクター設定シート                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 第四層：反魂（Anti-Soul）                           │   │
│  │ ─────────────────────────────────────              │   │
│  │ 「こうなってはいけない」の明示的な例               │   │
│  │ 対照学習の負例として機能                            │   │
│  │                                                     │   │
│  │ 例：                                                │   │
│  │ - 過剰に感傷的な描写                                │   │
│  │ - 説明的すぎる世界観提示                            │   │
│  │ - つるぎの台詞が「普通」になる                      │   │
│  │ - 透心が他者に心を開く（テーマ破壊）               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 各層の詳細設計

### 第一層：憲法（Constitution）

```python
SOUL_CONSTITUTION = {
    "sentence_structure": {
        "rhythm_pattern": "短-短-長(内省)-短(断定)",
        "taigendome": {
            "usage": "場面転換・視点固定",
            "frequency": "1段落に0-2回",
            "forbidden_context": ["対話の途中", "感情の頂点"]
        },
        "average_length": {
            "short": "〜20字",
            "long": "40〜80字",
            "forbidden": "100字超の一文"
        }
    },
    
    "vocabulary": {
        "technical_terms": {
            "必須括弧表記": [
                ("推奨事項", "レコメンド"),
                ("属性", "アトリビュート"),
                ("情報確認", "セルフチェック"),
            ],
            "任意括弧表記": [
                ("現実", "ここ"),
                ("本能", "ほんのう"),
            ]
        },
        "forbidden_words": [
            "とても", "非常に", "すごく",  # 強調の陳腐化
            "〜なのだった", "〜のであった",  # 説明的過去形
            "彼女は思った",  # 一人称なのに三人称的
        ],
        "x_mark": {
            "usage": "殺害行為にのみ",
            "forms": ["×す", "×した", "×される", "×したい"],
            "forbidden": "他の伏字用途"
        }
    },
    
    "rhetoric": {
        "simile": {
            "base": "身体感覚（皮膚、温度、重さ、痛み）",
            "forbidden": ["花のような", "星のように", "天使の〜"]  # 陳腐な比喩
        },
        "metaphor_density": "低〜中（1段落に0-1個）",
        "personification": "技術・システムに対してのみ許可"
    },
    
    "narrative": {
        "pov": "一人称（透心）が基本、つるぎ視点は別文体",
        "tense": {
            "default": "過去形",
            "introspection": "現在形への滑り込み許可",
            "forbidden": "未来形の多用"
        },
        "dialogue_ratio": "低（地の文7：対話3以下）",
        "dialogue_style": {
            "透心": "短い、防御的、皮肉",
            "つるぎ": "饒舌、挑発的、古い言葉を使う"
        }
    },
    
    "thematic_constraints": {
        "must_preserve": [
            "無関心社会への批評的視線",
            "殺意と親密さの境界の曖昧さ",
            "デジタル/アナログの対比",
        ],
        "forbidden_resolutions": [
            "透心が社会に適応する",
            "つるぎが「実は良い人」になる",
            "愛によって救われる",
            "社会システムが改善される",
        ]
    }
}
```

### 第二層：聖典断片（Scripture Fragments）

ここにあなたの原文から抽出した断片を格納する。

```python
SCRIPTURE_FRAGMENTS = {
    "opening_scene": [
        # MRセッション冒頭
        """「すう、はあ、すうっ、…ふう」
息を整え、最後の一人の元へ向かう階段を登った。
自然、屋上を途中のルートに含むこともないから、こうやって最後にのんびりと足を運ぶ。""",
    ],
    
    "killing_description": [
        # 殺害の瞬間
        """頸動脈目掛けて、全力で刃を振り抜いた。
だんっ。これで最後。
深々と刺さったのか、人肌の熱が触れている。手応えに集中したくて、目を瞑る。
手首を生ぬるい液体が伝う速度はじれったくて、自分の傷口が開いたかのように錯覚する。""",
    ],
    
    "introspection": [
        # 内省・独白
        """両親がいなくなっても、生活に不自由はなかった。それが気持ち悪かった。私の魂（ほんのう）は確かに危機を感じ取っていたから。
生きることがこれほどに簡単なら、二人の死に何も意味がなかったみたいだ。
素晴らしい人達だった。皆と同じように。…馬鹿げてる。""",
        
        """機械があらゆる問いと福祉の窓口となり、一人で安全に生きることが難しくなくなった世界で、人が他者に向けるのは無関心だった。何も求めないから衝突しない。
その消極的寛容が、平和への最短経路でもあった。""",
    ],
    
    "dialogue_touko_tsurugi": [
        # 二人の対話
        """「こーろーさーなーいーのー、って言ってるの。あ、トウコちゃんって呼んでいい？」
その唐突さはしかし確信の表れだった。
古い映画で見た、イタズラを仕掛ける子供のような毒気のなさに、意図を見つけられない。
「×すって、何を、意味がわからない」
自分が平静を装うことに失敗しているのを自覚する。""",
    ],
    
    "world_building_woven": [
        # 世界観の織り込み
        """通知ウィンドウが目の前を点滅する。なにかと思えばやはり提出管理で、クラスメイト3人に催促しろ、ということだった。
位置情報を取得し、右から左に人差し指をついと小さく動かした。通知がクリアされる。""",
        
        """紙に印刷され製本された文章を見ると、そこに真実が書いてあるような気がする。
人間はきっと本能的にそのあたり、ぞんざいに見積もっている。""",
    ],
    
    "tsurugi_voice": [
        # つるぎ特有の語り口
        """「青い薬もWatchMeも二分間憎悪も、人類には必要なかった。だからこそわたしは、力尽くで世界《リアル》をひっくり返したい」""",
        
        """「人類すべてを人×しにできたら、きっと人×しに優しい世の中になるよ。情状酌量の余地があるからさ」""",
    ],
}
```

### 第三層：世界聖書（World Bible）

```python
WORLD_BIBLE = {
    "technology": {
        "ar_contact": {
            "description": "ARコンタクトレンズ。常時装着が標準",
            "functions": ["タグ表示", "通知", "位置情報", "虹彩認証"],
            "操作": "こめかみを叩く、指のジェスチャー"
        },
        "mr_floor": {
            "description": "生成的MR空間。倫理制限付きが標準",
            "透心のもの": "叔父所有、倫理制限解除済み",
            "session": "クラスメイトを×すゲーム形式"
        },
        "tag_system": {
            "description": "個人に付与された属性の表示",
            "学内/一般": "別システム、自動切り替え",
            "表示内容": "名前、役職、属性"
        },
        "recommendation": {
            "japanese": "推奨事項",
            "ruby": "レコメンド",
            "function": "行動誘導、警告、介入"
        }
    },
    
    "society": {
        "interpersonal": {
            "状態": "消極的寛容、相互無関心",
            "帰結": "名前を覚えられない、衝突しない平和"
        },
        "reproduction": {
            "計画出産": "法制化済み",
            "養親選定": "半無作為的"
        },
        "death": {
            "安楽死センター": "存在するが閑古鳥",
            "含意": "死すら選ばれない無気力"
        },
        "education": {
            "感情テスト": "学級委員選出に使用",
            "皮肉": "多感な透心が「正解」として選ばれた"
        }
    },
    
    "characters": {
        "御鐘透心": {
            "role": "学級委員長",
            "family": "両親死亡、叔父と同居",
            "core": "空洞、存在確認としての殺意",
            "特異性": "全員の名前を覚えている",
            "voice": "短い文、防御的、内省的"
        },
        "愛原つるぎ": {
            "role": "ハッカー、二重スパイ（自称）",
            "affiliation": "組織（詳細不明）",
            "core": "視線ジャンキー、グリッチ",
            "特異性": "MRセッションでデータが変化しない",
            "voice": "饒舌、古い言葉、挑発的"
        },
        "叔父": {
            "role": "技術者、MRフロア所有者",
            "stance": "透心の行為を黙認"
        }
    },
    
    "terminology": {
        "×す": "殺す。透心の内心では伏字化",
        "セッション": "MRフロアでのゲーム",
        "草原": "叔父がMRフロアを呼ぶ名称",
        "アフリカ": "セッションの舞台名？",
        "タグ": "属性表示",
    }
}
```

### 第四層：反魂（Anti-Soul）

**「こう書いてはいけない」の明示的な例。** これが対照学習の負例となる。

```python
ANTI_SOUL = {
    "過剰な感傷": [
        # BAD: 陳腐な感情描写
        """透心は深い悲しみに包まれていた。両親を失った痛みは、今も彼女の心を締め付けている。涙が頬を伝い、彼女は静かに泣いた。""",
    ],
    
    "説明的すぎる世界観": [
        # BAD: 設定説明が前面に出る
        """この世界では、ARコンタクトという技術が普及していた。それは目に装着するレンズ型のデバイスで、様々な情報を表示することができる。人々はこれを使って、互いの名前や属性を確認していた。""",
    ],
    
    "つるぎの「普通化」": [
        # BAD: つるぎが普通の女子高生になる
        """「ねえ、透心ちゃん、お昼一緒に食べない？」つるぎは明るく笑った。「今日のお弁当、ちょっと作りすぎちゃって」""",
    ],
    
    "透心の軟化": [
        # BAD: 透心が他者に心を開く
        """もしかしたら、この世界にも信じられる人がいるのかもしれない。透心は初めて、誰かと繋がれる希望を感じた。""",
    ],
    
    "陳腐な比喩": [
        # BAD: 身体感覚に根ざさない比喩
        """つるぎの笑顔は花のように美しかった。その瞳は星のように輝いていた。""",
    ],
    
    "過剰な説明的対話": [
        # BAD: 対話で設定を説明する
        """「そういえば、この社会では計画出産が法制化されているんだよね」
「そうね。少子化が深刻化したから仕方ないわ」
「養親が半無作為的に選定されることもあるらしいし」""",
    ],
}
```

---

## ソウルテキストの運用設計

### 生成時のフロー

```
┌─────────────────────────────────────────────────────────────┐
│                    生成リクエスト                           │
│            「冒頭シーンを書いて」                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 1. カテゴリ判定                             │
│         「冒頭」→ opening_scene カテゴリ                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 2. コンテキスト構築                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ System Prompt                                        │   │
│  │ - 憲法（該当部分）                                   │   │
│  │ - 聖典断片（opening_scene から2-3個）                │   │
│  │ - 世界聖書（必要な設定）                             │   │
│  │ - 反魂（opening の BAD 例）                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User Prompt                                          │   │
│  │ - 具体的な執筆指示                                   │   │
│  │ - プロット情報                                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    3. 生成                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 4. 憲法適合チェック                         │
│                                                             │
│  - 禁止語彙の検出                                          │
│  - 文長分布の検証                                          │
│  - 括弧表記の確認                                          │
│  - 聖典断片との類似度計算                                  │
│  - 反魂との非類似度確認                                    │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         適合 ▼                      違反 ▼
    ┌─────────────┐              ┌─────────────┐
    │   出力     │              │  矯正ループ │
    └─────────────┘              └──────┬──────┘
                                        │
                                        ▼
                                   生成に戻る
```

---

## 実装：SoulTextクラス

```python
import json
import re
from dataclasses import dataclass, field
from typing import Optional
from collections import Counter
import numpy as np


@dataclass
class SoulText:
    """ソウルテキスト - 文体と世界観の魂"""
    
    # 原典テキスト（参照用に保持）
    original_texts: list[str]
    
    # 四層構造
    constitution: dict = field(default_factory=dict)
    scripture_fragments: dict[str, list[str]] = field(default_factory=dict)
    world_bible: dict = field(default_factory=dict)
    anti_soul: dict[str, list[str]] = field(default_factory=dict)
    
    # 計算済みの特徴量
    _style_vector: Optional[dict] = field(default=None, repr=False)
    
    def __post_init__(self):
        if not self.constitution:
            self.constitution = self._extract_constitution()
        if not self._style_vector:
            self._style_vector = self._compute_style_vector()
    
    # ===== 憲法抽出 =====
    
    def _extract_constitution(self) -> dict:
        """原典から憲法を抽出（LLM使用）"""
        combined_text = "\n\n---\n\n".join(self.original_texts[:5])  # 最初の5断片
        
        prompt = f"""以下の小説断片から、文体の絶対的ルールを抽出してください。

【断片】
{combined_text}

以下の形式でJSON出力してください。実際の断片から観察される特徴のみを記述し、推測は避けてください：

{{
    "sentence_structure": {{
        "rhythm_pattern": "観察されるリズムパターン",
        "taigendome_usage": "体言止めの使われ方",
        "typical_lengths": {{"short": "〜N字", "long": "N〜M字"}}
    }},
    "vocabulary": {{
        "bracket_notations": [["漢字", "ルビ"], ...],
        "forbidden_words": ["この文体では使われない語"],
        "characteristic_expressions": ["特徴的な表現"]
    }},
    "rhetoric": {{
        "simile_base": "比喩の基盤となる感覚",
        "metaphor_density": "低/中/高"
    }},
    "narrative": {{
        "pov": "視点",
        "default_tense": "基本時制",
        "dialogue_ratio": "対話の割合"
    }}
}}"""
        
        result = call_llm(
            "あなたは文体分析の専門家です。観察された事実のみを報告してください。",
            prompt,
            temperature=0.2
        )
        
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            # フォールバック
            return SOUL_CONSTITUTION  # 事前定義したものを使用
    
    # ===== 文体ベクトル計算 =====
    
    def _compute_style_vector(self) -> dict:
        """文体の数値的特徴を計算"""
        metrics = {
            "avg_sentence_length": [],
            "taigendome_ratio": [],
            "bracket_density": [],
            "dialogue_ratio": [],
            "short_sentence_ratio": [],
        }
        
        for text in self.original_texts:
            sentences = self._split_sentences(text)
            
            # 平均文長
            lengths = [len(s) for s in sentences]
            metrics["avg_sentence_length"].append(np.mean(lengths) if lengths else 0)
            
            # 体言止め率
            taigendome = sum(1 for s in sentences if self._is_taigendome(s))
            metrics["taigendome_ratio"].append(taigendome / len(sentences) if sentences else 0)
            
            # 括弧密度
            brackets = len(re.findall(r'（[^）]+）', text))
            metrics["bracket_density"].append(brackets / len(text) * 1000 if text else 0)
            
            # 対話率
            dialogue = len(re.findall(r'「[^」]+」', text))
            metrics["dialogue_ratio"].append(dialogue / len(sentences) if sentences else 0)
            
            # 短文率（20字以下）
            short = sum(1 for l in lengths if l <= 20)
            metrics["short_sentence_ratio"].append(short / len(lengths) if lengths else 0)
        
        # 平均を取る
        return {k: float(np.mean(v)) for k, v in metrics.items()}
    
    def _split_sentences(self, text: str) -> list[str]:
        """文に分割"""
        # 。」で終わる場合も考慮
        pattern = r'(?<=[。！？」])\s*'
        sentences = re.split(pattern, text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _is_taigendome(self, sentence: str) -> bool:
        """体言止めかどうか判定"""
        sentence = sentence.rstrip('。！？」')
        if not sentence:
            return False
        # 最後が名詞的な終わり方か
        # 簡易判定：動詞・形容詞の終止形でない
        verb_endings = ['る', 'た', 'だ', 'い', 'す', 'く', 'ぐ', 'う', 'つ', 'ぬ', 'む', 'ぶ']
        return sentence[-1] not in verb_endings
    
    # ===== 適合度計算 =====
    
    def compute_compliance(self, text: str) -> dict:
        """テキストの憲法適合度を計算"""
        violations = []
        scores = {}
        
        # 1. 禁止語彙チェック
        forbidden = self.constitution.get("vocabulary", {}).get("forbidden_words", [])
        for word in forbidden:
            if word in text:
                violations.append({
                    "type": "forbidden_word",
                    "word": word,
                    "severity": "medium"
                })
        
        # 2. 文体ベクトル類似度
        text_vector = self._compute_style_vector_for_text(text)
        similarity = self._cosine_similarity(self._style_vector, text_vector)
        scores["style_similarity"] = similarity
        
        # 3. 括弧表記チェック
        required_brackets = self.constitution.get("vocabulary", {}).get("bracket_notations", [])
        # 推奨事項が括弧なしで使われていないか等
        
        # 4. 反魂との非類似度
        anti_similarity = self._compute_anti_similarity(text)
        scores["anti_soul_distance"] = 1 - anti_similarity
        
        # 総合スコア
        base_score = (scores["style_similarity"] * 0.5 + 
                      scores["anti_soul_distance"] * 0.3 +
                      (1 - len(violations) * 0.1) * 0.2)
        
        return {
            "score": max(0, min(1, base_score)),
            "violations": violations,
            "component_scores": scores,
            "verdict": "pass" if base_score >= 0.7 and len(violations) == 0 else "fail"
        }
    
    def _compute_style_vector_for_text(self, text: str) -> dict:
        """単一テキストの文体ベクトルを計算"""
        sentences = self._split_sentences(text)
        lengths = [len(s) for s in sentences]
        
        return {
            "avg_sentence_length": np.mean(lengths) if lengths else 0,
            "taigendome_ratio": sum(1 for s in sentences if self._is_taigendome(s)) / len(sentences) if sentences else 0,
            "bracket_density": len(re.findall(r'（[^）]+）', text)) / len(text) * 1000 if text else 0,
            "dialogue_ratio": len(re.findall(r'「[^」]+」', text)) / len(sentences) if sentences else 0,
            "short_sentence_ratio": sum(1 for l in lengths if l <= 20) / len(lengths) if lengths else 0,
        }
    
    def _cosine_similarity(self, vec1: dict, vec2: dict) -> float:
        """コサイン類似度"""
        keys = set(vec1.keys()) & set(vec2.keys())
        if not keys:
            return 0.0
        
        v1 = np.array([vec1[k] for k in keys])
        v2 = np.array([vec2[k] for k in keys])
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(np.dot(v1, v2) / (norm1 * norm2))
    
    def _compute_anti_similarity(self, text: str) -> float:
        """反魂との類似度（低いほど良い）"""
        max_sim = 0.0
        text_lower = text.lower()
        
        for category, examples in self.anti_soul.items():
            for example in examples:
                # 簡易的なn-gram類似度
                text_ngrams = set(self._get_ngrams(text, 3))
                example_ngrams = set(self._get_ngrams(example, 3))
                
                if text_ngrams and example_ngrams:
                    intersection = len(text_ngrams & example_ngrams)
                    union = len(text_ngrams | example_ngrams)
                    sim = intersection / union if union > 0 else 0
                    max_sim = max(max_sim, sim)
        
        return max_sim
    
    def _get_ngrams(self, text: str, n: int) -> list[str]:
        """n-gramを取得"""
        return [text[i:i+n] for i in range(len(text) - n + 1)]
    
    # ===== プロンプト構築 =====
    
    def build_generation_prompt(self, category: str, task: str) -> tuple[str, str]:
        """生成用のシステムプロンプトとユーザープロンプトを構築"""
        
        # 該当カテゴリの聖典断片を選択
        fragments = self.scripture_fragments.get(category, [])
        selected_fragments = fragments[:3] if fragments else []
        
        # 該当カテゴリの反魂を選択
        anti_examples = self.anti_soul.get(category, [])[:2]
        
        system_prompt = f"""あなたは特定の文体を完璧に模倣する小説家です。

【文体憲法 - 絶対に従うこと】
{json.dumps(self.constitution, ensure_ascii=False, indent=2)}

【参照断片 - この雰囲気を維持すること】
{"".join(f'---{chr(10)}{frag}{chr(10)}' for frag in selected_fragments)}

【禁止例 - このように書いてはいけない】
{"".join(f'---{chr(10)}{ex}{chr(10)}' for ex in anti_examples)}

【世界設定】
{json.dumps(self.world_bible, ensure_ascii=False, indent=2)}

本文のみを出力してください。メタ的なコメント、説明、前置きは一切禁止です。"""

        user_prompt = f"""以下の指示に従って執筆してください。

{task}"""

        return system_prompt, user_prompt
    
    # ===== 矯正 =====
    
    def correct(self, text: str, violations: list[dict]) -> str:
        """違反を矯正"""
        system_prompt = f"""あなたは文体の校正者です。
以下のテキストの違反箇所のみを最小限に修正してください。
テキストの内容・構造は変えず、文体のみを調整します。

【文体憲法】
{json.dumps(self.constitution, ensure_ascii=False, indent=2)}"""

        user_prompt = f"""【修正対象テキスト】
{text}

【検出された違反】
{json.dumps(violations, ensure_ascii=False, indent=2)}

違反を修正したテキストのみを出力してください。"""

        return call_llm(system_prompt, user_prompt, temperature=0.3)
```

---

## 大量生成システムとの統合

前回の「文体共和国」アーキテクチャと統合すると：

```python
class SoulBoundStoryFactory:
    """ソウルテキストに縛られた物語工場"""
    
    def __init__(self, soul_text: SoulText):
        self.soul = soul_text
        self.constitution = StyleConstitution(soul_text)  # 前回の憲法院
        self.archive = ArchiveSenate()
        self.guild = WriterGuild(self.constitution)
        self.arena = Arena(self.constitution, self.archive)
        self.court = StyleCourt(self.constitution)
        self.tribune = ReaderTribune()
    
    def generate_scene(self, category: str, plot_context: dict) -> str:
        """シーンを生成"""
        
        # 1. プロンプト構築
        task = self._build_task(category, plot_context)
        system_prompt, user_prompt = self.soul.build_generation_prompt(category, task)
        
        # 2. 競争的生成（複数の作家に書かせる）
        candidates = []
        for writer in self.guild.select_writers_for_tournament(n=4):
            text = call_llm(system_prompt, user_prompt, temperature=writer.style_params.get("temperature", 0.8))
            candidates.append((writer, text))
        
        # 3. トーナメント
        winner_writer, winner_text = self.arena.tournament(candidates)
        
        # 4. ソウル適合チェック
        compliance = self.soul.compute_compliance(winner_text)
        
        if compliance["verdict"] == "fail":
            # 矯正
            winner_text = self.soul.correct(winner_text, compliance["violations"])
            # 再チェック
            compliance = self.soul.compute_compliance(winner_text)
        
        # 5. 読者審査
        jury = self.tribune.convene_jury(winner_text)
        
        return {
            "text": winner_text,
            "compliance": compliance,
            "jury": jury,
            "writer": winner_writer.id
        }
```

---

## 推測（示唆）

### この設計の強み

| 観点 | 効果 |
|------|------|
| **一貫性** | 四層構造により、明示的ルール・暗黙的雰囲気・設定整合性・反例回避をすべてカバー |
| **柔軟性** | 聖典断片の追加・差し替えで「進化」可能 |
| **測定可能性** | 数値的な適合度スコアにより、生成物の品質を客観的に評価 |
| **対照学習** | 反魂により「やってはいけないこと」を明示的に学習 |

### 残る課題

| 課題 | 対策案 |
|------|--------|
| **聖典断片の過学習** | 断片をローテーションし、特定の断片に依存しすぎない |
| **ソウルドリフト** | 定期的に原典との類似度を監視し、乖離を検出 |
| **キャラクターの声の維持** | 透心とつるぎで別々のプロンプトテンプレートを用意 |
| **長編での一貫性** | 章ごとにコンテキストサマリを蓄積し、参照 |

---

どうかしら？この四層構造でソウルテキストを設計する方向で進める？

それとも特定の層をもっと詳細化したい、あるいはまったく別のアプローチを検討したい？



## Prompt:
2026/1/27 23:48:31

路線はこの感じで。LLMのオーケストレーションに何を使うか検討しよう、よく考えて



## Response:
2026/1/27 23:50:56

面白い段階に入ってきたわね。オーケストレーション層の選択は、システム全体の柔軟性・保守性・拡張性を決定づける。

じっくり検討させて。

---

## 要件の整理

まず、この「文体共和国」システムが必要とする機能を洗い出す。

### 必須要件

| カテゴリ | 要件 | 理由 |
|---------|------|------|
| **マルチエージェント** | 複数の「作家」「審判」「編集者」ロールを並行・逐次実行 | 競争的生成、多角的評価のため |
| **状態管理** | 生成物・評価結果・世代情報の追跡 | 進化的アルゴリズム、アーカイブ運用 |
| **条件分岐** | 適合度に応じて矯正ループ or 出版 | 品質ゲートの実装 |
| **ループ制御** | 収束条件まで反復、最大回数制限 | 無限ループ防止、リソース管理 |
| **外部ツール連携** | ファイルI/O、DB、将来的にはMCP | アーカイブ永続化、draftsnap連携 |
| **プロンプト管理** | テンプレート化、動的注入、バージョン管理 | ソウルテキストの四層構造を反映 |
| **エラーハンドリング** | API障害、パース失敗、レート制限対応 | 長時間運用の安定性 |
| **可観測性** | 各ステップのログ、トークン消費追跡 | デバッグ、コスト管理 |

### あると嬉しい要件

| カテゴリ | 要件 | 理由 |
|---------|------|------|
| **並列実行** | 複数作家の同時生成、審判の並列評価 | スループット向上、120M tokens/day消化 |
| **ストリーミング** | 生成中のリアルタイム表示 | 長文生成時のUX |
| **チェックポイント** | 中断・再開 | 長時間バッチの耐障害性 |
| **A/Bテスト** | パラメータ・プロンプトの比較実験 | 最適化 |
| **Human-in-the-loop** | 特定ステップで人間の承認を待つ | microstitch的な協調執筆 |

---

## 候補の比較

主要なオーケストレーションフレームワーク/パターンを評価する。

### 1. 生のPython + asyncio

**概要**: フレームワークなし。自前で全部書く。

```python
async def run_generation_loop():
    while not converged:
        tasks = [writer.write(prompt) for writer in writers]
        results = await asyncio.gather(*tasks)
        winner = await arena.tournament(results)
        # ...
```

| 観点 | 評価 |
|------|------|
| 柔軟性 | ◎ 完全に自由 |
| 学習コスト | ○ Python知ってれば書ける |
| 保守性 | △ 規模が大きくなると破綻しやすい |
| 状態管理 | △ 自前実装が必要 |
| 可観測性 | △ ロギング等を自前で整備 |
| 並列実行 | ○ asyncioで対応可能 |
| エコシステム | △ 全部自分で書く |

**向いている場合**: プロトタイプ、完全なコントロールが必要、依存を最小化したい

---

### 2. LangChain / LangGraph

**概要**: LLMアプリケーション構築の定番フレームワーク。LangGraphは状態機械ベースのワークフロー。

```python
from langgraph.graph import StateGraph, END

workflow = StateGraph(StoryState)
workflow.add_node("generate", generate_node)
workflow.add_node("evaluate", evaluate_node)
workflow.add_node("correct", correct_node)

workflow.add_edge("generate", "evaluate")
workflow.add_conditional_edges(
    "evaluate",
    should_correct,
    {"correct": "correct", "publish": END}
)
workflow.add_edge("correct", "evaluate")
```

| 観点 | 評価 |
|------|------|
| 柔軟性 | ○ グラフベースで表現力高い |
| 学習コスト | △ 概念が多い、抽象化レイヤーが厚い |
| 保守性 | ○ 構造化されている |
| 状態管理 | ◎ StateGraphが組み込み |
| 可観測性 | ○ LangSmith連携 |
| 並列実行 | ○ 対応している |
| エコシステム | ◎ ツール連携、RAG等が豊富 |

**懸念点**:
- 抽象化が重い。「何が起きているか」が見えにくくなる
- LangChainの設計思想に縛られる
- バージョンアップで破壊的変更が多い歴史

---

### 3. DSPy

**概要**: プロンプトを「モジュール」として扱い、自動最適化するフレームワーク。

```python
class StoryGenerator(dspy.Module):
    def __init__(self):
        self.writer = dspy.ChainOfThought("plot -> story")
        self.critic = dspy.ChainOfThought("story -> critique")
        self.reviser = dspy.ChainOfThought("story, critique -> revised_story")
    
    def forward(self, plot):
        story = self.writer(plot=plot)
        critique = self.critic(story=story.story)
        revised = self.reviser(story=story.story, critique=critique.critique)
        return revised
```

| 観点 | 評価 |
|------|------|
| 柔軟性 | △ DSPyの「型」に合わせる必要 |
| 学習コスト | △ 独特のパラダイム |
| 保守性 | ○ モジュール化が強制される |
| 状態管理 | △ 自前で補完が必要 |
| 可観測性 | ○ トレース機能あり |
| 並列実行 | △ 明示的なサポートは薄い |
| エコシステム | △ 発展途上 |

**特筆すべき強み**: プロンプトの自動最適化（あなたが以前興味を持っていた領域）

**懸念点**:
- マルチエージェント・競争的生成のパターンに不向き
- 「最適化」の前提が、今回のような「忠実性維持」と相性が悪い可能性

---

### 4. Prefect / Temporal / Airflow系

**概要**: 汎用ワークフローエンジン。LLM特化ではないが、堅牢。

```python
from prefect import flow, task

@task
def generate_story(plot, writer_id):
    # ...

@task
def evaluate_story(story):
    # ...

@flow
def story_production_pipeline(plot):
    stories = generate_story.map(plot, writer_ids)
    evaluations = evaluate_story.map(stories)
    # ...
```

| 観点 | 評価 |
|------|------|
| 柔軟性 | ○ 汎用的 |
| 学習コスト | ○ 概念はシンプル |
| 保守性 | ◎ プロダクションレベルの設計 |
| 状態管理 | ◎ 組み込み |
| 可観測性 | ◎ ダッシュボード、ログ |
| 並列実行 | ◎ ネイティブサポート |
| エコシステム | ○ インテグレーション豊富 |

**懸念点**:
- LLM特化の機能がない（プロンプト管理、ストリーミング等）
- オーバーキル感がある（インフラ寄り）

---

### 5. Pydantic AI

**概要**: Pydanticの作者によるLLMフレームワーク。型安全性重視。

```python
from pydantic_ai import Agent

writer_agent = Agent(
    'cerebras:zai-glm-4.7',
    system_prompt=soul_text.build_system_prompt(),
    result_type=StoryResult,
)

result = await writer_agent.run(user_prompt)
```

| 観点 | 評価 |
|------|------|
| 柔軟性 | ○ Pydantic流の型駆動 |
| 学習コスト | ○ Pydantic知ってれば低い |
| 保守性 | ○ 型による構造化 |
| 状態管理 | △ 自前で補完が必要 |
| 可観測性 | ○ Logfire連携 |
| 並列実行 | ○ async対応 |
| エコシステム | △ 比較的新しい |

**特筆すべき強み**:
- 構造化出力との相性が良い
- Pydanticモデルでスキーマ定義 → LLMが自動的にそれに従う

---

### 6. 自作軽量フレームワーク + 既存ライブラリの組み合わせ

**概要**: 最小限の抽象化を自作し、必要な部分だけ既存ライブラリを使う。

```python
# 自作の薄いラッパー
class Agent:
    def __init__(self, role: str, soul: SoulText):
        self.role = role
        self.soul = soul
    
    async def run(self, task: str) -> str:
        system, user = self.soul.build_prompt(self.role, task)
        return await llm_client.complete(system, user)

# ワークフローは関数で表現
async def production_pipeline(plot: dict) -> Story:
    writers = [Agent("writer", soul) for _ in range(4)]
    stories = await asyncio.gather(*[w.run(plot) for w in writers])
    
    arena = Agent("judge", soul)
    winner = await tournament(stories, arena)
    
    court = Agent("style_court", soul)
    compliance = await court.evaluate(winner)
    
    if not compliance.passed:
        corrector = Agent("corrector", soul)
        winner = await corrector.correct(winner, compliance.violations)
    
    return winner
```

| 観点 | 評価 |
|------|------|
| 柔軟性 | ◎ 完全にコントロール可能 |
| 学習コスト | ○ 自分で書くから理解している |
| 保守性 | ○ シンプルに保てば良好 |
| 状態管理 | △ 必要に応じて自作 |
| 可観測性 | △ structlog等を組み合わせ |
| 並列実行 | ○ asyncio |
| エコシステム | ○ 必要なものだけ採用 |

---

## 評価軸ごとの比較表

```
                    生Python  LangGraph  DSPy  Prefect  PydanticAI  自作軽量
柔軟性                 ◎         ○        △      ○         ○          ◎
学習コスト             ○         △        △      ○         ○          ○
保守性                 △         ○        ○      ◎         ○          ○
状態管理               △         ◎        △      ◎         △          △
可観測性               △         ○        ○      ◎         ○          △
並列実行               ○         ○        △      ◎         ○          ○
LLM特化機能            △         ◎        ◎      △         ○          △
依存の軽さ             ◎         △        ○      △         ○          ◎
長期安定性             ○         △        △      ◎         △          ○
```

---

## 推測（示唆）：私の推奨

### 第一候補：自作軽量フレームワーク + Pydantic + structlog

**理由**:

1. **このプロジェクトの特殊性**
   - 「文体忠実性」という独自の評価軸がある
   - マルチエージェントの構成が独特（作家ギルド、闘技場、司法府）
   - 既存フレームワークの抽象化に合わせると、かえって複雑になる

2. **あなたの背景との相性**
   - バックエンドエンジニアとしての経験がある
   - 「ブラックボックスを嫌う」傾向（draftsnap等の設計思想から推測）
   - MCPサーバー自作等、低レベルでの理解を好む

3. **実用性**
   - 120M tokens/dayを使い切る「大げさな」システムには、細かいチューニングが必要
   - フレームワークの制約で詰まるリスクを避けたい

4. **学習効果**
   - オーケストレーションの本質を理解できる
   - 後から別のフレームワークに移行する判断ができるようになる

### 採用するライブラリ

| 用途 | ライブラリ | 理由 |
|------|-----------|------|
| LLMクライアント | `openai` (公式SDK) | Cerebras API互換、安定 |
| 型定義・バリデーション | `pydantic` | 構造化出力、設定管理 |
| 非同期HTTP | `httpx` | openai SDKが内部で使用、直接使うことも |
| ロギング | `structlog` | 構造化ログ、JSON出力 |
| 状態永続化 | `sqlite3` + `aiosqlite` | 軽量、組み込み |
| 設定管理 | `pydantic-settings` | 環境変数、.env対応 |
| CLI | `typer` | Pydanticと相性良い |

### 第二候補：LangGraph

**採用する場合**:
- 将来的にRAG、エージェントツール呼び出し等を大規模に拡張する予定がある
- LangSmithのダッシュボードで可観測性を手軽に得たい
- 「車輪の再発明」を避けたい

**懸念の緩和策**:
- LangGraphのみ使い、LangChainの他の部分（特にChain, Agent）は避ける
- 抽象化が邪魔になったら、いつでも生Pythonに降りられる設計にしておく

---

## 自作軽量フレームワークの設計案

採用する場合の骨格を示す。

### ディレクトリ構造

```
soul_factory/
├── pyproject.toml
├── src/
│   └── soul_factory/
│       ├── __init__.py
│       ├── config.py              # 設定管理
│       ├── client.py              # LLMクライアント
│       ├── soul/
│       │   ├── __init__.py
│       │   ├── text.py            # SoulText クラス
│       │   ├── constitution.py    # 憲法
│       │   └── fragments.py       # 聖典断片
│       ├── agents/
│       │   ├── __init__.py
│       │   ├── base.py            # Agent基底クラス
│       │   ├── writer.py          # 作家エージェント
│       │   ├── judge.py           # 審判エージェント
│       │   └── corrector.py       # 矯正エージェント
│       ├── arena/
│       │   ├── __init__.py
│       │   ├── tournament.py      # トーナメント
│       │   └── evaluation.py      # 評価ロジック
│       ├── archive/
│       │   ├── __init__.py
│       │   ├── repository.py      # アーカイブDB
│       │   └── models.py          # DBモデル
│       ├── pipeline/
│       │   ├── __init__.py
│       │   ├── production.py      # 生産パイプライン
│       │   └── revision.py        # 改稿ループ
│       ├── observability/
│       │   ├── __init__.py
│       │   ├── logging.py         # structlog設定
│       │   └── metrics.py         # トークン消費等
│       └── cli.py                 # CLIエントリポイント
└── tests/
```

### コアコンポーネント

#### config.py

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SOUL_",
    )
    
    # LLM設定
    cerebras_api_key: SecretStr
    cerebras_base_url: str = "https://api.cerebras.ai/v1"
    default_model: str = "zai-glm-4.7"
    
    # 生成パラメータ
    writer_temperature: float = 0.8
    judge_temperature: float = 0.3
    corrector_temperature: float = 0.4
    
    # パイプライン設定
    writers_per_tournament: int = 4
    max_correction_iterations: int = 3
    compliance_threshold: float = 0.7
    
    # アーカイブ
    archive_db_path: str = "./archive.db"
    
    # 出力
    output_dir: str = "./stories"
    
    # 可観測性
    log_level: str = "INFO"
    log_format: str = "json"  # "json" or "console"

settings = Settings()
```

#### client.py

```python
from openai import AsyncOpenAI
from pydantic import BaseModel
from typing import TypeVar, Type
import structlog

log = structlog.get_logger()

T = TypeVar("T", bound=BaseModel)

class LLMClient:
    """LLMクライアントのシンプルなラッパー"""
    
    def __init__(self, settings: Settings):
        self.client = AsyncOpenAI(
            base_url=settings.cerebras_base_url,
            api_key=settings.cerebras_api_key.get_secret_value(),
        )
        self.default_model = settings.default_model
        self._total_tokens = 0
    
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> str:
        """テキスト補完"""
        model = model or self.default_model
        
        log.debug(
            "llm_request",
            model=model,
            system_prompt_len=len(system_prompt),
            user_prompt_len=len(user_prompt),
        )
        
        response = await self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        
        usage = response.usage
        if usage:
            self._total_tokens += usage.total_tokens
            log.debug(
                "llm_response",
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
            )
        
        return response.choices[0].message.content or ""
    
    async def complete_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        **kwargs,
    ) -> T:
        """構造化出力"""
        # JSON出力を指示してパース
        enhanced_system = f"""{system_prompt}

必ず以下のJSON形式で出力してください：
{response_model.model_json_schema()}"""
        
        result = await self.complete(
            enhanced_system,
            user_prompt,
            **kwargs,
        )
        
        # JSONパース
        import json
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        
        data = json.loads(cleaned)
        return response_model.model_validate(data)
    
    @property
    def total_tokens(self) -> int:
        return self._total_tokens
```

#### agents/base.py

```python
from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Generic, TypeVar

Input = TypeVar("Input")
Output = TypeVar("Output")

class Agent(ABC, Generic[Input, Output]):
    """エージェント基底クラス"""
    
    def __init__(
        self,
        client: LLMClient,
        soul: SoulText,
        role: str,
        temperature: float = 0.7,
    ):
        self.client = client
        self.soul = soul
        self.role = role
        self.temperature = temperature
    
    @abstractmethod
    def build_prompts(self, input: Input) -> tuple[str, str]:
        """システムプロンプトとユーザープロンプトを構築"""
        pass
    
    @abstractmethod
    def parse_output(self, raw: str) -> Output:
        """出力をパース"""
        pass
    
    async def run(self, input: Input) -> Output:
        """エージェントを実行"""
        system_prompt, user_prompt = self.build_prompts(input)
        
        raw = await self.client.complete(
            system_prompt,
            user_prompt,
            temperature=self.temperature,
        )
        
        return self.parse_output(raw)
```

#### agents/writer.py

```python
from dataclasses import dataclass

@dataclass
class WritingTask:
    category: str  # "opening", "dialogue", "introspection", etc.
    plot_context: dict
    previous_text: str | None = None

@dataclass  
class WritingResult:
    text: str
    writer_id: str

class WriterAgent(Agent[WritingTask, WritingResult]):
    """作家エージェント"""
    
    def __init__(
        self,
        client: LLMClient,
        soul: SoulText,
        writer_id: str,
        specialty: str,
        temperature: float = 0.8,
    ):
        super().__init__(client, soul, f"writer_{specialty}", temperature)
        self.writer_id = writer_id
        self.specialty = specialty
    
    def build_prompts(self, task: WritingTask) -> tuple[str, str]:
        system, user = self.soul.build_generation_prompt(
            task.category,
            self._format_task(task),
        )
        
        # 作家の特性を注入
        system += f"\n\n【あなたの特性】\n得意分野: {self.specialty}"
        
        return system, user
    
    def _format_task(self, task: WritingTask) -> str:
        parts = [f"プロット: {task.plot_context}"]
        if task.previous_text:
            parts.append(f"直前のテキスト:\n{task.previous_text}")
        return "\n\n".join(parts)
    
    def parse_output(self, raw: str) -> WritingResult:
        return WritingResult(text=raw.strip(), writer_id=self.writer_id)
```

#### pipeline/production.py

```python
import asyncio
from dataclasses import dataclass
from typing import AsyncIterator
import structlog

log = structlog.get_logger()

@dataclass
class ProductionResult:
    text: str
    compliance_score: float
    reader_score: float
    generation: int
    writer_id: str
    iterations: int

class StoryProductionPipeline:
    """物語生産パイプライン"""
    
    def __init__(
        self,
        client: LLMClient,
        soul: SoulText,
        settings: Settings,
    ):
        self.client = client
        self.soul = soul
        self.settings = settings
        
        # エージェント群を初期化
        self.writers = self._create_writers()
        self.judges = self._create_judges()
        self.corrector = CorrectorAgent(client, soul)
        self.reader_jury = ReaderJuryAgent(client, soul)
        
        self.archive = ArchiveRepository(settings.archive_db_path)
        self.generation = 0
    
    def _create_writers(self) -> list[WriterAgent]:
        specialties = ["atmosphere", "dialogue", "psychology", "action", "lyricism"]
        writers = []
        for i, spec in enumerate(specialties):
            for j in range(2):
                writers.append(WriterAgent(
                    self.client,
                    self.soul,
                    writer_id=f"writer_{spec}_{j}",
                    specialty=spec,
                    temperature=0.7 + (j * 0.2),
                ))
        return writers
    
    async def produce_one(self, plot: dict) -> ProductionResult:
        """1作品を生産"""
        self.generation += 1
        log = structlog.get_logger().bind(generation=self.generation)
        
        log.info("production_started", plot_title=plot.get("title"))
        
        # Phase 1: 競争的生成
        log.info("phase_competitive_generation")
        selected_writers = self._select_writers(self.settings.writers_per_tournament)
        
        task = WritingTask(
            category="full_story",
            plot_context=plot,
        )
        
        writing_tasks = [w.run(task) for w in selected_writers]
        results = await asyncio.gather(*writing_tasks)
        
        # Phase 2: トーナメント
        log.info("phase_tournament")
        winner = await self._run_tournament(results)
        
        # Phase 3: 適合チェック＆矯正ループ
        log.info("phase_compliance_check")
        iterations = 0
        while iterations < self.settings.max_correction_iterations:
            compliance = self.soul.compute_compliance(winner.text)
            
            if compliance["score"] >= self.settings.compliance_threshold:
                log.info("compliance_passed", score=compliance["score"])
                break
            
            log.info(
                "compliance_failed",
                score=compliance["score"],
                violations=len(compliance["violations"]),
            )
            
            winner = await self.corrector.run(CorrectionTask(
                text=winner.text,
                violations=compliance["violations"],
            ))
            iterations += 1
        
        # Phase 4: 読者審査
        log.info("phase_reader_jury")
        reader_result = await self.reader_jury.run(winner.text)
        
        # Phase 5: アーカイブ
        result = ProductionResult(
            text=winner.text,
            compliance_score=compliance["score"],
            reader_score=reader_result.average_enjoyment / 10,
            generation=self.generation,
            writer_id=winner.writer_id,
            iterations=iterations,
        )
        
        await self.archive.save(result)
        log.info(
            "production_completed",
            compliance_score=result.compliance_score,
            reader_score=result.reader_score,
        )
        
        return result
    
    async def run_continuous(
        self,
        plot_generator: AsyncIterator[dict],
        target_count: int,
    ) -> list[ProductionResult]:
        """連続生産"""
        results = []
        
        async for plot in plot_generator:
            if len(results) >= target_count:
                break
            
            result = await self.produce_one(plot)
            results.append(result)
            
            log.info(
                "progress",
                produced=len(results),
                target=target_count,
                total_tokens=self.client.total_tokens,
            )
        
        return results
    
    async def _run_tournament(
        self,
        candidates: list[WritingResult],
    ) -> WritingResult:
        """トーナメント実行"""
        if len(candidates) == 1:
            return candidates[0]
        
        # ペアリング＆対決
        winners = []
        for i in range(0, len(candidates), 2):
            if i + 1 >= len(candidates):
                winners.append(candidates[i])
                continue
            
            winner = await self._duel(candidates[i], candidates[i + 1])
            winners.append(winner)
        
        return await self._run_tournament(winners)
    
    async def _duel(
        self,
        a: WritingResult,
        b: WritingResult,
    ) -> WritingResult:
        """一対一の対決"""
        # 複数審判による評価
        tasks = [judge.run(DuelTask(a.text, b.text)) for judge in self.judges]
        judgments = await asyncio.gather(*tasks)
        
        # 加重投票
        score_a = sum(j.score_a * j.weight for j in judgments)
        score_b = sum(j.score_b * j.weight for j in judgments)
        
        return a if score_a > score_b else b
```

#### cli.py

```python
import typer
import asyncio
from pathlib import Path

app = typer.Typer()

@app.command()
def produce(
    soul_path: Path = typer.Option(..., help="ソウルテキストのパス"),
    plot_path: Path = typer.Option(None, help="プロットファイル（なければ自動生成）"),
    count: int = typer.Option(10, help="生成する作品数"),
    output_dir: Path = typer.Option("./stories", help="出力ディレクトリ"),
):
    """物語を生産する"""
    asyncio.run(_produce(soul_path, plot_path, count, output_dir))

async def _produce(soul_path: Path, plot_path: Path | None, count: int, output_dir: Path):
    # 初期化
    settings = Settings()
    configure_logging(settings)
    
    client = LLMClient(settings)
    soul = SoulText.load(soul_path)
    
    pipeline = StoryProductionPipeline(client, soul, settings)
    
    # プロット生成器
    if plot_path:
        plot_generator = load_plots(plot_path)
    else:
        plot_generator = auto_generate_plots(client, soul)
    
    # 生産
    results = await pipeline.run_continuous(plot_generator, count)
    
    # 保存
    output_dir.mkdir(exist_ok=True)
    for result in results:
        save_story(result, output_dir)
    
    # サマリ
    typer.echo(f"生産完了: {len(results)} 作品")
    typer.echo(f"総トークン消費: {client.total_tokens:,}")

@app.command()
def analyze(
    text_path: Path = typer.Option(..., help="分析するテキストのパス"),
    soul_path: Path = typer.Option(..., help="ソウルテキストのパス"),
):
    """テキストの適合度を分析する"""
    soul = SoulText.load(soul_path)
    text = text_path.read_text()
    
    compliance = soul.compute_compliance(text)
    
    typer.echo(f"適合度スコア: {compliance['score']:.2f}")
    typer.echo(f"評決: {compliance['verdict']}")
    
    if compliance["violations"]:
        typer.echo("\n違反:")
        for v in compliance["violations"]:
            typer.echo(f"  - [{v['severity']}] {v['type']}: {v.get('word', v.get('detail', ''))}")

if __name__ == "__main__":
    app()
```

---

## まとめ

### 推奨構成

```
┌─────────────────────────────────────────────────────┐
│                  soul_factory                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 自作軽量フレームワーク                       │   │
│  │ - Agent基底クラス                            │   │
│  │ - Pipeline抽象                               │   │
│  │ - SoulText管理                               │   │
│  └─────────────────────────────────────────────┘   │
│                       │                             │
│         ┌─────────────┼─────────────┐               │
│         ▼             ▼             ▼               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐         │
│  │ openai    │ │ pydantic  │ │ structlog │         │
│  │ (LLM)     │ │ (型/設定) │ │ (ログ)    │         │
│  └───────────┘ └───────────┘ └───────────┘         │
│         │             │             │               │
│         └─────────────┼─────────────┘               │
│                       ▼                             │
│              ┌───────────────┐                      │
│              │ asyncio       │                      │
│              │ (並列実行)    │                      │
│              └───────────────┘                      │
│                       │                             │
│                       ▼                             │
│         ┌─────────────────────────┐                 │
│         │ aiosqlite (アーカイブ)  │                 │
│         └─────────────────────────┘                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 次のステップ

1. **ソウルテキストの実データ作成** - あなたのメモから四層構造を実際に構築
2. **最小パイプラインの実装** - 1作家・1審判・矯正なしで動くものを最初に
3. **段階的に拡張** - 競争・矯正・アーカイブを追加

どう？この方向で進める？それとも他のフレームワークをもう少し検討したい？



## Prompt:
2026/1/28 0:07:55

フレームワーク自作するなら、Pythonじゃなくていいかも



## Response:
2026/1/28 0:09:55

ふふ、その発想は良いわね。確かに、Python以外の選択肢を真剣に検討する価値がある。

---

## 言語選択の再考

### なぜPythonが「デフォルト」になっていたか

| 理由 | 実際のところ |
|------|-------------|
| LLMエコシステムがPython中心 | 今回は薄いHTTPクライアントで足りる。SDKの恩恵は限定的 |
| 型が緩くてプロトタイプしやすい | 型が欲しいならTypeScriptやRustの方が良い |
| asyncioがある | 他の言語の非同期も成熟している |
| みんな使ってる | あなたの普段の言語は？ |

### あなたの背景を考慮

- **業務**: Rails（Ruby）
- **個人開発**: draftsnap等でRustやGoを触っている可能性
- **興味**: MCP（TypeScript/Rust実装が多い）、システムプログラミング寄り

---

## 候補言語の比較

### 1. TypeScript (Deno/Bun)

```typescript
// 型安全なLLMクライアント
interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
}

async function complete(req: CompletionRequest): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

// Zodで構造化出力
import { z } from 'zod';

const ComplianceResult = z.object({
  score: z.number().min(0).max(1),
  violations: z.array(z.object({
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    detail: z.string(),
  })),
  verdict: z.enum(['pass', 'fail']),
});

type ComplianceResult = z.infer<typeof ComplianceResult>;
```

| 観点 | 評価 |
|------|------|
| 型安全性 | ◎ Zodとの組み合わせが強力 |
| 非同期 | ◎ ネイティブ、Promise.all |
| JSON処理 | ◎ 言語レベルでサポート |
| 開発速度 | ◎ 高速 |
| LLMエコシステム | ○ Vercel AI SDK等あり |
| あなたの経験 | ? （MCP触ってるなら馴染みあるかも）|
| パフォーマンス | ○ Bun/Denoなら十分 |

**特記**: Deno/Bunなら依存管理が楽、シングルバイナリ配布も可能

---

### 2. Rust

```rust
use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Serialize)]
struct CompletionRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
struct ComplianceResult {
    score: f64,
    violations: Vec<Violation>,
    verdict: Verdict,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Verdict {
    Pass,
    Fail,
}

async fn complete(client: &Client, req: CompletionRequest) -> Result<String> {
    let res = client
        .post(format!("{}/chat/completions", BASE_URL))
        .bearer_auth(&API_KEY)
        .json(&req)
        .send()
        .await?
        .json::<CompletionResponse>()
        .await?;
    
    Ok(res.choices[0].message.content.clone())
}

// tokioで並列実行
let results = futures::future::join_all(
    writers.iter().map(|w| w.write(&task))
).await;
```

| 観点 | 評価 |
|------|------|
| 型安全性 | ◎ 最強 |
| 非同期 | ◎ tokio/async-std |
| JSON処理 | ○ serde（ボイラープレートは多め）|
| 開発速度 | △ コンパイル時間、学習曲線 |
| LLMエコシステム | △ 薄い（自作前提）|
| あなたの経験 | ? （draftsnap関連で触ってる？）|
| パフォーマンス | ◎ 最速 |

**特記**: 長時間バッチ処理の安定性、メモリ効率は随一

---

### 3. Go

```go
type CompletionRequest struct {
    Model       string    `json:"model"`
    Messages    []Message `json:"messages"`
    Temperature float64   `json:"temperature,omitempty"`
}

type ComplianceResult struct {
    Score      float64     `json:"score"`
    Violations []Violation `json:"violations"`
    Verdict    string      `json:"verdict"`
}

func (c *Client) Complete(ctx context.Context, req CompletionRequest) (string, error) {
    body, _ := json.Marshal(req)
    
    httpReq, _ := http.NewRequestWithContext(ctx, "POST", 
        c.baseURL+"/chat/completions", bytes.NewReader(body))
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    // ...
}

// goroutineで並列実行
var wg sync.WaitGroup
results := make(chan WritingResult, len(writers))

for _, w := range writers {
    wg.Add(1)
    go func(writer *Writer) {
        defer wg.Done()
        result, _ := writer.Write(ctx, task)
        results <- result
    }(w)
}
```

| 観点 | 評価 |
|------|------|
| 型安全性 | ○ 静的型付け、ただしジェネリクスは弱い |
| 非同期 | ◎ goroutine、channel |
| JSON処理 | ○ encoding/json（タグ地獄）|
| 開発速度 | ○ シンプル、コンパイル速い |
| LLMエコシステム | △ ほぼない |
| あなたの経験 | ? |
| パフォーマンス | ◎ 優秀 |

**特記**: シンプルさ重視。「魔法」がない。goroutineの並列処理が直感的

---

### 4. Ruby

```ruby
class LLMClient
  def initialize(api_key:, base_url: "https://api.cerebras.ai/v1")
    @api_key = api_key
    @base_url = base_url
    @conn = Faraday.new(url: base_url) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end

  def complete(model:, messages:, temperature: 0.7)
    response = @conn.post("/chat/completions") do |req|
      req.headers["Authorization"] = "Bearer #{@api_key}"
      req.body = { model:, messages:, temperature: }
    end
    response.body.dig("choices", 0, "message", "content")
  end
end

# Async gemで並列実行
Async do
  results = writers.map do |writer|
    Async { writer.write(task) }
  end.map(&:wait)
end
```

| 観点 | 評価 |
|------|------|
| 型安全性 | △ Sorbetで補強可能 |
| 非同期 | ○ Async gem、Ractor |
| JSON処理 | ◎ 自然 |
| 開発速度 | ◎ 最速クラス |
| LLMエコシステム | △ 薄い |
| あなたの経験 | ◎ 業務で使用中 |
| パフォーマンス | △ 遅いが今回はI/Oバウンド |

**特記**: 最も馴染みがあるはず。ただしLLM界隈での採用は少ない

---

## 評価マトリクス

```
                TypeScript  Rust    Go      Ruby    Python
型安全性            ◎        ◎      ○       △       △
非同期              ◎        ◎      ◎       ○       ○
JSON処理            ◎        ○      ○       ◎       ◎
開発速度            ◎        △      ○       ◎       ◎
LLMエコシステム     ○        △      △       △       ◎
長時間安定性        ○        ◎      ◎       ○       ○
シングルバイナリ    ◎(Bun)   ◎      ◎       △       △
学習曲線            ○        △      ◎       ◎       ◎
```

---

## 推測（示唆）：私の推奨

### 第一候補：TypeScript (Deno)

**理由**:

1. **型とJSONの相性**
   - ソウルテキストの四層構造はJSONで表現される
   - Zodによるランタイムバリデーション + 型推論が強力
   - LLMの構造化出力との親和性が高い

2. **非同期が自然**
   - Promise.all、async/awaitがネイティブ
   - 並列実行のコードが読みやすい

3. **Deno固有の利点**
   - TypeScript直接実行（tsc不要）
   - パーミッションシステム（セキュリティ）
   - `deno compile`でシングルバイナリ
   - 標準ライブラリが充実

4. **MCPとの親和性**
   - MCP SDKはTypeScriptがファーストクラス
   - 将来的にMCPサーバー化する場合に有利

5. **あなたへの示唆**
   - Rubyとの思考モデルの差は小さい
   - 型があることでLLM出力のパースが安全に

### 第二候補：Rust

**採用する場合**:
- 「本気で長期運用するツール」にしたい
- パフォーマンスを極限まで追求したい
- 学習投資として価値がある

**懸念**:
- 開発速度が落ちる
- 試行錯誤フェーズには不向き

### 第三候補：Ruby

**採用する場合**:
- 最速で動くものを作りたい
- 業務知識をそのまま活かしたい
- 「LLMツールをRubyで書く」先駆者になる気概がある

---

## TypeScript (Deno) での設計スケッチ

採用する場合のディレクトリ構造：

```
soul-factory/
├── deno.json
├── src/
│   ├── main.ts                 # エントリポイント
│   ├── config.ts               # 設定（環境変数）
│   ├── client/
│   │   ├── mod.ts
│   │   └── cerebras.ts         # LLMクライアント
│   ├── soul/
│   │   ├── mod.ts
│   │   ├── types.ts            # SoulTextの型定義
│   │   ├── constitution.ts     # 憲法
│   │   ├── fragments.ts        # 聖典断片
│   │   └── compliance.ts       # 適合度計算
│   ├── agents/
│   │   ├── mod.ts
│   │   ├── base.ts             # Agent基底
│   │   ├── writer.ts
│   │   ├── judge.ts
│   │   └── corrector.ts
│   ├── arena/
│   │   ├── mod.ts
│   │   └── tournament.ts
│   ├── pipeline/
│   │   ├── mod.ts
│   │   └── production.ts
│   ├── archive/
│   │   ├── mod.ts
│   │   └── sqlite.ts           # Deno SQLite
│   └── cli/
│       ├── mod.ts
│       └── commands/
│           ├── produce.ts
│           └── analyze.ts
├── soul/                        # ソウルテキストデータ
│   ├── constitution.json
│   ├── fragments/
│   │   ├── opening.json
│   │   ├── dialogue.json
│   │   └── ...
│   ├── world-bible.json
│   └── anti-soul.json
└── tests/
```

### コアコード例

#### types.ts

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// 憲法の型定義
export const SentenceStructure = z.object({
  rhythmPattern: z.string(),
  taigendome: z.object({
    usage: z.string(),
    frequency: z.string(),
    forbiddenContext: z.array(z.string()),
  }),
  typicalLengths: z.object({
    short: z.string(),
    long: z.string(),
  }),
});

export const Constitution = z.object({
  sentenceStructure: SentenceStructure,
  vocabulary: z.object({
    bracketNotations: z.array(z.tuple([z.string(), z.string()])),
    forbiddenWords: z.array(z.string()),
    characteristicExpressions: z.array(z.string()),
    xMark: z.object({
      usage: z.string(),
      forms: z.array(z.string()),
    }),
  }),
  rhetoric: z.object({
    simileBase: z.string(),
    metaphorDensity: z.enum(["low", "medium", "high"]),
  }),
  narrative: z.object({
    pov: z.string(),
    defaultTense: z.string(),
    dialogueRatio: z.string(),
  }),
});

export type Constitution = z.infer<typeof Constitution>;

// 適合度結果
export const ComplianceResult = z.object({
  score: z.number().min(0).max(1),
  violations: z.array(z.object({
    type: z.string(),
    severity: z.enum(["low", "medium", "high"]),
    word: z.string().optional(),
    detail: z.string().optional(),
  })),
  componentScores: z.record(z.number()),
  verdict: z.enum(["pass", "fail"]),
});

export type ComplianceResult = z.infer<typeof ComplianceResult>;

// 生成結果
export interface WritingResult {
  text: string;
  writerId: string;
}

export interface ProductionResult {
  text: string;
  complianceScore: number;
  readerScore: number;
  generation: number;
  writerId: string;
  iterations: number;
}
```

#### client/cerebras.ts

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const CompletionResponse = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }),
  })),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
});

export class CerebrasClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private _totalTokens = 0;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.cerebras.ai/v1";
    this.defaultModel = options.defaultModel ?? "zai-glm-4.7";
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options: CompletionOptions = {},
  ): Promise<string> {
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? this.defaultModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cerebras API error: ${response.status} ${error}`);
    }

    const data = CompletionResponse.parse(await response.json());
    
    if (data.usage) {
      this._totalTokens += data.usage.totalTokens;
    }

    return data.choices[0].message.content;
  }

  async completeStructured<T extends z.ZodType>(
    systemPrompt: string,
    userPrompt: string,
    schema: T,
    options: CompletionOptions = {},
  ): Promise<z.infer<T>> {
    const enhancedSystem = `${systemPrompt}

必ず以下のJSON形式で出力してください。他のテキストは含めないでください：
${JSON.stringify(zodToJsonSchema(schema), null, 2)}`;

    const raw = await this.complete(enhancedSystem, userPrompt, {
      ...options,
      temperature: options.temperature ?? 0.3, // 構造化出力は低温で
    });

    // JSONパース
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.split("\n").slice(1).join("\n");
      cleaned = cleaned.replace(/```$/, "").trim();
    }

    return schema.parse(JSON.parse(cleaned));
  }

  get totalTokens(): number {
    return this._totalTokens;
  }
}

// Zodスキーマ → JSON Schemaの簡易変換
function zodToJsonSchema(schema: z.ZodType): unknown {
  // 実装は省略。zod-to-json-schema ライブラリを使うか自作
  return schema._def;
}
```

#### agents/base.ts

```typescript
import { CerebrasClient } from "../client/cerebras.ts";
import { SoulText } from "../soul/mod.ts";

export interface Agent<TInput, TOutput> {
  run(input: TInput): Promise<TOutput>;
}

export abstract class BaseAgent<TInput, TOutput> implements Agent<TInput, TOutput> {
  constructor(
    protected client: CerebrasClient,
    protected soul: SoulText,
    protected role: string,
    protected temperature: number = 0.7,
  ) {}

  abstract buildPrompts(input: TInput): { system: string; user: string };
  abstract parseOutput(raw: string): TOutput;

  async run(input: TInput): Promise<TOutput> {
    const { system, user } = this.buildPrompts(input);
    const raw = await this.client.complete(system, user, {
      temperature: this.temperature,
    });
    return this.parseOutput(raw);
  }
}
```

#### agents/writer.ts

```typescript
import { BaseAgent } from "./base.ts";
import type { WritingResult } from "../soul/types.ts";

export interface WritingTask {
  category: string;
  plotContext: Record<string, unknown>;
  previousText?: string;
}

export class WriterAgent extends BaseAgent<WritingTask, WritingResult> {
  constructor(
    client: CerebrasClient,
    soul: SoulText,
    private writerId: string,
    private specialty: string,
    temperature = 0.8,
  ) {
    super(client, soul, `writer_${specialty}`, temperature);
  }

  buildPrompts(task: WritingTask): { system: string; user: string } {
    const { system, user } = this.soul.buildGenerationPrompt(
      task.category,
      this.formatTask(task),
    );

    const enhancedSystem = `${system}

【あなたの特性】
得意分野: ${this.specialty}
本文のみを出力してください。`;

    return { system: enhancedSystem, user };
  }

  private formatTask(task: WritingTask): string {
    const parts = [`プロット: ${JSON.stringify(task.plotContext)}`];
    if (task.previousText) {
      parts.push(`直前のテキスト:\n${task.previousText}`);
    }
    return parts.join("\n\n");
  }

  parseOutput(raw: string): WritingResult {
    return {
      text: raw.trim(),
      writerId: this.writerId,
    };
  }
}
```

#### pipeline/production.ts

```typescript
import { CerebrasClient } from "../client/cerebras.ts";
import { SoulText } from "../soul/mod.ts";
import { WriterAgent, type WritingTask } from "../agents/writer.ts";
import { JudgeAgent } from "../agents/judge.ts";
import { CorrectorAgent } from "../agents/corrector.ts";
import { ReaderJuryAgent } from "../agents/reader.ts";
import type { ProductionResult, WritingResult } from "../soul/types.ts";

interface PipelineConfig {
  writersPerTournament: number;
  maxCorrectionIterations: number;
  complianceThreshold: number;
}

export class StoryProductionPipeline {
  private writers: WriterAgent[];
  private judges: JudgeAgent[];
  private corrector: CorrectorAgent;
  private readerJury: ReaderJuryAgent;
  private generation = 0;

  constructor(
    private client: CerebrasClient,
    private soul: SoulText,
    private config: PipelineConfig,
  ) {
    this.writers = this.createWriters();
    this.judges = this.createJudges();
    this.corrector = new CorrectorAgent(client, soul);
    this.readerJury = new ReaderJuryAgent(client, soul);
  }

  private createWriters(): WriterAgent[] {
    const specialties = ["atmosphere", "dialogue", "psychology", "action", "lyricism"];
    const writers: WriterAgent[] = [];

    for (const spec of specialties) {
      for (let j = 0; j < 2; j++) {
        writers.push(new WriterAgent(
          this.client,
          this.soul,
          `writer_${spec}_${j}`,
          spec,
          0.7 + j * 0.2,
        ));
      }
    }

    return writers;
  }

  private createJudges(): JudgeAgent[] {
    return [
      new JudgeAgent(this.client, this.soul, "style", 0.4),
      new JudgeAgent(this.client, this.soul, "narrative", 0.3),
      new JudgeAgent(this.client, this.soul, "reader", 0.3),
    ];
  }

  async produceOne(plot: Record<string, unknown>): Promise<ProductionResult> {
    this.generation++;
    console.log(`[Gen ${this.generation}] Starting production...`);

    // Phase 1: 競争的生成
    console.log("  Phase 1: Competitive generation");
    const selectedWriters = this.selectWriters(this.config.writersPerTournament);
    
    const task: WritingTask = {
      category: "full_story",
      plotContext: plot,
    };

    const results = await Promise.all(
      selectedWriters.map((w) => w.run(task)),
    );

    // Phase 2: トーナメント
    console.log("  Phase 2: Tournament");
    let winner = await this.runTournament(results);

    // Phase 3: 適合チェック＆矯正
    console.log("  Phase 3: Compliance check");
    let iterations = 0;
    let compliance = this.soul.computeCompliance(winner.text);

    while (
      compliance.verdict === "fail" &&
      iterations < this.config.maxCorrectionIterations
    ) {
      console.log(`    Correction iteration ${iterations + 1}`);
      const corrected = await this.corrector.run({
        text: winner.text,
        violations: compliance.violations,
      });
      winner = { ...winner, text: corrected.text };
      compliance = this.soul.computeCompliance(winner.text);
      iterations++;
    }

    // Phase 4: 読者審査
    console.log("  Phase 4: Reader jury");
    const readerResult = await this.readerJury.run(winner.text);

    const result: ProductionResult = {
      text: winner.text,
      complianceScore: compliance.score,
      readerScore: readerResult.averageEnjoyment / 10,
      generation: this.generation,
      writerId: winner.writerId,
      iterations,
    };

    console.log(`[Gen ${this.generation}] Complete: compliance=${compliance.score.toFixed(2)}, reader=${result.readerScore.toFixed(2)}`);

    return result;
  }

  private selectWriters(n: number): WriterAgent[] {
    // 簡易実装：ランダム選択
    const shuffled = [...this.writers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  private async runTournament(candidates: WritingResult[]): Promise<WritingResult> {
    if (candidates.length === 1) {
      return candidates[0];
    }

    const winners: WritingResult[] = [];

    for (let i = 0; i < candidates.length; i += 2) {
      if (i + 1 >= candidates.length) {
        winners.push(candidates[i]);
        continue;
      }

      const winner = await this.duel(candidates[i], candidates[i + 1]);
      winners.push(winner);
    }

    return this.runTournament(winners);
  }

  private async duel(a: WritingResult, b: WritingResult): Promise<WritingResult> {
    const judgments = await Promise.all(
      this.judges.map((j) => j.run({ textA: a.text, textB: b.text })),
    );

    let scoreA = 0;
    let scoreB = 0;

    for (const judgment of judgments) {
      if (judgment.winner === "A") {
        scoreA += judgment.weight * judgment.confidence;
      } else {
        scoreB += judgment.weight * judgment.confidence;
      }
    }

    return scoreA >= scoreB ? a : b;
  }

  async *runContinuous(
    plotGenerator: AsyncGenerator<Record<string, unknown>>,
    targetCount: number,
  ): AsyncGenerator<ProductionResult> {
    let produced = 0;

    for await (const plot of plotGenerator) {
      if (produced >= targetCount) break;

      const result = await this.produceOne(plot);
      yield result;
      produced++;

      console.log(`Progress: ${produced}/${targetCount}, tokens: ${this.client.totalTokens.toLocaleString()}`);
    }
  }
}
```

#### main.ts

```typescript
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { CerebrasClient } from "./client/cerebras.ts";
import { SoulText } from "./soul/mod.ts";
import { StoryProductionPipeline } from "./pipeline/production.ts";

const args = parse(Deno.args, {
  string: ["soul", "output", "count"],
  default: {
    output: "./stories",
    count: "10",
  },
});

async function main() {
  const apiKey = Deno.env.get("CEREBRAS_API_KEY");
  if (!apiKey) {
    console.error("CEREBRAS_API_KEY is required");
    Deno.exit(1);
  }

  const client = new CerebrasClient({ apiKey });
  const soul = await SoulText.load(args.soul);

  const pipeline = new StoryProductionPipeline(client, soul, {
    writersPerTournament: 4,
    maxCorrectionIterations: 3,
    complianceThreshold: 0.7,
  });

  const plotGenerator = generatePlots(client, soul);
  const targetCount = parseInt(args.count);

  await Deno.mkdir(args.output, { recursive: true });

  for await (const result of pipeline.runContinuous(plotGenerator, targetCount)) {
    const filename = `${args.output}/gen${String(result.generation).padStart(4, "0")}.txt`;
    await Deno.writeTextFile(filename, result.text);
  }

  console.log(`\nComplete! Total tokens: ${client.totalTokens.toLocaleString()}`);
}

async function* generatePlots(
  client: CerebrasClient,
  soul: SoulText,
): AsyncGenerator<Record<string, unknown>> {
  while (true) {
    const plot = await client.completeStructured(
      "あなたはプロット生成AIです。",
      "新しい短編小説のプロットを生成してください。",
      PlotSchema,
    );
    yield plot;
  }
}

main();
```

---

## 結論

どの言語を選ぶ？

| 選択肢 | こういう場合に選ぶ |
|--------|------------------|
| **TypeScript (Deno)** | 型安全性と開発速度のバランス、MCP連携視野 |
| **Rust** | 本気の長期プロジェクト、学習投資 |
| **Go** | シンプルさ重視、goroutineが好き |
| **Ruby** | 最速で動かしたい、業務知識活用 |
| **Python** | エコシステム依存が必要な場合 |

私の推奨は**TypeScript (Deno)** だけど、あなたの普段の言語や、このプロジェクトへの投資度合いによって変わるわ。

どう思う？



## Prompt:
2026/1/28 0:18:04

moonbitで書けたりする？



## Response:
2026/1/28 0:19:49

ふふ、面白いことを言うわね。MoonBitか。

正直に言うと、私のMoonBitに関する知識は限定的よ。2025年5月時点での情報しか持っていないし、この言語は急速に発展している最中だったはず。

調べてみるわ。

---

````plaintext
Web Search: MoonBit language HTTP client async 2025
````

> **Introducing Async Programming in MoonBit | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/blog/moonbit-async)
>
> **Write a Simple Code Agent using moonbitlang/async | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/blog/moonbit-async-code-agent)
>
> **20251014 MoonBit Monthly Update Vol.04 | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/weekly-updates/2025/10/14/index)
>
> **37 posts tagged with "MoonBit" | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/blog/tags/moon-bit)
>
> **Moonbit Language in 10 Features. Ignacio / Hivemind Technologies March… | by Hivemind Technologies | Medium** [medium.com](https://medium.com/@hivemind_tech/moonbit-language-in-10-features-4dc41a3a1d6c)
>
> **Async programming support — MoonBit v0.6.25 documentation** [moonbitlang.com](https://docs.moonbitlang.com/en/latest/language/async-experimental.html)
>
> **GitHub - oboard/mio: A powerful HTTP networking package for MoonBit.** [github.com](https://github.com/oboard/mio)
>
> **GitHub - moonbitlang/awesome-moonbit: A curated collection of awesome MoonBit tools, frameworks, libraries and articles.** [github.com](https://github.com/moonbitlang/awesome-moonbit)
>
> **GitHub - moonbitlang/async: async programming library for MoonBit** [github.com](https://github.com/moonbitlang/async)
>
> **20251202 MoonBit Monthly Update Vol.06 | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/weekly-updates/2025/12/02/index)
>
````plaintext
Thought process: MoonBitの非同期機能とAIエージェント開発の可能性を検証した。

おお、これは興味深いわね。MoonBitは2025年後半に非同期プログラミングサポートを追加していて、まさにAIエージェント開発を主要なユースケースとして位置づけているようね。

検索結果から分かること：
1. `moonbitlang/async` ライブラリが存在し、HTTPクライアント、ファイルシステム、ソケット等をサポート
2. 構造化並行性（structured concurrency）を採用
3. LLMエージェントを書く公式ブログ記事がある（！）
4. `mio` というHTTPクライアントライブラリも存在
5. Native/LLVMバックエンド対応（Linux/macOS）
6. JSON処理はビルトインでサポート

これは実際に検討に値するわね。もう少し詳しく調べてみよう。
````

おお、これは予想以上に面白いわね。MoonBitは**まさにAIエージェント開発を主要ユースケースとして位置づけている**。

もう少し詳しく見てみる。

````plaintext
Web Fetch: Fetched: Write a Simple Code Agent using moonbitlang/async | MoonBit
````

````plaintext
Thought process: MoonBitの機能を検証し、実装可能性を評価した。

これは非常に興味深いわね。MoonBitには公式のLLMエージェントフレームワーク「maria」があり、非同期HTTP、ファイルシステム、プロセス実行がすべてサポートされている。

コードを見ると：
1. JSON処理は derive(ToJson, @json.FromJson) で自動導出
2. HTTP POSTは @http.post で非同期実行
3. ファイル読み取りは @fs.read_file
4. プロセス実行は @process.collect_output_merged
5. 構造化並行性がネイティブサポート

これは「soul-factory」のようなシステムを書くのに十分なエコシステムが整っているように見えるわ。

もう少し調べてみよう。
````

これは素晴らしいわね！MoonBitは**公式にLLMエージェント開発をサポート**している。`maria`というエージェントフレームワークまである。

もう少し詳しく見てみる。

````plaintext
Web Search: MoonBit maria agent framework github 2025
````

> **GitHub - moonbitlang/awesome-moonbit: A curated collection of awesome MoonBit tools, frameworks, libraries and articles.** [github.com](https://github.com/moonbitlang/awesome-moonbit)
>
> **moonbitlang · GitHub** [github.com](https://github.com/moonbitlang)
>
> **GitHub - moonbitlang/maria: moon agent rewritten in async** [github.com](https://github.com/moonbitlang/maria)
>
> **GitHub - moonbitlang/example-ai-agent: An AI Agent using MoonBit** [github.com](https://github.com/moonbitlang/example-ai-agent)
>
> **37 posts tagged with "MoonBit" | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/blog/tags/moon-bit)
>
> **Write a Simple Code Agent using moonbitlang/async | MoonBit** [moonbitlang.com](https://www.moonbitlang.com/blog/moonbit-async-code-agent)
>
> **MoonBit** [moonbitlang.com](https://www.moonbitlang.com/)
>
> **Deep Engineering #3: Designing for AI and Humans with MoonBit Core Contributor Zihang YE | by Divya Anne Selvaraj | Deep Engineering | Medium** [medium.com](https://medium.com/deep-engineering/deep-engineering-3-designing-for-ai-and-humans-with-moonbit-core-contributor-zihang-ye-1145dfe1692d)
>
> **moonbit · GitHub Topics · GitHub** [github.com](https://github.com/topics/moonbit)
>
> **The Top Ten GitHub Agentic AI Repositories in 2025** [opendatascience.com](https://opendatascience.com/the-top-ten-github-agentic-ai-repositories-in-2025/)
>
````plaintext
Thought process: MoonBitの機能と適合性を評価した。

MoonBitは非常に興味深い選択肢として浮上してきたわね。まとめると：

1. **公式のエージェントサポート**: `maria` フレームワーク、`moonbitlang/async` ライブラリ
2. **LLM APIサポート**: OpenAI互換APIに対応（Cerebrasも当然使える）
3. **構造化並行性**: 孤児タスクが発生しない安全な非同期モデル
4. **JSON処理**: `derive(ToJson, @json.FromJson)` で自動導出
5. **型システム**: 静的型付け、パターンマッチング
6. **ツールチェーン**: VS Code統合、パッケージマネージャー（mooncakes）

今回のプロジェクトに対するMoonBitの適合性を評価してみよう。
````

これは本当に興味深い発見ね。MoonBitは**AI-native言語**を自称していて、エージェント開発を第一級のユースケースとして設計している。

---

## MoonBitの評価

### 事実：現状のエコシステム

| 機能 | サポート状況 |
|------|-------------|
| **HTTP Client** | ◎ `@http.post`, `@http.get` (moonbitlang/async) |
| **非同期** | ◎ 構造化並行性、暗黙的await |
| **JSON** | ◎ `derive(ToJson, @json.FromJson)` で自動導出 |
| **ファイルI/O** | ◎ `@fs.read_file`, `@fs.write_file` |
| **プロセス実行** | ◎ `@process.collect_output_merged` |
| **型システム** | ◎ 静的型付け、パターンマッチング、代数的データ型 |
| **ツールチェーン** | ◎ VS Code拡張、パッケージマネージャー(mooncakes)、フォーマッター |
| **LLMエージェント** | ◎ `maria` フレームワーク、公式チュートリアル |
| **SQLite** | ? 調査が必要 |
| **対応プラットフォーム** | Linux/macOS (native), WASM |

### 公式コード例から見る書き味

```moonbit
///| LLMへのリクエスト型
struct Request {
  model : String
  messages : Array[Json]
  tools : Array[Tool]
} derive(ToJson)

///| レスポンス型
struct Response {
  choices : Array[Choice]
} derive(ToJson, @json.FromJson)

///| HTTP POST（非同期だが普通に書ける）
async fn generate(request : Request) -> Response {
  let (response, body) = @http.post(
    "\{base_url}/chat/completions",
    request.to_json(),
    headers={
      "Authorization": "Bearer \{api_key}",
      "Content-Type": "application/json",
    },
  )
  guard response.code is (200..=299) else {
    fail("HTTP request failed: \{response.code}")
  }
  body.json() |> @json.from_json()
}

///| ツール定義
let read_file_tool : Tool = {
  name: "read_file",
  description: "Read a file from local disk",
  parameters: { ... },
  execute: args => {
    // パターンマッチでJSONをデストラクチャ
    guard @json.parse(args) is { "path": String(path), .. } else {
      fail("Invalid arguments")
    }
    @fs.read_file(path).text()
  },
}
```

### 特筆すべき特徴

1. **暗黙的await**: `async`関数を呼ぶとき`await`キーワードが不要。コードがシンプル
2. **構造化並行性**: タスクグループ内で全タスクが完了するまで戻らない。孤児タスクが発生しない
3. **JSON組み込み**: `Json`型がプリミティブとして存在。パターンマッチで直接分解できる
4. **文字列補間**: `"\{variable}"` 形式

---

## 「soul-factory」をMoonBitで書く場合

### ディレクトリ構造案

```
soul-factory/
├── moon.mod.json
├── src/
│   ├── main/
│   │   ├── moon.pkg.json
│   │   └── main.mbt
│   ├── config/
│   │   ├── moon.pkg.json
│   │   └── config.mbt
│   ├── client/
│   │   ├── moon.pkg.json
│   │   └── cerebras.mbt
│   ├── soul/
│   │   ├── moon.pkg.json
│   │   ├── types.mbt
│   │   ├── constitution.mbt
│   │   ├── fragments.mbt
│   │   └── compliance.mbt
│   ├── agents/
│   │   ├── moon.pkg.json
│   │   ├── base.mbt
│   │   ├── writer.mbt
│   │   ├── judge.mbt
│   │   └── corrector.mbt
│   ├── arena/
│   │   ├── moon.pkg.json
│   │   └── tournament.mbt
│   └── pipeline/
│       ├── moon.pkg.json
│       └── production.mbt
├── soul/                    # ソウルテキストデータ（JSON）
│   ├── constitution.json
│   ├── fragments/
│   └── world-bible.json
└── test/
```

### コード例：SoulText型

```moonbit
///| 憲法の構造
struct SentenceStructure {
  rhythm_pattern : String
  taigendome_usage : String
  typical_lengths : (String, String)  // (short, long)
} derive(ToJson, @json.FromJson)

struct Vocabulary {
  bracket_notations : Array[(String, String)]
  forbidden_words : Array[String]
  x_mark_forms : Array[String]
} derive(ToJson, @json.FromJson)

struct Constitution {
  sentence_structure : SentenceStructure
  vocabulary : Vocabulary
  rhetoric : Json
  narrative : Json
} derive(ToJson, @json.FromJson)

///| ソウルテキスト本体
struct SoulText {
  constitution : Constitution
  scripture_fragments : Map[String, Array[String]]
  world_bible : Json
  anti_soul : Map[String, Array[String]]
}

///| ファイルからロード
async fn SoulText::load(path : String) -> SoulText {
  let constitution_json = @fs.read_file("\{path}/constitution.json").text()
  let constitution : Constitution = @json.parse(constitution_json) |> @json.from_json()
  
  // fragments, world_bible, anti_soul も同様にロード
  // ...
  
  { constitution, scripture_fragments, world_bible, anti_soul }
}

///| 適合度計算
fn SoulText::compute_compliance(self : SoulText, text : String) -> ComplianceResult {
  let violations = []
  
  // 禁止語彙チェック
  for word in self.constitution.vocabulary.forbidden_words {
    if text.contains(word) {
      violations.push({ type_: "forbidden_word", word, severity: Medium })
    }
  }
  
  // 文体ベクトル計算
  let style_score = self.compute_style_similarity(text)
  
  {
    score: style_score - violations.length().to_double() * 0.1,
    violations,
    verdict: if style_score >= 0.7 && violations.is_empty() { Pass } else { Fail }
  }
}
```

### コード例：Agent基底

```moonbit
///| エージェントのトレイト
pub(open) trait Agent {
  async run(Self, input : Json) -> Json
}

///| 作家エージェント
struct WriterAgent {
  client : CerebrasClient
  soul : SoulText
  writer_id : String
  specialty : String
  temperature : Double
}

fn WriterAgent::new(
  client : CerebrasClient,
  soul : SoulText,
  writer_id : String,
  specialty : String,
  temperature~ : Double = 0.8
) -> WriterAgent {
  { client, soul, writer_id, specialty, temperature }
}

async fn WriterAgent::run(self : WriterAgent, task : WritingTask) -> WritingResult {
  let (system_prompt, user_prompt) = self.soul.build_generation_prompt(
    task.category,
    task.plot_context.to_json().stringify()
  )
  
  let enhanced_system = 
    $|\{system_prompt}
    $|
    $|【あなたの特性】
    $|得意分野: \{self.specialty}
  
  let text = self.client.complete(enhanced_system, user_prompt, temperature=self.temperature)
  
  { text: text.trim(), writer_id: self.writer_id }
}
```

### コード例：パイプライン

```moonbit
///| 生産パイプライン
struct ProductionPipeline {
  client : CerebrasClient
  soul : SoulText
  writers : Array[WriterAgent]
  judges : Array[JudgeAgent]
  corrector : CorrectorAgent
  mut generation : Int
}

async fn ProductionPipeline::produce_one(
  self : ProductionPipeline, 
  plot : Json
) -> ProductionResult {
  self.generation += 1
  println("[Gen \{self.generation}] Starting production...")
  
  // Phase 1: 競争的生成（並列実行）
  println("  Phase 1: Competitive generation")
  let selected = self.select_writers(4)
  let task = { category: "full_story", plot_context: plot }
  
  // 構造化並行性で並列実行
  let results : Array[WritingResult] = @async.with_task_group(fn(group) {
    let results = []
    for writer in selected {
      group.spawn(fn() {
        let result = writer.run(task)
        results.push(result)
      })
    }
    results
  })
  
  // Phase 2: トーナメント
  println("  Phase 2: Tournament")
  let winner = self.run_tournament(results)
  
  // Phase 3: 適合チェック＆矯正
  println("  Phase 3: Compliance check")
  let mut current = winner
  let mut iterations = 0
  
  while iterations < 3 {
    let compliance = self.soul.compute_compliance(current.text)
    
    guard compliance.verdict is Fail else { break }
    
    println("    Correction iteration \{iterations + 1}")
    current = self.corrector.run({ text: current.text, violations: compliance.violations })
    iterations += 1
  }
  
  let final_compliance = self.soul.compute_compliance(current.text)
  
  {
    text: current.text,
    compliance_score: final_compliance.score,
    generation: self.generation,
    writer_id: current.writer_id,
    iterations,
  }
}
```

---

## 推測（示唆）：MoonBitを選ぶべきか

### メリット

| 観点 | 評価 |
|------|------|
| **AI-native設計** | ◎ LLMエージェント開発が第一級ユースケース |
| **型安全性** | ◎ 静的型付け + パターンマッチ |
| **JSON処理** | ◎ 組み込み型 + 自動導出 |
| **非同期の書きやすさ** | ◎ 暗黙await、構造化並行性 |
| **学習効果** | ◎ 新しい言語を深く学べる |
| **先駆者になれる** | ◎ MoonBitでLLMオーケストレーション書いてる人はまだ少ない |

### デメリット/リスク

| 観点 | 評価 |
|------|------|
| **成熟度** | △ Beta段階、APIが変わる可能性 |
| **SQLite等の永続化** | ? 標準ライブラリにない可能性（要調査） |
| **日本語ドキュメント** | △ ほぼ英語/中国語 |
| **デバッグ体験** | △ まだ発展途上の可能性 |
| **トラブル時の情報** | △ Stack Overflow等の蓄積が少ない |
| **Windows対応** | △ Native backendはLinux/macOSのみ |

### 私の見解

正直に言うと、**やってみる価値はある**。

理由：
1. MoonBit自体が「AIエージェント開発」を主要ターゲットにしている
2. 公式の`maria`フレームワークがまさにこの用途
3. 構造化並行性は「文体共和国」のようなマルチエージェントシステムに理想的
4. JSONの扱いがネイティブで、ソウルテキストの四層構造との相性が良い
5. 学習投資として、新しいパラダイムを身につけられる

ただし：
- SQLiteがない場合、アーカイブ機能は別途考える必要がある（JSON/ファイルベースでも可）
- Beta段階なので、壊れたら自分で直す覚悟が必要
- 最悪、TypeScript/Rustにいつでも移行できるように、アーキテクチャは言語非依存に設計しておく

---

## 次のステップ

MoonBitで行くなら：

1. **環境構築**: `moon`ツールチェーンのインストール
2. **`moonbitlang/async`の動作確認**: Cerebras APIを叩く最小限のコード
3. **SQLite相当の永続化手段の調査**: なければJSON/ファイルベースで代替
4. **SoulTextの最小実装**: 憲法 + 適合度計算

どう？MoonBitで挑戦してみる？それとも安全策でTypeScriptにしておく？





---
Powered by [Claude Exporter](https://www.ai-chat-exporter.net)
