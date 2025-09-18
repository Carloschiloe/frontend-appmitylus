/* inventario-frontend.js — versión limpia con API_BASE global */
const API = window.API_BASE || '/api';                       // <- un solo punto de verdad
const log = (...a) => (window.DEBUG === true) && console.log('[Inventario]', ...a);

// Wrapper para fetch con manejo simple de errores y JSON opcional
async function apiFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${texto}`);
  }
  return res;
}

let centros = [];
let table;

document.addEventListener('DOMContentLoaded', () => {
  M.Modal.init(document.querySelectorAll('.modal'));
  table = $('#centrosTable').DataTable({ searching: false });

  cargarCentros();

  // Abrir modal nuevo centro
  document.getElementById('btnOpenCentroModal').onclick = () => {
    document.getElementById('formTitle').textContent = 'Agregar Centro de Cultivo';
    document.getElementById('formCentro').reset();
    document.getElementById('inputCentroId').value = '';
    M.updateTextFields();
    M.Modal.getInstance(document.getElementById('centroModal')).open();
  };

  // Guardar centro (nuevo o editado)
  document.getElementById('formCentro').onsubmit = async e => {
    e.preventDefault();
    const nombreCentro = document.getElementById('inputName').value.trim();
    const codigoCentro = document.getElementById('inputCode').value.trim();
    const hectareas    = Number(document.getElementById('inputHectareas').value || 0);
    const coordsRaw    = document.getElementById('inputCoords').value.trim();

    let puntos = [];
    if (coordsRaw) {
      puntos = coordsRaw.split('|').map(s => {
        const [latS, lngS] = s.split(',');
        const lat = Number((latS || '').trim());
        const lng = Number((lngS || '').trim());
        return { lat, lng };
      }).filter(pt => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
    }

    const data = { nombreCentro, codigoCentro, hectareas, puntos };

    try {
      const id = document.getElementById('inputCentroId').value;
      if (id) {
        // Editar
        await apiFetch(`/inventario/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        M.toast({ html: 'Centro actualizado', classes: 'green' });
      } else {
        // Nuevo
        await apiFetch(`/inventario`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        M.toast({ html: 'Centro creado', classes: 'green' });
      }
      M.Modal.getInstance(document.getElementById('centroModal')).close();
      cargarCentros();
    } catch (err) {
      console.error(err);
      M.toast({ html: 'Error al guardar centro', classes: 'red' });
      alert(err.message);
    }
  };
});

// Cargar todos los centros y poblar tabla
async function cargarCentros() {
  try {
    const res = await apiFetch(`/inventario`);
    centros = await res.json();
    log('Centros cargados:', Array.isArray(centros) ? centros.length : centros);

    table.clear();
    (centros || []).forEach(c => {
      table.row.add([
        c.nombreCentro ?? '',
        c.codigoCentro ?? '',
        c.hectareas ?? '',
        (c.puntos || []).map(pt => `${pt.lat},${pt.lng}`).join('<br>'),
        `
          <button class="btn-small blue" onclick="editarCentro('${c._id}')">Editar</button>
          <button class="btn-small red" onclick="eliminarCentro('${c._id}')">&times;</button>
        `
      ]);
    });
    table.draw();
  } catch (err) {
    console.error(err);
    M.toast({ html: 'Error al cargar centros', classes: 'red' });
    alert(err.message);
  }
}

window.editarCentro = function(id) {
  const centro = (centros || []).find(c => c._id === id);
  if (!centro) return;
  document.getElementById('inputCentroId').value = id;
  document.getElementById('inputName').value = centro.nombreCentro ?? '';
  document.getElementById('inputCode').value = centro.codigoCentro ?? '';
  document.getElementById('inputHectareas').value = centro.hectareas ?? '';
  document.getElementById('inputCoords').value = (centro.puntos || [])
    .map(pt => `${pt.lat},${pt.lng}`).join(' | ');
  document.getElementById('formTitle').textContent = 'Editar Centro';
  M.updateTextFields();
  M.Modal.getInstance(document.getElementById('centroModal')).open();
};

window.eliminarCentro = async function(id) {
  if (!confirm('¿Eliminar este centro?')) return;
  try {
    await apiFetch(`/inventario/${id}`, { method: 'DELETE' });
    M.toast({ html: 'Centro eliminado', classes: 'green' });
    cargarCentros();
  } catch (err) {
    console.error(err);
    M.toast({ html: 'Error al eliminar', classes: 'red' });
    alert(err.message);
  }
};
