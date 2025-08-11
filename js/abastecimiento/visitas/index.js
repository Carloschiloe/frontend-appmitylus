// /js/abastecimiento/visitas/index.js
import { setVisitas, visitasRows } from './state.js';
import { normalizeVisita }         from './normalizers.js';
import { cargarVisitasEnriquecidas } from './data.js';
import { renderTablaVisitas }      from './tabla.js';

// opcional: wrappers si tu /js/core/api.js no los tuviera
import { apiDeleteVisita } from '/js/core/api.js';

let _initialized = false;

export async function initVisitasTab(forceReload = false) {
  // Evita re-inicializar si ya está listo, a menos que se pida recarga
  if (_initialized && !forceReload) return;

  try {
    const { raw, rows } = await cargarVisitasEnriquecidas(normalizeVisita);
    setVisitas(raw, rows);
    renderTablaVisitas(rows);
    bindActions(); // eliminar, etc.
    _initialized = true;
  } catch (e) {
    console.error('[Visitas] Error al cargar:', e);
    M.toast?.({ html: 'Error al cargar visitas', displayLength: 2500 });
  }
}

function bindActions() {
  const tbody = document.querySelector('#tablaVisitas tbody');
  if (!tbody) return;

  // Delegación para eliminar
  tbody.addEventListener('click', async (ev) => {
    const a = ev.target.closest('a.icon-action.eliminar');
    if (!a) return;

    const id = a.dataset.id;
    if (!confirm('¿Eliminar esta visita?')) return;

    try {
      // usa tu API real; si no existe, fallback a fetch:
      if (apiDeleteVisita) {
        await apiDeleteVisita(id);
      } else {
        await fetch(`/api/visitas/${id}`, { method: 'DELETE' });
      }
      M.toast?.({ html: 'Visita eliminada', displayLength: 1800 });

      // Recarga tabla
      const { raw, rows } = await cargarVisitasEnriquecidas(normalizeVisita);
      setVisitas(raw, rows);
      renderTablaVisitas(rows);
    } catch (e) {
      console.error(e);
      M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
    }
  });
}
