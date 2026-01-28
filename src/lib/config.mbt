///|
/// 環境変数から設定を読み込む
pub fn LLMConfig::from_env() -> LLMConfig raise LLMError {
  let env = @sys.get_env_vars()

  fn get_required(name : String) -> String raise LLMError {
    match env.get(name) {
      Some(value) => value
      None => raise LLMError::ConfigMissing(name)
    }
  }

  fn get_optional(name : String, default_val : String) -> String {
    match env.get(name) {
      Some(value) => value
      None => default_val
    }
  }

  {
    api_key: get_required("OPENAI_API_KEY"),
    base_url: get_optional("OPENAI_BASE_URL", "https://api.cerebras.ai/v1"),
    model: get_optional("OPENAI_MODEL", "llama-4-scout-17b-16e-instruct"),
    default_temperature: 0.7,
    default_max_tokens: 2048,
  }
}
