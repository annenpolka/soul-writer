# LLMプロバイダ層を汎用化する

このExecPlanはリビングドキュメントであり、Progress、Surprises & Discoveries、Decision Log、Outcomes & Retrospectiveを作業の進行に合わせて更新し続ける。

## Purpose / Big Picture

soul-writerのLLMプロバイダ層を、CerebrasとCodexの2択に閉じた実装から、プロバイダ追加・設定解決・機能差分の扱いを分離した汎用的な構造へ移行する。実装後は、既存のCerebras生成とCodex生成を壊さずに、新しいプロバイダを`src/llm/providers/`へ追加できる。ユーザーは`.env`またはCLIオプションでプロバイダを選び、`npm run build`、`npm test -- src/llm/provider-factory.test.ts src/llm/provider-config.test.ts`、および該当するCLIのdry-run相当テストで、選択したプロバイダ設定が正しく解決されることを確認できる。

この計画の中心成果は、プロバイダ固有の知識をCLIや生成パイプラインから追い出すこと、構造化出力を生成パイプラインの標準能力として扱うこと、tool callingを「使えるときだけ使う追加能力」として明示することである。これにより、今後OpenAI互換API、ローカルHTTPサーバー、別クラウドAPIを追加するとき、既存のWriter、Judge、Plotterなどのエージェントを大きく触らずに済む。

## Progress

- [x] (2026-04-29 06:23:36Z) 現状の`src/llm`、CLI入口、tool calling利用箇所、既存ExecPlanを確認した
- [x] (2026-04-29 06:23:36Z) `npm run build`を試し、依存未導入により`tsc: command not found`で止まることを確認した
- [x] (2026-04-29 06:23:36Z) プロバイダ汎用化の初期ExecPlanを作成した
- [x] (2026-04-29 06:29:57Z) `/tmp/soul-writer-npm-cache`を使って依存を導入し、最小修正後に`npm run build`が成功するベースラインを作った
- [x] (2026-04-29 06:43:48Z) プロバイダ契約、設定解決、レジストリを追加し、既存Cerebras/Codexを移植した
- [x] (2026-04-29 06:43:48Z) 単一固定ツールを構造化出力へ移行し、Codexでも早期にtool callingエラーへ落ちない状態にした
- [x] (2026-04-29 06:43:48Z) OpenAI互換HTTP providerを追加し、fetch mockの単体テストを追加した
- [x] (2026-04-29 06:43:48Z) CLI、README、`.env.example`、アーキテクチャ文書を新しいプロバイダ設定に合わせた
- [x] (2026-04-29 06:44:51Z) `npm run build`、`npm run lint`、`npm test`、上位層provider固有名検索を実行し、受け入れ基準を満たすことを確認した

## Surprises & Discoveries

- Observation: `npm run build`は現時点で`tsc: command not found`により実行できない。
  Evidence: ワークツリーに`node_modules/.bin`が存在せず、`package.json`の`build` scriptは`tsc`を呼ぶ。

- Observation: `src/cli/generate.ts`の`runSimpleMode`と`runFullMode`は引数型に`CerebrasClient`を使っているが、`createLLMClient`は`LLMClient`を返し、同ファイルは`CerebrasClient`をimportしていない。
  Evidence: `rg -n "CerebrasClient" src/cli/generate.ts`で、関数引数型としてのみ出現する。

- Observation: CLIヘルプには`--provider`がGlobal Optionsとして載っているが、`generate`、`factory`、`resume`は`process.env.LLM_PROVIDER || 'cerebras'`だけを読んでおり、CLIオプション値を受け取っていない。
  Evidence: `src/main.ts`は`--provider`を各コマンドのoptionsに渡さず、各CLI実装は環境変数から直接providerを解決している。

- Observation: `CodexClient`は`completeStructured`を実装しているが`completeWithTools`を実装していない。現在の一部パスは`assertToolCallingClient`でtool callingを必須にするため、Codex選択時に実行時エラーになり得る。
  Evidence: `src/llm/codex/codex-client.ts`に`completeWithTools`実装はなく、`src/pipeline/chapter-summary.ts`、`src/compliance/rules/chapter-variation.ts`、`src/compliance/rules/self-repetition.ts`、`src/learning/fragment-extractor.ts`は`assertToolCallingClient`を呼ぶ。

