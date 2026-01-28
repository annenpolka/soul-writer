///|
/// クライアント生成
pub fn LLMClient::new(config : LLMConfig) -> LLMClient {
  { config, }
}

///|
/// チャット補完を実行
pub async fn LLMClient::chat(
  self : LLMClient,
  messages : Array[Message],
  temperature : Double?,
  max_tokens : Int?
) -> ChatResponse raise LLMError {
  let request : ChatRequest = {
    model: self.config.model,
    messages,
    temperature: match temperature {
      Some(t) => Some(t)
      None => Some(self.config.default_temperature)
    },
    max_tokens: match max_tokens {
      Some(m) => Some(m)
      None => Some(self.config.default_max_tokens)
    },
  }

  let url = "\{self.config.base_url}/chat/completions"
  let headers : Map[String, String] = {
    "Authorization": "Bearer \{self.config.api_key}",
    "Content-Type": "application/json",
  }

  let (response, body) = try {
    @http.post(url, request.to_json(), headers~)
  } catch {
    e => raise LLMError::HttpError(0, "HTTP request failed: \{e}")
  }

  // HTTPステータスコードチェック
  guard response.code >= 200 && response.code < 300 else {
    raise LLMError::HttpError(response.code, response.reason)
  }

  // レスポンスパース
  let json_result = try {
    body.json()
  } catch {
    e => raise LLMError::ParseError("JSON parse error: \{e}")
  }
  let chat_response : ChatResponse = try {
    @json.from_json(json_result)
  } catch {
    e => raise LLMError::ParseError("Response decode error: \{e}")
  }
  chat_response
}

///|
/// 単純なテキスト補完（ヘルパー関数）
pub async fn LLMClient::complete(
  self : LLMClient,
  system_prompt : String,
  user_prompt : String
) -> String raise LLMError {
  let messages : Array[Message] = [
    { role: "system", content: system_prompt },
    { role: "user", content: user_prompt },
  ]
  let response = self.chat(messages, None, None)
  guard response.choices.length() > 0 else {
    raise LLMError::ApiError("No choices in response")
  }
  response.choices[0].message.content
}
