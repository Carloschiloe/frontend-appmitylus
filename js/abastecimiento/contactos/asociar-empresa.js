// /js/contactos/asociar-empresa.js
const API_BASE = window.API_BASE || '';
let contactoActualId = null;
let modalInst = null;
let debounceTimer = null;

export function initAsociacionContactos() {
  // Modal
  const modalEl = document.getElementById('modalAsociar');
  if (modalEl && window.M && M.Modal) {
    modalInst = M.Modal.init(modalEl, { endingTop: '10%' });
  }

  // Delegado global: cualquier .asociar-btn (en tabla Personas o donde sea)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.asociar-btn');
    if (!btn) return;
    e.preventDefault();
    contactoActualId = btn.dataset.id;
    abrirModal();
  });

  // Buscar empresas
  const $search = document.getElementById('empresaSearch');
  if ($search) {
    $search.addEventListener('input', () => {
      const q = $search.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => buscarEmpresas(q), 250);
    });
  }

  // Crear empresa inline
  const $crear = document.getElementById('btnCrearEmpresa');
  if ($crear) {
    $crear.addEventListener('click', async () => {
      const nombre = prompt('Nombre de la nueva empresa:');
      if (!nombre) return;
      const emp = await fetchJSON('/empresas', { method:'POST', body: JSON.stringify({ nombre }) });
      await patchEmpresa(contactoActualId, emp._id);
      toast('Empresa creada y asociada');
      cerrarModal();
      recargarTablas();
    });
  }

  // Quitar
  const $quitar = document.getElementById('btnQuitarEmpresa');
  if ($quitar) {
    $quitar.addEventListener('click', async () => {
      await patchEmpresa(contactoActualId, null);
      toast('Empresa quitada del contacto');
      cerrarModal();
      recargarTablas();
    });
  }

  // Seleccionar resultado
  const $results = document.getElementById('searchResults');
  if ($results) {
    $results.addEventListener('click', async (e) => {
      const a = e.target.closest('a.sel-empresa');
      if (!a) return;
      e.preventDefault();
      await patchEmpresa(contactoActualId, a.dataset.id);
      toast('Asociado correctamente');
      cerrarModal();
      recargarTablas();
    });
  }
}

function abrirModal(){ 
  const s = document.getElementById('empresaSearch'); 
  const r = document.getElementById('searchResults');
  if (s) s.value = ''; 
  if (r) r.innerHTML = ''; 
  if (modalInst) modalInst.open();
}
function cerrarModal(){ if (modalInst) modalInst.close(); }

async function buscarEmpresas(q){
  const r = document.getElementById('searchResults'); 
  if (!r) return;
  if (!q || q.length<2){ r.innerHTML=''; return; }
  const items = await fetchJSON(`/empresas/search?q=${encodeURIComponent(q)}`).catch(()=>[]);
  r.innerHTML = items.map(i=>`
    <li class="collection-item">
      <a href="#!" class="sel-empresa" data-id="${i._id}" data-nombre="${i.nombre}">${i.nombre}</a>
    </li>`).join('');
}

async function patchEmpresa(contactoId, empresaIdOrNull) {
  await fetchJSON(`/contactos/${contactoId}/empresa`, {
    method:'PATCH',
    body: JSON.stringify({ empresaId: empresaIdOrNull })
  });
}

async function fetchJSON(path, opts={}) {
  const res = await fetch((API_BASE||'') + path, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
function toast(html){ if (window.M && M.toast) M.toast({ html }); }
function recargarTablas(){ document.dispatchEvent(new CustomEvent('reload-tabla-contactos')); }