- Observation: 固定tool callingを`completeStructured`へ移行した後、該当テストは古いmockが`completeWithTools`だけを持っていたため失敗した。
  Evidence: `npm test -- tests/pipeline/chapter-summary.test.ts tests/compliance/chapter-variation.test.ts tests/compliance/self-repetition.test.ts tests/learning/fragment-extractor.fp.test.ts`で`completeStructured is not a function`が出た後、テストmockを構造化出力へ更新して24件が成功した。

## Decision Log

- Decision: 新しい計画ファイルは`plans/provider-architecture-refactor.md`に置く。
  Rationale: 既存の`docs/EXECPLAN-tool-use.md`は完了済みの個別移行計画であり、今回の設計修正は今後も更新する大規模作業なので、`plans/`配下のリビングドキュメントとして分離する。
  Date/Author: 2026-04-29 06:23:36Z / Initial planner

- Decision: プロバイダ追加の中心をswitch文ではなくレジストリにする。
  Rationale: `src/llm/provider-factory.ts`の`provider: 'cerebras' | 'codex'`とswitch文は、プロバイダ追加のたびに共通ファクトリと設定型を膨らませる。レジストリ方式にすると、プロバイダ固有の環境変数、初期化、デフォルトモデルを各プロバイダモジュールへ閉じ込められる。
  Date/Author: 2026-04-29 06:23:36Z / Initial planner

- Decision: アプリケーション側の標準能力として`completeStructured`を必須化し、`completeWithTools`は追加能力として扱う。
  Rationale: 現在の生成パイプラインは多くの場所で`completeStructured!`を使っており、構造化出力なしでは実質的に動かない。一方、現在のtool calling利用は多くが「単一の固定ツールでJSONを返させる」用途であり、プロバイダ互換性を狭めている。
  Date/Author: 2026-04-29 06:23:36Z / Initial planner

- Decision: 既存Cerebras/Codex互換を先に守り、その後にOpenAI互換HTTPプロバイダを実証用として追加する。
  Rationale: 既存利用者の生成フローを壊さないことが最優先だが、新アーキテクチャが本当に拡張可能であることは3つ目のプロバイダで証明するのが最も分かりやすい。
  Date/Author: 2026-04-29 06:23:36Z / Initial planner

- Decision: `chapter-summary`、`chapter-variation`、`self-repetition`、`fragment-extractor`はtool callingではなく`completeStructured`へ移行する。
  Rationale: これらはモデルに複数ツールから選ばせる用途ではなく、単一の決まったJSON形を返させる用途だった。構造化出力へ寄せることでCodex providerでも同じ処理を使える。
  Date/Author: 2026-04-29 06:43:48Z / Implementer

## Outcomes & Retrospective

初期計画では、現状確認から4つの主要な構造課題を特定した。プロバイダ選択がCLI入口に散らばっていること、プロバイダ名がunion型とswitch文に固定されていること、構造化出力とtool callingの能力境界が曖昧なこと、Codex選択時にtool calling必須箇所で落ち得ることが主な問題であった。

実装では、`LLMClient`にmetadata/capabilitiesを追加し、`completeStructured`を標準能力にした。`src/llm/config.ts`、`src/llm/providers/`、`createLLMClientFromResolvedConfig`を導入し、既存Cerebras/Codexに加えてOpenAI互換HTTP providerを登録できるようにした。`generate`、`factory`、`resume`は共通設定解決を使うようになり、`--provider`、`--model`、`--reasoning-effort`を実際に受け取れる。固定tool callingだった章要約、章間変奏、自己反復、断片抽出は`completeStructured`へ移行した。

検証では`npm run build`が成功し、`npm test`は152ファイル、1420件成功、1件skipで通過した。`npm run lint`は終了コード0で、既存の未使用importやテンプレートテストの`then`プロパティに関する警告のみを報告した。`rg -n "CEREBRAS_|CODEX_|CerebrasClient|CodexClient" src/cli src/pipeline src/agents src/factory src/collaboration src/synthesis src/retake`は一致なしだった。

## Context and Orientation

このリポジトリはTypeScript製の小説生成パイプラインである。ここでいうLLMプロバイダとは、Cerebras、Codex、OpenAI互換HTTP APIのように、テキスト生成を実行する外部またはローカルのサービスを指す。プロバイダ層とは、それらの差分を吸収し、Writer、Judge、Plotterなどの上位エージェントへ同じ`LLMClient`インターフェースを見せる層である。

