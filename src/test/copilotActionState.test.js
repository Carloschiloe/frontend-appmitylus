import { describe, expect, it } from 'vitest';
import {
  applyCommandTransition,
  isCommandConfirmable,
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
});
