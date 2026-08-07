import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCopilotConversation,
  copilotConversationStorageKey,
  persistCopilotConversation,
  readCopilotConversation,
} from '../utils/copilotConversationStorage';

const conversationId = 'abcdefghijklmnopqrstuvwx12345678';

describe('persistencia de sesión de Copilot', () => {
  beforeEach(() => localStorage.clear());

  it('conserva la sesión al cerrar/reabrir y al recargar', () => {
    const scope = { userId: 'user-1', tenantDbName: 'tenant-a' };
    expect(persistCopilotConversation(scope, conversationId)).toBe(true);
    expect(readCopilotConversation(scope)).toBe(conversationId);
    expect(readCopilotConversation({ ...scope })).toBe(conversationId);
  });

  it('aísla la sesión entre usuarios y tenants', () => {
    persistCopilotConversation({ userId: 'user-1', tenantDbName: 'tenant-a' }, conversationId);
    expect(readCopilotConversation({ userId: 'user-2', tenantDbName: 'tenant-a' })).toBeNull();
    expect(readCopilotConversation({ userId: 'user-1', tenantDbName: 'tenant-b' })).toBeNull();
  });

  it('Limpiar elimina sólo la referencia del alcance actual', () => {
    const scope = { userId: 'user-1', tenantDbName: 'tenant-a' };
    persistCopilotConversation(scope, conversationId);
    clearCopilotConversation(scope);
    expect(readCopilotConversation(scope)).toBeNull();
  });

  it('rechaza alcances incompletos e identificadores inválidos', () => {
    expect(copilotConversationStorageKey({ userId: '', tenantDbName: 'tenant-a' })).toBeNull();
    expect(persistCopilotConversation({ userId: 'u', tenantDbName: 't' }, 'predictable')).toBe(false);
  });
});