現在の中心ファイルは`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/llm/types.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/llm/provider-factory.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/llm/cerebras.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/llm/codex/codex-client.ts`である。`types.ts`は`LLMClient`、`CompletionOptions`、tool calling関連型、さらにCerebras固有の`CerebrasConfig`まで持っている。`provider-factory.ts`は`LLMProvider = 'cerebras' | 'codex'`という固定union型とswitch文で具象クライアントを作る。`cerebras.ts`はCerebras SDKを使い、テキスト生成、構造化出力、tool callingを実装している。`codex-client.ts`はCodex OAuthトークンを使い、ChatGPT backendのCodex responsesエンドポイントへリクエストし、テキスト生成と構造化出力を実装している。

CLI入口は`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/cli/generate.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/cli/factory.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/cli/resume.ts`である。これらはそれぞれ`dotenv.config()`を呼び、`process.env.LLM_PROVIDER`、`CEREBRAS_API_KEY`、`CEREBRAS_MODEL`、`CODEX_MODEL`、`CODEX_REASONING_EFFORT`を直接読んで`createLLMClient`へ渡している。この重複があるため、プロバイダ追加時に入口を複数編集する必要がある。

構造化出力とは、LLMに自由文ではなく指定スキーマに沿ったJSONを返させ、Zodで検証する仕組みである。このコードベースでは`completeStructured`がそれにあたる。tool callingとは、LLMに関数呼び出しの名前と引数を返させる仕組みである。このコードベースでは`completeWithTools`がそれにあたる。現在はtool callingを単一固定ツールの構造化出力として使っている箇所があり、プロバイダ差分の原因になっている。

単一固定ツールを使っている主なファイルは`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/pipeline/chapter-summary.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/compliance/rules/chapter-variation.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/compliance/rules/self-repetition.ts`、`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer/src/learning/fragment-extractor.ts`である。これらはツール選択を必要としているのではなく、決まった形のJSONが欲しいだけなので、`completeStructured`へ移す候補である。

## Plan of Work

最初に依存を導入し、現行のビルドと関連テストのベースラインを取る。`node_modules`が存在しないため、実装者は`npm ci`を実行してから`npm run build`とLLM周辺テストを実行する。もし`src/cli/generate.ts`の`CerebrasClient`型注釈がビルドエラーとして出る場合、この計画の最初の小修正として`LLMClient`へ置き換える。

次に、LLMの共通契約を整理する。`src/llm/types.ts`からCerebras固有の`CerebrasConfig`を外し、共通型はプロバイダ非依存のものだけにする。`completeStructured`は`LLMClient`の必須メソッドにする。`completeWithTools`はオプションのまま残すが、`LLMCapabilities`と`LLMClientMetadata`を追加し、クライアント自身が`providerId`、`model`、`capabilities`を公開するようにする。既存のモックとテストもこの契約に合わせて更新する。

その後、設定解決を一箇所へ集約する。新しく`src/llm/config.ts`を作り、環境変数とCLIオーバーライドから`ResolvedLLMConfig`を作る。`generate`、`factory`、`resume`はプロバイダ名やモデル名を直接読まず、共通の`resolveLLMConfig`を呼ぶ。`src/main.ts`は`--provider`、`--model`、`--reasoning-effort`のような共通オプションを各コマンドへ渡す。既存の`LLM_PROVIDER`、`CEREBRAS_API_KEY`、`CEREBRAS_MODEL`、`CODEX_MODEL`、`CODEX_REASONING_EFFORT`は後方互換として残す。

次に、プロバイダレジストリを導入する。`src/llm/providers/types.ts`に`LLMProviderDefinition`と`LLMProviderRegistry`を定義し、`src/llm/providers/cerebras.ts`と`src/llm/providers/codex.ts`へ既存の生成ロジックを移す。`src/llm/provider-factory.ts`は後方互換の薄い入口として残し、内部ではデフォルトレジストリを使う。これにより、上位コードは`createLLMClient`を呼ぶだけでよく、プロバイダ追加時は`src/llm/providers/index.ts`に登録するだけになる。

