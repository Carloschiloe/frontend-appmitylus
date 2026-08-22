import { describe, expect, it } from 'vitest';
import {
  applyCommandTransition,
  isCommandConfirmable,
  isStaleConversationError,
  snapshotToHistory,
} from '../utils/copilotActionState';

function historyWith(commandId) {
  return [{
    type: 'assistant',
    id: `turn-${commandId}`,
    results: [{ status: 'needs_confirmation', commandId, command: { intent: 'register_interaction' } }],
  }];
}

describe('estado visual de propuestas Copilot', () => {
  it('deshabilita la tarjeta reemplazada y deja confirmable sólo la nueva', () => {
    const oldId = 'command-old';
    const next = { status: 'needs_confirmation', commandId: 'command-new', replacedCommandId: oldId };
    const updated = applyCommandTransition(historyWith(oldId), next);
    expect(updated[0].results[0]).toMatchObject({ status: 'replaced', commandState: 'replaced' });
    expect(isCommandConfirmable(updated[0].results[0])).toBe(false);
    expect(isCommandConfirmable(next)).toBe(true);
  });

  it('retira confirmación al cancelar y al completar', () => {
    const cancelled = applyCommandTransition(historyWith('command-a'), {
      status: 'cancelled', cancelledCommandId: 'command-a',
    });
    expect(cancelled[0].results[0].status).toBe('cancelled');
    expect(isCommandConfirmable(cancelled[0].results[0])).toBe(false);

    const completed = applyCommandTransition(historyWith('command-b'), {
      status: 'completed', commandId: 'command-b',
    });
    expect(completed[0].results[0].status).toBe('completed');
  });

  it('rehidrata tras recarga únicamente la versión vigente como confirmable', () => {
    const snapshot = {
      conversationId: 'conversation-12345678901234567890',
      turns: [{ turnId: 'turn-1', userText: 'Prepara una llamada', narrative: 'Preparé la propuesta.' }],
      pendingAction: {
        status: 'needs_confirmation', commandId: 'command-v2', commandVersion: 2,
        command: { intent: 'register_interaction', payload: { resumen: 'Corregido' } },
      },
    };
    const history = snapshotToHistory(snapshot);
    const pending = history.flatMap((item) => item.results || []);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ commandId: 'command-v2', commandVersion: 2 });
    expect(isCommandConfirmable(pending[0])).toBe(true);
  });

  it('mantiene estados already_processing y completed sin reactivar tarjetas', () => {
    expect(isCommandConfirmable({ status: 'already_processing', commandId: 'x' })).toBe(false);
    expect(isCommandConfirmable({ status: 'completed', commandId: 'x' })).toBe(false);
  });

  it('C-8: rehidrata pendingActions (array, multi-intención) como varias tarjetas confirmables', () => {
    const snapshot = {
      conversationId: 'conversation-multi',
      turns: [],
      pendingActions: [
        { status: 'needs_confirmation', commandId: 'cmd-disp', command: { intent: 'declarar_disponibilidad' } },
        { status: 'needs_confirmation', commandId: 'cmd-comp', command: { intent: 'crear_compromiso' } },
      ],
      pendingAction: { status: 'needs_confirmation', commandId: 'cmd-disp', command: { intent: 'declarar_disponibilidad' } },
    };
    const history = snapshotToHistory(snapshot);
    const pending = history.flatMap((item) => item.results || []);
    expect(pending).toHaveLength(2);
    expect(pending.map((p) => p.commandId).sort()).toEqual(['cmd-comp', 'cmd-disp']);
    expect(pending.every((p) => isCommandConfirmable(p))).toBe(true);
  });

  it('sin propuestas pendientes tras un refresh no revienta (array ni legacy)', () => {
    expect(snapshotToHistory({ conversationId: 'x', turns: [], pendingActions: [], pendingAction: null }).flatMap((i) => i.results || [])).toHaveLength(0);
  });
});

describe('isStaleConversationError — recuperación de un conversationId inválido', () => {
  it('reconoce el 404 estructurado de conversación no encontrada', () => {
    const error = { status: 404, data: { code: 'ERR_COPILOT_CONVERSATION_NOT_FOUND', message: 'Conversación no encontrada.' } };
    expect(isStaleConversationError(error)).toBe(true);
  });

  it('no confunde otros 404 (ruta inexistente, recurso de negocio distinto) con conversación stale', () => {
    expect(isStaleConversationError({ status: 404, data: { code: 'ERR_COPILOT_PENDING_ACTION_NOT_FOUND' } })).toBe(false);
    expect(isStaleConversationError({ status: 404 })).toBe(false);
    expect(isStaleConversationError({ status: 404, data: {} })).toBe(false);
  });

  it('no confunde otros status con el mismo code (defensivo, no debería ocurrir en la práctica)', () => {
    expect(isStaleConversationError({ status: 500, data: { code: 'ERR_COPILOT_CONVERSATION_NOT_FOUND' } })).toBe(false);
  });

  it('tolera error null/undefined sin lanzar', () => {
    expect(isStaleConversationError(null)).toBe(false);
    expect(isStaleConversationError(undefined)).toBe(false);
  });
});
