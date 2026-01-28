# MoonBit 技術スタック調査結果

## 概要

soul-writerをMoonBitで実装する場合の技術スタック対応状況を調査した。

## 結論: 全ての必要スタックに対応あり

| 要件 | 必要度 | MoonBit対応 | 状況 |
|-----|------|------------|------|
| **SQLite** | 必須 | `mizchi/sqlite` | 対応 |
| OpenAI互換API (HTTP) | 必須 | `moonbitlang/async/http` | 完全対応 |
| JSON処理 | 必須 | コアライブラリ `@json` | 完全対応 |
| CLI | 必須 | `ArgParser`, `clap` | 対応 |
| Web Server | 必須 | `moonbitlang/async/http` | 対応 |
| WebSocket | 必須 | `moonbitlang/async/websocket` | 対応（TLS含む） |
| ファイルシステム | 必須 | `moonbitlang/async/fs`, `moonbitlang/x/fs` | 対応 |

---

## 詳細

### SQLite - `mizchi/sqlite`

**パッケージ**: [mizchi/sqlite](https://github.com/mizchi/sqlite.mbt) ([mooncakes](https://mooncakes.io/docs/mizchi/sqlite))

**インストール**:
```bash
moon add mizchi/sqlite
```

**moon.pkg.json**:
```json
{
  "import": ["mizchi/sqlite"],
  "link": {
    "native": { "cc-link-flags": "-lsqlite3" }
  }
}
```

**プラットフォーム対応**:
| ターゲット | 対応 | 備考 |
|----------|-----|------|
| Native | Yes | libsqlite3が必要（macOSはプリインストール） |
| JavaScript | Yes | Node.js 22.5.0+ (`node:sqlite`モジュール使用) |
| WASM | No | 未対応 |

**主要API**:
```moonbit
// データベース操作
let db = @sqlite.Database::open(":memory:")
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")

// プリペアドステートメント
let stmt = db.prepare("INSERT INTO users (name) VALUES (?)")
stmt.bind_all([Text(string_to_bytes("Alice"))])
stmt.execute()
stmt.finalize()

// トランザクション
db.begin()
db.commit()  // or db.rollback()

// クエリとイテレーション
let query = db.query("SELECT * FROM users")
for row in query.iter() {
  let name = row.column_text(1)
}

db.close()
```

**機能**:
- データベースのopen/close
- SQL実行 (`exec`, `prepare`, `query`)
- 型安全なパラメータバインディング (`SqlValue`: Null, Int, Int64, Double, Text, Blob)
- トランザクション管理（セーブポイント含む）
- イテレータベースの結果処理

**制限事項**:
- JSターゲットではエラーコードが常に0
- JSターゲットでInt64は精度損失の可能性あり

---

### LLM API呼び出し - `moonbitlang/async`

`moonbitlang/async`でOpenAI互換APIを直接呼び出せる。公式ブログに[コードエージェント実装例](https://www.moonbitlang.com/blog/moonbit-async-code-agent)あり。

```moonbit
async fn generate(request : Request) -> Response {
  let (response, body) = @http.post(
    "\{base_url}/chat/completions",
    request.to_json(),
    headers={
      "Authorization": "Bearer \{api_key}",
      "Content-Type": "application/json",
    },
  )
  body.json() |> @json.from_json()
}
```

---

### JSON処理 - コアライブラリ

コアライブラリで`derive(FromJson, ToJson)`をサポート。型安全なシリアライズ/デシリアライズが可能。

```moonbit
struct PlotOutput {
  title : String
  chapters : Array[Chapter]
} derive(FromJson, ToJson)
```

---

### Web/ネットワーク - `moonbitlang/async`

- HTTP/HTTPS クライアント・サーバー
- WebSocket (wss://) 対応
- TLS対応 (OpenSSL経由)
- プロキシ対応

---

## 推奨構成

soul-writerをMoonBitで実装する場合の推奨パッケージ構成:

```json
{
  "import": [
    "mizchi/sqlite",
    "moonbitlang/async/http",
    "moonbitlang/async/websocket",
    "moonbitlang/async/fs",
    "moonbitlang/x/time",
    "TheWaWaR/clap"
  ]
}
```

**ターゲット**: Native（SQLiteのフル機能を活用するため）

## 参考リンク

- [MoonBit公式](https://www.moonbitlang.com/)
- [mooncakes.io（パッケージレジストリ）](https://mooncakes.io/)
- [awesome-moonbit](https://github.com/moonbitlang/awesome-moonbit)
- [moonbitlang/async](https://github.com/moonbitlang/async)
- [mizchi/sqlite](https://github.com/mizchi/sqlite.mbt) - SQLiteバインディング
- [コードエージェント実装例](https://www.moonbitlang.com/blog/moonbit-async-code-agent)