次に、tool callingに依存している単一固定ツール箇所を`completeStructured`へ移す。`chapter-summary.ts`、`chapter-variation.ts`、`self-repetition.ts`、`fragment-extractor.ts`にZodスキーマを追加または近接配置し、現在の`ToolDefinition`と`parseToolArguments`を置き換える。これにより、Codexのように構造化出力は持つがtool callingを持たないプロバイダでも、フル生成や学習処理が早期に失敗しにくくなる。tool callingが本当に必要な将来機能には、`assertToolCallingClient`ではなく`requireLLMCapability(client, 'toolCalling')`のような明示的な能力チェックを使う。

最後に、拡張性を実証するためにOpenAI互換HTTPプロバイダを追加する。これは`fetch`で`/chat/completions`に投げる薄い実装にし、環境変数は`OPENAI_COMPAT_API_KEY`、`OPENAI_COMPAT_BASE_URL`、`OPENAI_COMPAT_MODEL`を使う。少なくともテキスト生成と構造化出力を単体テストで確認する。tool callingは対応APIでだけ有効にし、未対応ならcapabilitiesでfalseにする。

ドキュメント更新では、`README.md`、`.env.example`、`docs/ARCHITECTURE.md`を新しい用語に合わせる。READMEの技術スタックは「Cerebras Cloud SDK」固定ではなく「プロバイダレジストリ経由のLLM adapter」と説明する。CLIヘルプには、環境変数とCLIオーバーライドの優先順位を明記する。

## Concrete Steps

作業ディレクトリは`/Users/annenpolka/ghq/github.com/annenpolka/soul-writer`とする。

最初に依存を導入する。`node_modules`がない場合だけ実行すればよい。

    npm ci

期待される状態は`node_modules/.bin/tsc`と`node_modules/.bin/vitest`が作られることである。ネットワークや権限で失敗した場合は、失敗内容をArtifacts and Notesに記録し、環境を整えてから同じコマンドを再実行する。

次に現行のベースラインを取る。

    npm run build
    npm test -- src/llm/provider-factory.test.ts src/llm/codex/codex-client.test.ts src/llm/cerebras.test.ts src/llm/types.test.ts

期待される状態はビルド成功と対象テスト成功である。もし`CerebrasClient`型注釈で失敗する場合は、`src/cli/generate.ts`の該当引数型を`LLMClient`へ変更し、同じコマンドを再実行する。

共通契約のテストを先に追加する。新しい`src/llm/provider-capabilities.test.ts`または既存`src/llm/types.test.ts`に、`LLMClient`がmetadataと必須`completeStructured`を持つこと、tool callingがcapabilitiesで表現されることを確認するテストを書く。変更前は型または実行時期待が合わず失敗し、変更後に成功する。

設定解決のテストを追加する。`src/llm/provider-config.test.ts`を作り、少なくとも次を確認する。環境変数だけでCerebras設定が解決できること、CLIオーバーライドが環境変数より優先されること、Codexのreasoning effortが不正値なら既存同様`medium`相当に正規化されること、未知のproviderでは利用可能なprovider一覧を含むエラーが出ること。

レジストリのテストを追加する。`src/llm/provider-registry.test.ts`を作り、登録済みproviderを名前で取得できること、同じ名前の二重登録を拒否すること、未登録providerのエラーが分かりやすいことを確認する。

実装では、まず`src/llm/types.ts`をプロバイダ非依存に整理し、必要に応じてCerebras固有型を`src/llm/providers/cerebras.ts`または`src/llm/cerebras.ts`の近くへ移す。続いて`src/llm/providers/types.ts`、`src/llm/providers/index.ts`、`src/llm/config.ts`を追加する。`src/llm/provider-factory.ts`は既存exportを保ったまま、新しい設定解決とレジストリへ委譲する。

既存プロバイダを移植したら、CLI入口を更新する。`src/main.ts`のparse結果から`provider`、`model`、`reasoning-effort`を`generate`、`factory`、`resume`へ渡し、各CLI実装では`process.env`を直接読まず共通設定関数を呼ぶ。`dotenv.config()`の呼び出しは入口ごとに残してもよいが、LLM設定の組み立ては重複させない。

