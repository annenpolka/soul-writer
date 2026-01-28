///|
/// チャットメッセージ
pub(all) struct Message {
  role : String
  content : String
} derive(Show, ToJson, @json.FromJson)

///|
/// チャット補完リクエスト
pub struct ChatRequest {
  model : String
  messages : Array[Message]
  temperature : Double?
  max_tokens : Int?
} derive(ToJson)

///|
/// 補完の選択肢
pub(all) struct Choice {
  index : Int
  message : Message
  finish_reason : String?
} derive(@json.FromJson)

///|
/// 使用量情報
struct Usage {
  prompt_tokens : Int
  completion_tokens : Int
  total_tokens : Int
} derive(@json.FromJson)

///|
/// チャット補完レスポンス
pub(all) struct ChatResponse {
  id : String
  object : String
  created : Int
  model : String
  choices : Array[Choice]
  usage : Usage?
} derive(@json.FromJson)

///|
/// APIエラー
pub suberror LLMError {
  ConfigMissing(String)
  HttpError(Int, String)
  ParseError(String)
  ApiError(String)
} derive(Show)

///|
/// LLM設定
pub(all) struct LLMConfig {
  api_key : String
  base_url : String
  model : String
  default_temperature : Double
  default_max_tokens : Int
}

///|
/// LLMクライアント
pub struct LLMClient {
  config : LLMConfig
}
