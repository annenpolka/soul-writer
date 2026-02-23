import { describe, it, expect } from 'vitest';
import { parseSSEToResponse } from './sse-parser.js';

// response.completed イベントのサンプル（OpenAI Responses API形式）
function makeCompletedEvent(opts: {
  text?: string;
  reasoning?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): string {
  const response = {
    id: 'resp_test123',
    status: 'completed',
    output: [
      {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [
          { type: 'output_text', text: opts.text ?? 'Hello world' },
        ],
      },
    ],
    output_text: opts.text ?? 'Hello world',
    usage: {
      input_tokens: opts.inputTokens ?? 20,
      output_tokens: opts.outputTokens ?? 10,
      total_tokens: opts.totalTokens ?? 30,
    },
  };

  return `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;
}

function makeFailedEvent(errorMessage: string): string {
  const response = {
    id: 'resp_test_fail',
    status: 'failed',
    error: { code: 'server_error', message: errorMessage },
  };
  return `event: response.failed\ndata: ${JSON.stringify({ type: 'response.failed', response })}\n\n`;
}

describe('parseSSEToResponse', () => {
  it('response.completedイベントからoutput_textを抽出できる', () => {
    const sse = makeCompletedEvent({ text: 'Generated text here' });

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('Generated text here');
  });

  it('response.completedイベントからusage情報を抽出できる', () => {
    const sse = makeCompletedEvent({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    const result = parseSSEToResponse(sse);

    expect(result.tokensUsed).toBe(150);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it('複数イベントを含むSSEストリームを正しくパースできる', () => {
    const sse = [
      'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1"}}\n\n',
      'event: response.in_progress\ndata: {"type":"response.in_progress"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" world"}\n\n',
      makeCompletedEvent({ text: 'Hello world' }),
    ].join('');

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('Hello world');
  });

  it('response.failedイベントでエラーを返す', () => {
    const sse = makeFailedEvent('Internal server error');

    expect(() => parseSSEToResponse(sse)).toThrow('Internal server error');
  });

  it('不正な行（data:プレフィックスなし）をスキップする', () => {
    const sse = [
      'this is not a valid SSE line\n',
      ': this is a comment\n',
      makeCompletedEvent({ text: 'valid result' }),
    ].join('');

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('valid result');
  });

  it('不正なJSON行をスキップする', () => {
    const sse = [
      'data: not-valid-json\n\n',
      makeCompletedEvent({ text: 'after invalid' }),
    ].join('');

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('after invalid');
  });

  it('空のSSEストリームでエラーを返す', () => {
    expect(() => parseSSEToResponse('')).toThrow();
  });

  it('response.completedがないSSEストリームでエラーを返す', () => {
    const sse = 'event: response.created\ndata: {"type":"response.created"}\n\n';

    expect(() => parseSSEToResponse(sse)).toThrow();
  });

  it('output_textがない場合にoutput配列からテキストを抽出できる', () => {
    const response = {
      id: 'resp_no_output_text',
      status: 'completed',
      output: [
        {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"name":"Test","score":42}' }],
        },
      ],
      // no output_text field
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    };
    const sse = `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('{"name":"Test","score":42}');
  });

  it('output_textが空文字の場合にoutput配列からテキストを抽出できる', () => {
    const response = {
      id: 'resp_empty_output_text',
      status: 'completed',
      output: [
        {
          id: 'reasoning_1',
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'Thinking...' }],
        },
        {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"result":"ok"}' }],
        },
      ],
      output_text: '',
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    };
    const sse = `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('{"result":"ok"}');
    expect(result.reasoning).toBe('Thinking...');
  });

  it('reasoningを含むレスポンスからreasoningを抽出できる', () => {
    const response = {
      id: 'resp_reason',
      status: 'completed',
      output: [
        {
          id: 'reasoning_item',
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'Thinking about the problem...' }],
        },
        {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Result' }],
        },
      ],
      output_text: 'Result',
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    };
    const sse = `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;

    const result = parseSSEToResponse(sse);

    expect(result.text).toBe('Result');
    expect(result.reasoning).toBe('Thinking about the problem...');
  });
});