単一固定ツール移行では、対象ファイルごとに小さく進める。例えば`src/pipeline/chapter-summary.ts`では`PreviousChapterAnalysisSchema`と`EstablishedInsightsSchema`をZodで定義し、`completeWithTools`呼び出しを`completeStructured`に変える。テストは`tests/pipeline/chapter-summary.test.ts`を、mockは`tests/helpers/mock-deps.ts`を更新する。各ファイルの移行後に関連テストを実行する。

    npm test -- tests/pipeline/chapter-summary.test.ts
    npm test -- tests/compliance/chapter-variation.test.ts tests/compliance/self-repetition.test.ts
    npm test -- tests/learning/fragment-extractor.fp.test.ts

最後にOpenAI互換HTTPプロバイダを追加し、fetchをmockした単体テストを書く。実API呼び出しは必須にしない。テストでは`OPENAI_COMPAT_BASE_URL=https://example.test/v1`相当の設定を解決し、`/chat/completions`へ期待するbodyが送られること、構造化出力のJSONがZodで検証されることを確認する。

全体検証として以下を実行する。

    npm run build
    npm run lint
    npm test
    rg -n "CEREBRAS_|CODEX_|CerebrasClient|CodexClient" src/cli src/pipeline src/agents src/factory src/collaboration src/synthesis src/retake

最後の`rg`は、CLIや上位パイプラインにプロバイダ固有の名前が残っていないことを確認するためのものである。`src/cli/auth.ts`のCodex認証コマンドは例外としてよいが、`generate`、`factory`、`resume`の生成入口には残さない。

## Validation and Acceptance

実装は、既存CerebrasとCodexの選択が後方互換で動き、新しいOpenAI互換HTTPプロバイダをレジストリに追加できることで成功とする。`npm run build`が成功し、`npm run lint`が成功し、`npm test`が成功することを必須条件にする。

設定解決の受け入れ基準は、`LLM_PROVIDER=cerebras`と`CEREBRAS_API_KEY`と`CEREBRAS_MODEL`だけでCerebrasクライアント設定が作れること、`LLM_PROVIDER=codex`と`CODEX_MODEL`でCodexクライアント設定が作れること、CLIの`--provider`と`--model`が環境変数より優先されること、未知のproviderを指定したときに登録済みprovider名を含むエラーが出ることである。

能力チェックの受け入れ基準は、Codexクライアントが`structuredOutput: true`かつ`toolCalling: false`として表現されること、Cerebrasクライアントが`structuredOutput: true`かつ`toolCalling: true`として表現されること、tool callingが必要な機能では実行前または該当呼び出し時に明確なエラーが出ることである。単一固定ツールから`completeStructured`へ移行した対象は、Codexのようなtool callingなしのクライアントmockでもテストが通ることを確認する。

拡張性の受け入れ基準は、`src/llm/providers/openai-compatible.ts`を追加して`src/llm/providers/index.ts`に登録するだけで、`createLLMClient`から新providerを作れることである。この確認は実APIではなくfetch mockの単体テストでよい。

CLIの受け入れ基準は、`src/main.ts`のヘルプと実装が一致していることである。`--provider`をヘルプに出すなら、`generate`、`factory`、`resume`で実際に解釈される必要がある。環境変数だけを使う場合も、優先順位をREADMEに明記する。

## Idempotence and Recovery

この作業はコード、テスト、ドキュメントの変更であり、データベースマイグレーションや既存生成物の破壊は不要である。`npm ci`は`package-lock.json`に従って`node_modules`を再作成するため、依存状態が壊れた場合は再実行できる。テストが失敗した場合は、まず失敗対象のprovider設定テスト、次に該当プロバイダのadapterテスト、最後にCLI入口テストの順に切り分ける。

大きな移行なので、各段階は既存テストが通る単位で進める。プロバイダレジストリ導入中も既存の`createLLMClient` exportは消さず、互換ラッパーとして残す。単一固定ツールの移行もファイル単位で行い、途中で止める場合はProgressに「どのファイルが移行済みで、どのファイルが未移行か」を明記する。

OpenAI互換HTTPプロバイダで実API検証を行う場合は、APIキーをログに出さない。fetch mockの単体テストを標準検証とし、実API検証は任意の手動確認に留める。

## Artifacts and Notes

初期調査時点のビルド確認は以下で止まった。

    npm run build
    > soul-writer@1.0.0 build
    > tsc
    sh: tsc: command not found

