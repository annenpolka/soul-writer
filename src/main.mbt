///|
/// メインエントリポイント
async fn main {
  // .envファイルを読み込む
  @lib.load_dotenv(".env")

  println("=== soul-writer LLM Loop MVP ===")

  // 設定読み込み
  let config = try {
    @lib.LLMConfig::from_env()
  } catch {
    @lib.LLMError::ConfigMissing(name) => {
      println("Error: Missing environment variable: \{name}")
      println("Please set OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL")
      return
    }
    e => {
      println("Error: \{e}")
      return
    }
  }

  println("Using model: \{config.model}")
  println("Base URL: \{config.base_url}")

  let client = @lib.LLMClient::new(config)

  // 簡単なテスト呼び出し
  println("\n--- Test Call ---")
  let response = try {
    client.complete(
      "You are a helpful assistant.",
      "Say hello in Japanese in one sentence.",
    )
  } catch {
    e => {
      println("LLM call failed: \{e}")
      return
    }
  }

  println("Response: \{response}")

  // 対話ループのデモ
  println("\n--- Conversation Loop Demo ---")
  let history : Array[@lib.Message] = []
  let system_prompt = "You are a creative writing assistant specialized in Japanese fiction. Keep responses brief."

  let prompts = [
    "短編小説のアイデアを1つだけ提案してください（1文で）",
    "そのアイデアの主人公の名前を決めてください",
  ]

  for prompt in prompts {
    println("\n[User]: \{prompt}")
    history.push({ role: "user", content: prompt })

    let messages : Array[@lib.Message] = [{ role: "system", content: system_prompt }]
    for msg in history {
      messages.push(msg)
    }

    let reply = try {
      let resp = client.chat(messages, None, None)
      if resp.choices.length() > 0 {
        resp.choices[0].message.content
      } else {
        "(No response)"
      }
    } catch {
      e => {
        println("Error: \{e}")
        continue
      }
    }

    println("[Assistant]: \{reply}")
    history.push({ role: "assistant", content: reply })
  }

  println("\n=== Done ===")
}
