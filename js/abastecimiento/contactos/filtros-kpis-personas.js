// /js/contactos/filtros-kpis-personas.js
const API_BASE = window.API_BASE || '';

export function initFiltrosYKPIsPersonas() {
  const $todos = document.getElementById('fltTodosP');
  const $sin   = document.getElementById('fltSinP');
  const $con   = document.getElementById('fltConP');

  if ($todos && $sin && $con) {
    $todos.addEventListener('click', () => setFiltro('todos'));
    $sin.addEventListener('click',   () => setFiltro('sin'));
    $con.addEventListener('click',   () => setFiltro('con'));
  }
  refrescarKPIsP();
}

function setFiltro(valor) {
  ['fltTodosP','fltSinP','fltConP'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('teal','white-text');
  });
  const activo = valor === 'todos' ? 'fltTodosP' : valor === 'sin' ? 'fltSinP' : 'fltConP';
  const elAct = document.getElementById(activo);
  if (elAct) elAct.classList.add('teal','white-text');

  document.dispatchEvent(new CustomEvent('filtro-personas-changed', { detail: { filtro: valor }}));
  refrescarKPIsP().catch(console.error);
}

async function refrescarKPIsP() {
  try {
    const [todos, sin, con] = await Promise.all([
      fetchJSON('/contactos'),
      fetchJSON('/contactos?conEmpresa=0'),
      fetchJSON('/contactos?conEmpresa=1'),
    ]);
    put('kpiPTotal', todos.length);
    put('kpiPSin',   sin.length);
    put('kpiPCon',   con.length);

    let visitasSin = [];
    try {
      visitasSin = await fetchJSON('/visitas?deContactosSinEmpresa=1&dias=30');
    } catch(_) {}
    put('kpiPVisitasSin', visitasSin.length || 0);
  } catch(e){ console.error('[KPIs Personas]', e); }
}

function put(id,v){ const el = document.getElementById(id); if(el) el.textContent=v; }

async function fetchJSON(path, opts = {}) {
  const r = await fetch((API_BASE||'') + path, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}
