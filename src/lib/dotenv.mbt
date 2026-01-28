///|
/// .envファイルを読み込んで環境変数に設定する
pub async fn load_dotenv(path : String) -> Unit {
  // ファイルが存在しない場合は何もしない
  let exists = try {
    @fs.exists(path)
  } catch {
    _ => false
  }
  guard exists else { return }

  // ファイルを読み込む
  let content = try {
    @fs.read_file(path).text()
  } catch {
    _ => return
  }

  // 行ごとに処理
  for line in content.split("\n") {
    let trimmed = line.trim()

    // 空行またはコメント行をスキップ
    if trimmed.is_empty() || trimmed.has_prefix("#") {
      continue
    }

    // KEY=VALUE形式をパース
    let line_str = trimmed.to_string()
    match line_str.find("=") {
      Some(idx) => {
        let key = line_str[0:idx].trim().to_string()
        let value = line_str[idx + 1:].trim().to_string()
        // クォートを除去
        let unquoted = remove_quotes(value)
        @sys.set_env_var(key, unquoted)
      }
      None => continue
    }
  }
}

///|
/// クォートを除去するヘルパー関数
fn remove_quotes(s : String) -> String {
  let len = s.length()
  if len >= 2 {
    let first = s[0]
    let last = s[len - 1]
    // ダブルクォートまたはシングルクォート
    if (first == 0x22 && last == 0x22) || (first == 0x27 && last == 0x27) {
      return try { s[1:len - 1].to_string() } catch { _ => s }
    }
  }
  s
}
