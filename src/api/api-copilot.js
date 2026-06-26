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