依存状態の確認では、`node_modules/.bin`が存在しなかった。

    ls node_modules/.bin
    ls: node_modules/.bin: No such file or directory

現状のprovider switchは`src/llm/provider-factory.ts`にあり、概略は次の通りである。

    export type LLMProvider = 'cerebras' | 'codex';
    export async function createLLMClient(config: ProviderConfig): Promise<LLMClient> {
      switch (config.provider) {
        case 'cerebras':
          return new CerebrasClient(...);
        case 'codex':
          return new CodexClient(...);
      }
    }

tool calling必須箇所は、初期調査時点では次の4系統が主要対象である。

    src/pipeline/chapter-summary.ts
    src/compliance/rules/chapter-variation.ts
    src/compliance/rules/self-repetition.ts
    src/learning/fragment-extractor.ts

完了時の検証結果は以下である。

    npm run build
    > soul-writer@1.0.0 build
    > tsc

    npm test
    Test Files  152 passed (152)
    Tests  1420 passed | 1 skipped (1421)

    npm run lint
    Found 39 warnings and 0 errors.

    rg -n "CEREBRAS_|CODEX_|CerebrasClient|CodexClient" src/cli src/pipeline src/agents src/factory src/collaboration src/synthesis src/retake
    # no matches

## Interfaces and Dependencies

最終的に`src/llm/types.ts`には、プロバイダ非依存の共通型だけを置く。`LLMClient`は少なくとも次の形を持つ。

    export interface LLMCapabilities {
      text: true;
      structuredOutput: boolean;
      toolCalling: boolean;
      reasoning: boolean;
    }

    export interface LLMClientMetadata {
      providerId: string;
      providerName: string;
      model: string;
      capabilities: LLMCapabilities;
    }

    export interface LLMClient {
      readonly metadata: LLMClientMetadata;
      complete(systemPrompt: string, userPrompt: string, options?: CompletionOptions): Promise<string>;
      complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>;
      completeStructured<T>(messages: LLMMessage[], schema: ZodType<T>, options?: CompletionOptions): Promise<StructuredResponse<T>>;
      completeWithTools?(systemPrompt: string, userPrompt: string, tools: ToolDefinition[], options?: ToolCallOptions): Promise<ToolCallResponse>;
      getTotalTokens(): number;
    }

`src/llm/providers/types.ts`には、登録可能なプロバイダ定義を置く。細部は実装時に調整してよいが、少なくともprovider id、表示名、環境変数からの設定解決、クライアント作成を分ける。

    export interface LLMProviderDefinition {
      id: string;
      displayName: string;
      defaultModel: string;
      resolveConfig(input: ProviderConfigInput): ResolvedProviderConfig;
      createClient(config: ResolvedProviderConfig): Promise<LLMClient>;
    }

    export interface LLMProviderRegistry {
      register(definition: LLMProviderDefinition): void;
      get(id: string): LLMProviderDefinition;
      list(): LLMProviderDefinition[];
    }

`src/llm/config.ts`には、環境変数とCLIオーバーライドを受け取る関数を置く。CLI実装はこの関数を使い、`process.env.CEREBRAS_*`や`process.env.CODEX_*`を直接読まない。

    export interface LLMConfigOverrides {
      provider?: string;
      model?: string;
      reasoningEffort?: string;
    }

    export function resolveLLMConfig(env: NodeJS.ProcessEnv, overrides?: LLMConfigOverrides): ResolvedProviderConfig;

既存の`src/llm/cerebras.ts`と`src/llm/codex/codex-client.ts`は、具象クライアントとして残してよい。ただし、プロバイダ固有の設定型とデフォルト値は各provider定義側へ寄せる。Cerebras SDK、Zod、既存Codex OAuth/token storeは引き続き使う。OpenAI互換HTTPプロバイダを追加する場合は、追加依存なしで`globalThis.fetch`を使い、テストではfetchをmockする。

`src/llm/tooling.ts`は能力チェックのヘルパーに拡張する。既存の`assertToolCallingClient`を残す場合も、内部のエラー文はmetadataを使って、どのprovider/modelがどの能力を欠いているのか分かるようにする。新しいヘルパー名は`requireLLMCapability`または`assertLLMCapability`とし、呼び出し側が`toolCalling`や`structuredOutput`を明示できるようにする。
