# ソウルテキスト フォーマット仕様

## 1. 概要

ソウルテキストは、原典の「魂」を四層構造で定義するJSONベースのフォーマットである。

### 1.1 ファイル構成

```
soul/
├── constitution.json       # 第一層：憲法
├── fragments/              # 第二層：聖典断片
│   ├── opening.json
│   ├── killing.json
│   ├── introspection.json
│   ├── dialogue.json
│   ├── world_building.json
│   └── character_voice.json
├── world-bible.json        # 第三層：世界聖書
├── anti-soul.json          # 第四層：反魂
└── reader-personas.json    # 読者ペルソナ
```

---

## 2. 第一層：憲法（Constitution）

### 2.1 スキーマ

```json
{
  "$schema": "constitution.schema.json",
  "meta": {
    "soul_id": "string",
    "soul_name": "string",
    "version": "string",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  },
  "sentence_structure": {
    "rhythm_pattern": "string",
    "taigendome": {
      "usage": "string",
      "frequency": "string",
      "forbidden_context": ["string"]
    },
    "typical_lengths": {
      "short": "string",
      "long": "string",
      "forbidden": "string"
    }
  },
  "vocabulary": {
    "bracket_notations": [
      {
        "kanji": "string",
        "ruby": "string",
        "required": "boolean"
      }
    ],
    "forbidden_words": ["string"],
    "characteristic_expressions": ["string"],
    "special_marks": {
      "mark": "string",
      "usage": "string",
      "forms": ["string"]
    }
  },
  "rhetoric": {
    "simile_base": "string",
    "metaphor_density": "low | medium | high",
    "forbidden_similes": ["string"],
    "personification_allowed_for": ["string"]
  },
  "narrative": {
    "default_pov": "string",
    "pov_by_character": {
      "character_name": "pov_description"
    },
    "default_tense": "string",
    "tense_shift_allowed": "string",
    "dialogue_ratio": "string",
    "dialogue_style_by_character": {
      "character_name": "style_description"
    }
  },
  "thematic_constraints": {
    "must_preserve": ["string"],
    "forbidden_resolutions": ["string"]
  }
}
```

### 2.2 具体例：「わたしのライオン」

```json
{
  "meta": {
    "soul_id": "my-lion",
    "soul_name": "わたしのライオン",
    "version": "1.0.0",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "sentence_structure": {
    "rhythm_pattern": "短-短-長(内省)-短(断定)",
    "taigendome": {
      "usage": "場面転換・視点固定・余韻を残す場面",
      "frequency": "1段落に0-2回",
      "forbidden_context": ["対話の途中", "感情の頂点"]
    },
    "typical_lengths": {
      "short": "〜20字",
      "long": "40〜80字",
      "forbidden": "100字超の一文"
    }
  },
  "vocabulary": {
    "bracket_notations": [
      { "kanji": "推奨事項", "ruby": "レコメンド", "required": true },
      { "kanji": "属性", "ruby": "アトリビュート", "required": true },
      { "kanji": "情報確認", "ruby": "セルフチェック", "required": true },
      { "kanji": "現実", "ruby": "ここ", "required": false },
      { "kanji": "本能", "ruby": "ほんのう", "required": false },
      { "kanji": "実感", "ruby": "さっかく", "required": false }
    ],
    "forbidden_words": [
      "とても", "非常に", "すごく",
      "〜なのだった", "〜のであった",
      "彼女は思った"
    ],
    "characteristic_expressions": [
      "×す", "×した", "×される",
      "推奨事項（レコメンド）",
      "セッション"
    ],
    "special_marks": {
      "mark": "×",
      "usage": "殺害行為にのみ使用。言語化の拒否と強調を同時に行う",
      "forms": ["×す", "×した", "×される", "×したい", "人×し"]
    }
  },
  "rhetoric": {
    "simile_base": "身体感覚（皮膚、温度、重さ、痛み）",
    "metaphor_density": "low",
    "forbidden_similes": [
      "花のような", "星のように", "天使の〜",
      "〜のように美しい"
    ],
    "personification_allowed_for": ["技術", "システム", "推奨事項"]
  },
  "narrative": {
    "default_pov": "一人称（御鐘透心）",
    "pov_by_character": {
      "御鐘透心": "一人称。内省的、短い文、防御的",
      "愛原つるぎ": "三人称または透心からの観察。断定的、観察者的"
    },
    "default_tense": "過去形",
    "tense_shift_allowed": "内省が深まると現在形への滑り込み許可",
    "dialogue_ratio": "低（地の文7：対話3以下）",
    "dialogue_style_by_character": {
      "御鐘透心": "短い、防御的、皮肉",
      "愛原つるぎ": "饒舌、挑発的、古い言葉を使う、SF作品の引用"
    }
  },
  "thematic_constraints": {
    "must_preserve": [
      "無関心社会への批評的視線",
      "殺意と親密さの境界の曖昧さ",
      "デジタル/アナログ、生成/真実の対比",
      "「正常」の相対化"
    ],
    "forbidden_resolutions": [
      "透心が社会に適応する",
      "つるぎが「実は良い人」になる",
      "愛によって救われる",
      "社会システムが改善される"
    ]
  }
}
```

