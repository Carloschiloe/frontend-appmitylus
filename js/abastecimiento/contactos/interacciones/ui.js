// /js/abastecimiento/contactos/interacciones/ui.js
import { mountActivityTable } from './activity-table.js';
import { openInteraccionModal } from './modal.js';

// Exponer para que agenda-lite y otros módulos puedan abrir el modal
if (typeof window !== 'undefined') {
  window.openInteraccionModal = openInteraccionModal;
}

export function mountInteracciones(root) {
  mountActivityTable(root).catch(e => console.error('[activity] mount error', e));
}
