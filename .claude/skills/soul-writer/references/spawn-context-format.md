# スポーン時コンテキスト受け渡し仕様

各エージェントをスポーンする際、promptパラメータに含めるべきコンテキスト情報を定義する。
エージェントの .md ファイル（システムプロンプト）は静的指示のみ含み、
動的データは全てスポーン時のpromptで注入する。

## soul-writer スポーンコンテキスト

    ## あなたの執筆スタイル
    {personaDirective}（writer-personas.json から取得）

    ## 最重要ルール
    {criticalRules}（buildCriticalRules関数の出力相当）

    ## 禁止語彙
    {forbiddenWords}（constitution.json > universal > vocabulary > forbidden_words）

    ## 特殊記号ルール
    {specialMarksRules}（constitution.json > universal > vocabulary > special_marks）

    ## ルビ表記
    {bracketNotations}（constitution.json > universal > vocabulary > bracket_notations）

    ## キャラクター情報
    {characters}（enrichedCharacters or developedCharacters or worldBibleCharacters）

    ## キャラクター制約
    {characterConstraints}（prompt-config.yaml > character_constraints）

    ## 用語集
    {terminology}（world-bible.json > terminology）

    ## 反魂（書いてはいけないパターン）
    {antiSoulEntries}（anti-soul.json > categories、各カテゴリ最大3例）

    ## 参考断片
    {fragments}（fragments/*.json、フォーカスカテゴリは3件、他は1件）

    ## 回避モチーフ
    {motifAvoidanceList}（過去作品分析結果、ある場合のみ）

    ## 文体トーン
    {toneDirective}（themeContext.tone or prompt-config tone_catalog から選択）

    ## 章プロンプト
    {chapterPrompt}（プロットから構築した章生成指示）

## soul-judge スポーンコンテキスト

    ## テキストA
    {textA}（ドラフトファイルの内容）

    ## テキストB
    {textB}（ドラフトファイルの内容）

    ## 評価調整
    {evaluationAdjustments}（narrativeRulesに基づく調整）

    ## キャラクター声の参照
    {voiceEntries}（キャラクターの口調ルール）

    ## 反魂（コンパクト版）
    {antiSoulCompact}（各カテゴリ1例、100字以内）

    ## 参考断片（コンパクト版）
    {fragmentsCompact}（4カテゴリ、各1件）

## soul-plotter スポーンコンテキスト

    ## テーマ
    {theme}（theme.json or ユーザー指定テーマ）

    ## キャラクター
    {characters}（characters.json or world-bible.json characters）

    ## 技術体系
    {technology}（world-bible.json > technology）

    ## 社会設定
    {society}（world-bible.json > society）

    ## モチーフ回避リスト
    {motifAvoidanceList}

    ## 章数・長さ指定
    {chapterCount}, {targetLength}

## soul-synthesizer スポーンコンテキスト

    ## 優勝テキスト
    {championText}（final.json の winner に対応するドラフト）

    ## 全ドラフト
    {allDrafts}（4ドラフトの全文、ペルソナラベル付き）

    ## Judge分析結果
    {judgeAnalyses}（semifinal + final の全 JSON）

    ## 改善指示
    優勝テキストの長所を維持しつつ、他ドラフトの優れた要素を統合する。

## soul-defect-detector スポーンコンテキスト

    ## 検査対象テキスト
    {text}（synthesized.txt or corrected.txt）

    ## 憲法ルール
    {constitutionRules}（禁止語彙、禁止比喩、テーマ制約、禁止結末）

    ## キャラクター設定
    {characters}（名前、役割のみ）

    ## 反魂パターン
    {antiSoulPatterns}

    ## 章間コンテキスト（多章時）
    {crossChapterContext}（前章キャラ状態、摩耗モチーフ、前章概要）

## soul-corrector スポーンコンテキスト

    ## 修正対象テキスト
    {text}

    ## 違反リスト
    {violations}（compliance-check.sh の出力）

    ## 修正指針
    原文の意図とトーンを保持しつつ、指摘された違反のみを最小限に修正すること。

## soul-reader-evaluator スポーンコンテキスト

    ## あなたのペルソナ
    {personaName}（reader-personas.json から取得）

    ## ペルソナ説明
    {personaDescription}

    ## 好み
    {personaPreferences}

    ## 評価重み
    {evaluationWeights}（style, plot, character, worldbuilding, readability の重み）

    ## 評価対象テキスト
    {text}（final.txt の内容）

    ## 前回評価（リテイク時のみ）
    {previousEvaluation}（前回の categoryScores + feedback）

## soul-reader-jury スポーンコンテキスト

    ## 評価結果一覧
    {evaluations}（5つの PersonaEvaluation JSON）

    ## 集約スコア
    {aggregatedScore}（オーケストレーター算出済み）

    ## 合否判定
    {passed}（true/false、閾値0.85）

## soul-macguffin-developer スポーンコンテキスト

    ## テーマ
    {theme}（theme.json or ユーザー指定テーマ）

    ## キャラクター
    {characters}（characters.json or world-bible characters）

    ## 技術体系
    {technology}（world-bible.json > technology）

    ## 社会設定
    {society}（world-bible.json > society）

## soul-motif-analyzer スポーンコンテキスト

    ## 過去作品一覧
    {pastWorks}（各作品のタイトル + 先頭2000字の抜粋）

## soul-fragment-extractor スポーンコンテキスト

    ## 対象テキスト
    {text}（story.txt の全文）

    ## 品質判定
    {verdict}（publishable or exceptional）

    ## 断片カテゴリ一覧
    opening, killing, introspection, dialogue, character_voice, symbolism, world_building, action
