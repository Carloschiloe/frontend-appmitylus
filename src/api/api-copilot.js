import { apiClient } from './apiClient';

export function sendCopilotCommand({ text, mode = 'draft', commandId } = {}) {
  return apiClient.post('/copilot/command', {
    text: text || '',
    mode,
    ...(commandId ? { commandId } : {}),
  });
}

export function confirmCopilotCommand(commandId) {
  return sendCopilotCommand({ mode: 'confirm', commandId });
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
