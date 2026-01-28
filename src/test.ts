import dotenv from 'dotenv';
import Cerebras from '@cerebras/cerebras_cloud_sdk';

await dotenv.config();

async function testCerebrasSDK(): Promise<void> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  const model = process.env.CEREBRAS_MODEL;

  if (!apiKey || !model) {
    console.error('環境変数 CEREBRAS_API_KEY または CEREBRAS_MODEL が設定されていません');
    process.exit(1);
  }

  const client = new Cerebras({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'こんにちは。自己紹介をお願いします。' },
      ],
    });

    console.log('API呼び出し成功');
    console.log('レスポンス:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('API呼び出し失敗');
    console.error(error);
    process.exit(1);
  }
}

await testCerebrasSDK();