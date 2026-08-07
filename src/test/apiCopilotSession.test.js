import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamCopilotCommand } from '../api/api-copilot';

function sseResponse(blocks) {
  const encoded = new TextEncoder().encode(blocks.join('\n\n') + '\n\n');
  let sent = false;
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) return { done: true };
          sent = true;
          return { value: encoded, done: false };
        },
      }),
    },
  };
}

describe('contrato SSE de sesión Copilot', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('selected_tenant_db', 'tenant-demo');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('envía conversationId/turnId y consume el evento conversation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      'event: conversation\ndata: {"conversationId":"abcdefghijklmnopqrstuvwx12345678","turnId":"turn-12345678"}',
      'event: done\ndata: {}',
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const events = [];

    await streamCopilotCommand({
      text: 'Continuar conversación',
      conversationId: 'abcdefghijklmnopqrstuvwx12345678',
      turnId: 'turn-12345678',
      onEvent: (event) => events.push(event),
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      text: 'Continuar conversación',
      conversationId: 'abcdefghijklmnopqrstuvwx12345678',
      turnId: 'turn-12345678',
    });
    expect(events).toEqual([{
      type: 'conversation',
      data: { conversationId: 'abcdefghijklmnopqrstuvwx12345678', turnId: 'turn-12345678' },
    }]);
  });
});