---

## 3. 第二層：聖典断片（Scripture Fragments）

### 3.1 スキーマ

```json
{
  "$schema": "fragments.schema.json",
  "category": "string",
  "fragments": [
    {
      "id": "string",
      "text": "string",
      "source": "string (optional)",
      "tags": ["string"],
      "added_at": "ISO8601"
    }
  ]
}
```

### 3.2 カテゴリ一覧

| カテゴリ | 用途 |
|---------|------|
| `opening` | 冒頭/場面導入 |
| `killing` | 殺害描写 |
| `introspection` | 内省/独白 |
| `dialogue` | 対話シーン |
| `world_building` | 世界観の織り込み |
| `character_voice` | キャラクター固有の語り口 |

### 3.3 具体例：「わたしのライオン」

#### opening.json

```json
{
  "category": "opening",
  "fragments": [
    {
      "id": "opening-001",
      "text": "「すう、はあ、すうっ、…ふう」\n息を整え、最後の一人の元へ向かう階段を登った。\n自然、屋上を途中のルートに含むこともないから、こうやって最後にのんびりと足を運ぶ。",
      "source": "soultext.md:44-46",
      "tags": ["セッション", "導入", "呼吸"],
      "added_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "opening-002",
      "text": "学校、昼休み。\n通知ウィンドウが目の前を点滅する。なにかと思えばやはり提出管理で、クラスメイト3人に催促しろ、ということだった。",
      "source": "soultext.md:76-78",
      "tags": ["学校", "日常", "通知"],
      "added_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### killing.json

```json
{
  "category": "killing",
  "fragments": [
    {
      "id": "killing-001",
      "text": "頸動脈目掛けて、全力で刃を振り抜いた。\nだんっ。これで最後。\n深々と刺さったのか、人肌の熱が触れている。手応えに集中したくて、目を瞑る。\n手首を生ぬるい液体が伝う速度はじれったくて、自分の傷口が開いたかのように錯覚する。",
      "source": "soultext.md:58-61",
      "tags": ["セッション", "殺害", "感覚描写"],
      "added_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### introspection.json

```json
{
  "category": "introspection",
  "fragments": [
    {
      "id": "introspection-001",
      "text": "両親がいなくなっても、生活に不自由はなかった。それが気持ち悪かった。私の魂（ほんのう）は確かに危機を感じ取っていたから。\n生きることがこれほどに簡単なら、二人の死に何も意味がなかったみたいだ。\n素晴らしい人達だった。皆と同じように。…馬鹿げてる。",
      "source": "soultext.md:140-142",
      "tags": ["両親", "空洞", "存在意義"],
      "added_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "introspection-002",
      "text": "機械があらゆる問いと福祉の窓口となり、一人で安全に生きることが難しくなくなった世界で、人が他者に向けるのは無関心だった。何も求めないから衝突しない。\nその消極的寛容が、平和への最短経路でもあった。",
      "source": "soultext.md:85-86",
      "tags": ["社会批評", "無関心", "世界観"],
      "added_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### dialogue.json

```json
{
  "category": "dialogue",
  "fragments": [
    {
      "id": "dialogue-001",
      "text": "「こーろーさーなーいーのー、って言ってるの。あ、トウコちゃんって呼んでいい？」\nその唐突さはしかし確信の表れだった。\n古い映画で見た、イタズラを仕掛ける子供のような毒気のなさに、意図を見つけられない。\n「×すって、何を、意味がわからない」\n自分が平静を装うことに失敗しているのを自覚する。",
      "source": "soultext.md:117-121",
      "tags": ["透心", "つるぎ", "出会い"],
      "added_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "dialogue-002",
      "text": "「人類すべてを人×しにできたら、きっと人×しに優しい世の中になるよ。情状酌量の余地があるからさ」\n「話が飛躍してる。全人類にボタンを押させようって？」\n「まあ、そのための仕込みの一つや二つはね。折角ここにいるんだから」",
      "source": "soultext.md:293-295",
      "tags": ["つるぎ", "計画", "安楽死"],
      "added_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### character_voice.json

```json
{
  "category": "character_voice",
  "fragments": [
    {
      "id": "voice-tsurugi-001",
      "text": "「青い薬もWatchMeも二分間憎悪も、人類には必要なかった。だからこそわたしは、力尽くで世界《リアル》をひっくり返したい」",
      "source": "soultext.md:283",
      "tags": ["つるぎ", "SF引用", "計画"],
      "added_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "voice-tsurugi-002",
      "text": "「あ、誤解しないでほしいんだけど、わたし、別にSFオタクとかじゃないから期待しないでね」\nオタクなんて死語を使う辺りが偏執的だとは思わないのか、とは言わない。",
      "source": "soultext.md:285-286",
      "tags": ["つるぎ", "メタ", "死語"],
      "added_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## 4. 第三層：世界聖書（World Bible）

### 4.1 スキーマ

```json
{
  "$schema": "world-bible.schema.json",
  "technology": {
    "tech_name": {
      "description": "string",
      "functions": ["string"],
      "details": { ... }
    }
  },
  "society": {
    "aspect_name": {
      "state": "string",
      "implications": ["string"]
    }
  },
  "characters": {
    "character_name": {
      "role": "string",
      "background": "string",
      "core": "string",
      "traits": ["string"],
      "voice": "string",
      "relationships": { ... }
    }
  },
  "terminology": {
    "term": "definition"
  },
  "locations": {
    "location_name": {
      "description": "string",
      "significance": "string"
    }
  }
}
```

### 4.2 具体例：「わたしのライオン」

```json
{
  "technology": {
    "ar_contact": {
      "description": "ARコンタクトレンズ。常時装着が標準",
      "functions": ["タグ表示", "通知", "位置情報", "虹彩認証"],
      "operation": "こめかみを叩く、指のジェスチャー"
    },
    "mr_floor": {
      "description": "生成的MR空間。倫理制限付きが標準",
      "touko_version": "叔父所有、倫理制限解除済み",
      "alias": "草原、アフリカ",
      "session": "クラスメイトを×すゲーム形式"
    },
    "tag_system": {
      "description": "個人に付与された属性の表示",
      "school_system": "学内イントラネット用、自動切り替え",
      "general_system": "一般社会用",
      "display_content": ["名前", "役職", "属性"]
    },
    "recommendation": {
      "japanese": "推奨事項",
      "ruby": "レコメンド",
      "function": "行動誘導、警告、介入",
      "example": "授業に集中してください。あなたの不安は根拠がありません"
    }
  },
  "society": {
    "interpersonal": {
      "state": "消極的寛容、相互無関心",
      "implications": [
        "名前を覚えられない世代",
        "衝突しない平和",
        "ARコンタクトによる個人名表示がバリアフリー"
      ]
    },
    "reproduction": {
      "state": "計画出産が法制化済み",
      "implications": [
        "少子化対策として導入",
        "養親が半無作為的に選定される",
        "自由恋愛は「今どきの発想じゃない」"
      ]
    },
    "death": {
      "state": "安楽死センターが存在するが閑古鳥",
      "implications": [
        "死すら選ばれない無気力",
        "生きることが難しくなくなった結果"
      ]
    },
    "education": {
      "state": "感情テストで学級委員選出",
      "implications": [
        "多感な生徒が「正解」として選ばれる",
        "大人達の時代錯誤的な介入",
        "実際は形骸化"
      ]
    }
  },
  "characters": {
    "御鐘透心": {
      "reading": "みかね とうこ",
      "role": "学級委員長、主人公",
      "background": "両親を早くに亡くし、叔父の家で暮らす",
      "core": "空洞、存在確認としての殺意",
      "traits": [
        "クラスメイト全員の名前を覚えている（異常）",
        "MRセッションで殺害を反復",
        "殺意は憎悪というより存在確認の触診"
      ],
      "voice": "短い文、防御的、内省的、皮肉",
      "relationships": {
        "叔父": "技術者、MRフロアの持ち主、行為を黙認",
        "つるぎ": "共犯者、唯一の観察者"
      }
    },
    "愛原つるぎ": {
      "reading": "あいはら つるぎ",
      "role": "ハッカー、二重スパイ（自称）",
      "background": "組織のハッカー、天涯孤独",
      "core": "視線ジャンキー、人間の皮を着たグリッチ",
      "traits": [
        "ソーシャルエンジニアリングのために高校へ",
        "MRセッションでデータが変化しない",
        "常に選択権を透心に渡す",
        "SF作品の引用を多用"
      ],
      "voice": "饒舌、挑発的、古い言葉を使う",
      "relationships": {
        "透心": "共犯者、「本物の血肉」として執着"
      }
    },
    "叔父": {
      "role": "技術者、MRフロア所有者",
      "background": "透心の保護者、普段は家にいない",
      "stance": "透心の行為を勘づいているが黙認"
    }
  },
  "terminology": {
    "×す": "殺す。透心の内心では伏字化",
    "セッション": "MRフロアでのゲーム",
    "草原": "叔父がMRフロアを呼ぶ名称",
    "アフリカ": "セッションの舞台名",
    "タグ": "属性表示",
    "推奨事項（レコメンド）": "システムからの行動誘導",
    "情報確認（セルフチェック）": "自己状態の電子的確認",
    "属性（アトリビュート）タグ": "個人の役職等を示すタグ"
  },
  "locations": {
    "mr_floor": {
      "description": "叔父所有の倫理制限解除済みMR空間",
      "alias": "草原",
      "significance": "透心が殺意を発散する場所"
    },
    "rooftop_landing": {
      "description": "屋上前の踊り場",
      "significance": "つるぎが常にいる場所、二人の出会いの場"
    }
  }
}
```

---

## 5. 第四層：反魂（Anti-Soul）

### 5.1 スキーマ

```json
{
  "$schema": "anti-soul.schema.json",
  "categories": {
    "category_name": [
      {
        "id": "string",
        "text": "string",
        "reason": "string",
        "source": "manual | auto",
        "added_at": "ISO8601"
      }
    ]
  }
}
```

### 5.2 カテゴリ一覧

| カテゴリ | 説明 |
|---------|------|
| `excessive_sentiment` | 過剰な感傷 |
| `explanatory_worldbuilding` | 説明的すぎる世界観提示 |
| `character_normalization` | キャラクターの「普通化」 |
| `cliche_simile` | 陳腐な比喩 |
| `theme_violation` | テーマの破壊 |

### 5.3 具体例：「わたしのライオン」

```json
{
  "categories": {
    "excessive_sentiment": [
      {
        "id": "anti-sentiment-001",
        "text": "透心は深い悲しみに包まれていた。両親を失った痛みは、今も彼女の心を締め付けている。涙が頬を伝い、彼女は静かに泣いた。",
        "reason": "感情を直接的に説明しすぎ。透心は感情を言語化しない。涙を流す描写も文体に合わない。",
        "source": "manual",
        "added_at": "2024-01-01T00:00:00Z"
      }
    ],
    "explanatory_worldbuilding": [
      {
        "id": "anti-world-001",
        "text": "この世界では、ARコンタクトという技術が普及していた。それは目に装着するレンズ型のデバイスで、様々な情報を表示することができる。人々はこれを使って、互いの名前や属性を確認していた。",
        "reason": "設定説明が前面に出ている。世界観は行動や思考を通じて自然に織り込むべき。",
        "source": "manual",
        "added_at": "2024-01-01T00:00:00Z"
      }
    ],
    "character_normalization": [
      {
        "id": "anti-char-001",
        "text": "「ねえ、透心ちゃん、お昼一緒に食べない？」つるぎは明るく笑った。「今日のお弁当、ちょっと作りすぎちゃって」",
        "reason": "つるぎが「普通の女子高生」になっている。彼女は常に挑発的で、古い言葉を使い、一般的な友人関係を求めない。",
        "source": "manual",
        "added_at": "2024-01-01T00:00:00Z"
      },
      {
        "id": "anti-char-002",
        "text": "もしかしたら、この世界にも信じられる人がいるのかもしれない。透心は初めて、誰かと繋がれる希望を感じた。",
        "reason": "透心が他者に心を開く描写。テーマ（forbidden_resolutions）に違反。",
        "source": "manual",
        "added_at": "2024-01-01T00:00:00Z"
      }
    ],
    "cliche_simile": [
      {
        "id": "anti-simile-001",
        "text": "つるぎの笑顔は花のように美しかった。その瞳は星のように輝いていた。",
        "reason": "身体感覚に根ざさない陳腐な比喩。rhetoric.forbidden_similesに該当。",
        "source": "manual",
        "added_at": "2024-01-01T00:00:00Z"
      }
    ],
    "theme_violation": [
      {
        "id": "anti-theme-001",
        "text": "「私、変わりたいの」透心は決意を込めて言った。「みんなと仲良くなりたい。普通の高校生活を送りたい」",
        "reason": "透心が社会に適応しようとしている。forbidden_resolutionsに違反。",
        "source": "manual",
        "added_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

## 6. 読者ペルソナ

### 6.1 スキーマ

```json
{
  "$schema": "reader-personas.schema.json",
  "personas": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "preferences": ["string"],
      "evaluation_weights": {
        "style": 0.0-1.0,
        "plot": 0.0-1.0,
        "character": 0.0-1.0,
        "worldbuilding": 0.0-1.0,
        "readability": 0.0-1.0
      }
    }
  ]
}
```

### 6.2 具体例：「わたしのライオン」

```json
{
  "personas": [
    {
      "id": "sf-enthusiast",
      "name": "SF愛好家",
      "description": "伊藤計劃、円城塔などのSFを愛読。世界設定の緻密さを重視。",
      "preferences": [
        "技術的設定の整合性",
        "社会システムの論理的構築",
        "『ハーモニー』的なディストピア描写"
      ],
      "evaluation_weights": {
        "style": 0.2,
        "plot": 0.2,
        "character": 0.2,
        "worldbuilding": 0.3,
        "readability": 0.1
      }
    },
    {
      "id": "literary-reader",
      "name": "文学少女",
      "description": "純文学を好む。心理描写の深さと文体の美しさを重視。",
      "preferences": [
        "内面描写の繊細さ",
        "文体のリズム",
        "比喩表現の独自性"
      ],
      "evaluation_weights": {
        "style": 0.4,
        "plot": 0.1,
        "character": 0.3,
        "worldbuilding": 0.1,
        "readability": 0.1
      }
    },
    {
      "id": "light-reader",
      "name": "ライトリーダー",
      "description": "ライトノベル、Web小説を好む。テンポと読みやすさを重視。",
      "preferences": [
        "展開のスピード感",
        "読みやすい文章",
        "キャラクターの魅力"
      ],
      "evaluation_weights": {
        "style": 0.1,
        "plot": 0.3,
        "character": 0.3,
        "worldbuilding": 0.1,
        "readability": 0.2
      }
    },
    {
      "id": "editor",
      "name": "編集者",
      "description": "商業出版の視点から評価。構成と完成度を重視。",
      "preferences": [
        "物語の構成",
        "テーマの一貫性",
        "商業的な訴求力"
      ],
      "evaluation_weights": {
        "style": 0.2,
        "plot": 0.3,
        "character": 0.2,
        "worldbuilding": 0.1,
        "readability": 0.2
      }
    }
  ]
}
```

---

## 7. 適合度計算

### 7.1 計算式

```
compliance_score =
    constitution_score × 0.4
  + style_similarity × 0.3
  + anti_soul_distance × 0.2
  + world_consistency × 0.1
```

### 7.2 各スコアの計算方法

| スコア | 計算方法 |
|--------|---------|
| constitution_score | 禁止語彙チェック、文長分布、括弧表記の検証 |
| style_similarity | 聖典断片との文体ベクトル類似度 |
| anti_soul_distance | 反魂との非類似度（1 - 最大類似度） |
| world_consistency | 用語・設定の整合性チェック |

### 7.3 閾値

| 判定 | 閾値 |
|------|------|
| 合格 | compliance_score >= 0.75 |
| 候補プール追加 | compliance_score >= 0.85 かつ reader_score >= 0.80 |
