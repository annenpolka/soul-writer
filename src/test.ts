import dotenv from 'dotenv';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { ChatCompletion } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

await dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function testCerebrasSDK(): Promise<void> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  const model = process.env.CEREBRAS_MODEL;

  if (!apiKey || !model) {
    console.error('環境変数 CEREBRAS_API_KEY または CEREBRAS_MODEL が設定されていません');
    process.exit(1);
  }

  // ソウルテキストを読み込み
  const soultextPath = resolve(__dirname, '../docs/soultext.md');
  const soultext = readFileSync(soultextPath, 'utf-8');

  const systemPrompt = `あなたは以下の小説メモに基づいて文章を生成する作家です。
この世界観、キャラクター、文体を忠実に再現してください。

---
${soultext}
---

上記の設定とトーンを維持しながら、指定されたシーンを執筆してください。`;

  const client = new Cerebras({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '透心がMRフロアでセッションを終えた直後、現実世界に戻った瞬間の内面描写を書いてください。200字程度で。' },
      ],
    });

    console.log('API呼び出し成功');
    console.log('---');
    console.log('生成結果:');
    const r = response as ChatCompletion.ChatCompletionResponse;
    console.log(r.choices[0]?.message?.content);
    console.log('---');
    console.log('使用トークン:', r.usage);
  } catch (error) {
    console.error('API呼び出し失敗');
    console.error(error);
    process.exit(1);
  }
}

await testCerebrasSDK();