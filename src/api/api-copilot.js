import { apiClient, getCsrfToken } from './apiClient';

const COPILOT_STREAM_URL = '/api/copilot/v2/stream';

function parseSseBlock(rawBlock) {
  let eventName = 'message';
  const dataLines = [];
  for (const line of rawBlock.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  const dataRaw = dataLines.join('\n');
  if (!dataRaw) return { type: eventName, data: null };
  try {
    return { type: eventName, data: JSON.parse(dataRaw) };
  } catch {
    return { type: eventName, data: dataRaw };
  }
}

function buildStreamError(status, data) {
  const error = new Error(data?.error || data?.message || 'Mitynex Copilot no pudo responder.');
  error.name = 'ApiError';
  error.status = status;
  error.data = data;
  return error;
}

/**
 * Consume el endpoint SSE de Mitynex Copilot V2: narrativa conversacional del LLM,
 * memoria multi-turno y multiples intenciones por mensaje.
 * onEvent recibe { type: 'status'|'narrative'|'result'|'summary'|'error', data }.
 */
export async function streamCopilotCommand({
  text = '',
  history = [],
  mode = 'draft',
  commandId,
  signal,
  onEvent,
} = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const csrfToken = getCsrfToken();
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const tenantDb = localStorage.getItem('selected_tenant_db');
  if (tenantDb) headers['x-tenant-db'] = tenantDb;

  const response = await fetch(COPILOT_STREAM_URL, {
    method: 'POST',
    headers,
    credentials: 'include',
    signal,
    body: JSON.stringify({ text, history, mode, ...(commandId ? { commandId } : {}) }),
  });

  const contentType = response.headers.get('content-type') || '';

  // El backend puede rechazar antes de iniciar el stream (sin tenant, validacion Zod, etc.)
  if (!contentType.includes('text/event-stream') || !response.body) {
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw buildStreamError(response.status, data);
    return data;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex;
    while ((separatorIndex = buffer.indexOf('\n\n')) >= 0) {
      const rawBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      if (!rawBlock.trim()) continue;

      const event = parseSseBlock(rawBlock);
      if (event.type === 'done') return;
      onEvent?.(event);
    }
  }
}

export function getCopilotVoiceStatus() {
  return apiClient.get('/copilot/voice/status');
}

export function transcribeCopilotAudio(audioBlob) {
  const form = new FormData();
  form.append('audio', audioBlob, 'mitynex-copilot.webm');
  return apiClient.post('/copilot/voice/transcribe', form, { timeoutMs: 120000 });
}

export function createCopilotSpeech(text) {
  return apiClient.post('/copilot/voice/speech', { text }, {
    responseType: 'blob',
    timeoutMs: 120000,
  });
}
