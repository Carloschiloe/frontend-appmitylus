// /js/abastecimiento/visitas/actions.js
import { remove } from './api.js';

export function manejarAccionVisitaEl(el) {
  const action = (el?.dataset?.action || '').toLowerCase();
  const id = el?.dataset?.id || '';
  try {
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
      if (!confirm('¿Eliminar esta visita?')) return;
      (async () => {
        await remove(id);
        M.toast?.({ html: 'Visita eliminada', displayLength: 1600 });
        window.dispatchEvent(new CustomEvent('visita:deleted', { detail: { id } }));
      })().catch(err => {
        console.warn(err);
        M.toast?.({ html: 'No se pudo eliminar', classes: 'red', displayLength: 2000 });
      });
      return;
    }
  } catch (err) {
    console.error('[visitas/actions] error', err);
    M.toast?.({ html: 'Acción no disponible', classes: 'red' });
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
