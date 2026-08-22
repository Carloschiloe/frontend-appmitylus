const TERMINAL_STATUSES = new Set(['replaced', 'cancelled', 'completed', 'executed']);

export function isCommandConfirmable(response) {
  return response?.status === 'needs_confirmation' && Boolean(response?.commandId) && !response?.commandState;
}

// Un conversationId guardado en localStorage puede quedar stale (expiró, se
// reseteó, o corresponde a otro tenant) — el backend lo rechaza con este
// codigo estructurado, nunca con un 404 generico de ruta. Detectarlo así (no
// solo por el status 404, que también puede significar otra cosa) evita que
// CopilotPanel reintente por error en casos donde el 404 es otro tipo de
// rechazo de negocio.
export function isStaleConversationError(error) {
  return error?.status === 404 && error?.data?.code === 'ERR_COPILOT_CONVERSATION_NOT_FOUND';
}

function terminalStatusFor(response, commandId) {
  if (!commandId) return null;
  if (response?.replacedCommandId === commandId) return 'replaced';
  if (response?.cancelledCommandId === commandId) return 'cancelled';
  if (TERMINAL_STATUSES.has(response?.status) && response?.commandId === commandId) return response.status;
  return null;
}

export function applyCommandTransition(history, response) {
  return history.map((item) => {
    if (item.type !== 'assistant') return item;
    return {
      ...item,
      results: (item.results || []).map((result) => {
        const nextStatus = terminalStatusFor(response, result.commandId);
        return nextStatus ? { ...result, status: nextStatus, commandState: nextStatus } : result;
      }),
    };
  });
}

export function snapshotToHistory(snapshot) {
  const items = [];
  for (const turn of snapshot?.turns || []) {
    if (turn.userText) items.push({ type: 'user', id: `${turn.turnId}-user`, text: turn.userText });
    if (turn.narrative) {
      items.push({
        type: 'assistant', id: `${turn.turnId}-assistant`, sourceText: turn.userText || '',
        narrative: turn.narrative, results: [], streaming: false, error: null,
      });
    }
  }
  const pendingActions = snapshot?.pendingActions?.length
    ? snapshot.pendingActions
    : (snapshot?.pendingAction ? [snapshot.pendingAction] : []);
  if (pendingActions.length) {
    items.push({
      type: 'assistant', id: `pending-${pendingActions.map((p) => p.commandId).join('-')}`, sourceText: '', narrative: '',
      results: pendingActions, streaming: false, error: null,
    });
  }
  return items;
}
