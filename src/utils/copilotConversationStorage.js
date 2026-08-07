const PREFIX = 'mitynex_copilot_conversation';

export function copilotConversationStorageKey({ userId, tenantDbName }) {
  const user = String(userId || '').trim();
  const tenant = String(tenantDbName || '').trim();
  if (!user || !tenant) return null;
  return `${PREFIX}:${encodeURIComponent(user)}:${encodeURIComponent(tenant)}`;
}

export function readCopilotConversation(scope, storage = globalThis.localStorage) {
  const key = copilotConversationStorageKey(scope);
  if (!key || !storage) return null;
  const value = storage.getItem(key);
  return /^[A-Za-z0-9_-]{20,80}$/.test(value || '') ? value : null;
}

export function persistCopilotConversation(scope, conversationId, storage = globalThis.localStorage) {
  const key = copilotConversationStorageKey(scope);
  if (!key || !storage || !/^[A-Za-z0-9_-]{20,80}$/.test(conversationId || '')) return false;
  storage.setItem(key, conversationId);
  return true;
}

export function clearCopilotConversation(scope, storage = globalThis.localStorage) {
  const key = copilotConversationStorageKey(scope);
  if (!key || !storage) return false;
  storage.removeItem(key);
  return true;
}
