/**
 * SSE parser for OpenAI Codex Responses API.
 * Parses Server-Sent Events and extracts the final response.
 */

export interface CodexResponse {
  text: string;
  reasoning: string | null;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
}

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

function parseSSELines(sseText: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = sseText.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (data.type && typeof data.type === 'string') {
        events.push({ type: data.type, data });
      }
    } catch {
      // skip malformed JSON
    }
  }

  return events;
}

function extractTextFromOutput(output: unknown[]): string {
  const texts: string[] = [];
  for (const item of output) {
    if (
      item && typeof item === 'object' &&
      'type' in item && (item as Record<string, unknown>).type === 'message' &&
      'content' in item
    ) {
      const content = (item as Record<string, unknown>).content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (
            part && typeof part === 'object' &&
            'type' in part && (part as Record<string, unknown>).type === 'output_text' &&
            'text' in part
          ) {
            texts.push((part as { text: string }).text);
          }
        }
      }
    }
  }
  return texts.join('');
}

function extractReasoning(output: unknown[]): string | null {
  for (const item of output) {
    if (
      item && typeof item === 'object' &&
      'type' in item && (item as Record<string, unknown>).type === 'reasoning' &&
      'summary' in item
    ) {
      const summary = (item as Record<string, unknown>).summary;
      if (Array.isArray(summary)) {
        return summary
          .filter((s: unknown) => s && typeof s === 'object' && 'text' in (s as Record<string, unknown>))
          .map((s: unknown) => (s as { text: string }).text)
          .join('\n');
      }
    }
  }
  return null;
}

export function parseSSEToResponse(sseText: string): CodexResponse {
  const events = parseSSELines(sseText);

  // Check for failure events
  for (const event of events) {
    if (event.type === 'response.failed') {
      const response = event.data.response as Record<string, unknown> | undefined;
      const error = response?.error as Record<string, unknown> | undefined;
      throw new Error(error?.message as string ?? 'Codex request failed');
    }
  }

  // Find the completed event
  const completedEvent = events.find(e => e.type === 'response.completed');
  if (!completedEvent) {
    throw new Error('No response.completed event found in SSE stream');
  }

  const response = completedEvent.data.response as Record<string, unknown>;
  const usage = response.usage as Record<string, number> | undefined;
  const output = response.output as unknown[] | undefined;

  let text = response.output_text as string | undefined;
  if (!text && output) {
    text = extractTextFromOutput(output);
  }

  return {
    text: text ?? '',
    reasoning: output ? extractReasoning(output) : null,
    tokensUsed: usage?.total_tokens ?? 0,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

export async function parseSSEStream(body: ReadableStream<Uint8Array>): Promise<CodexResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  return parseSSEToResponse(buffer);
}
