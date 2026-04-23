// /js/abastecimiento/visitas/actions.js
import { remove } from './api.js';
import { createModalConfirm } from '../contactos/ui-common.js';
import { toast } from '../../ui/toast.js';

const askDeleteVisita = createModalConfirm({
  id: 'modalConfirmDeleteVisita',
  defaultTitle: 'Eliminar visita',
  defaultMessage: '¿Eliminar esta visita?',
  acceptText: 'Eliminar'
});

export async function manejarAccionVisitaEl(el) {
  const action = (el?.dataset?.action || '').toLowerCase();
  const id = el?.dataset?.id || '';
  try {
    if (action === 'muestreo') {
      const hasMuestreo = !!el?.classList?.contains('mu-green');
      document.dispatchEvent(new CustomEvent('muestreo:open-from-visita', {
        detail: {
          id,
          view: hasMuestreo ? 'summary' : 'form'
        }
      }));
      return;
    }
    if (action === 'ver' || action === 'detalle') {
      document.dispatchEvent(new CustomEvent('visita:open-readonly', { detail: { id } }));
      return;
    }
    if (action === 'editar' || action === 'editar-visita') {
      document.dispatchEvent(new CustomEvent('visita:open-edit', { detail: { id } }));
      return;
    }
    if (action === 'eliminar') {
      if (!id) return;
      const ok = await askDeleteVisita('Eliminar visita', '¿Eliminar esta visita?', 'Eliminar');
      if (!ok) return;
      await remove(id);
      toast('Visita eliminada', { variant: 'success', durationMs: 1600 });
      window.dispatchEvent(new CustomEvent('visita:deleted', { detail: { id } }));
      return;
    }
  } catch (err) {
    console.error('[visitas/actions] error', err);
    toast('Acción no disponible', { variant: 'error' });
  }
}

export function wireActionsGlobalsOnce() {
  if (window.__visitas_actions_wired) return;
  window.__visitas_actions_wired = true;

  // Helper usado por los anchors en la tabla (pointerdown/touchstart)
  window.__visAction = function(el, ev) {
    try {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      manejarAccionVisitaEl(el);
    } catch (err) {
      console.warn('[visitas] __visAction error', err);
    }
  };
}
