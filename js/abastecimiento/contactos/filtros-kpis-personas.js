// /js/contactos/filtros-kpis-personas.js
import { state, $ } from './state.js';
import { prepararNuevo } from './form-contacto.js';

export function initFiltrosYKPIsPersonas() {
  // Chips de filtro
  const chips = [
    ['fltTodosP', 'todos'],
    ['fltSinP',  'sin'],
    ['fltConP',  'con'],
  ];
  chips.forEach(([id, filtro]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      chips.forEach(([idx]) => document.getElementById(idx)?.classList.remove('teal','white-text'));
      el.classList.add('teal','white-text');
      document.dispatchEvent(new CustomEvent('filtro-personas-changed', { detail: { filtro } }));
    });
  });

  // Botón "Agregar persona" (si existe)
  const btn = document.getElementById('btnAgregarPersona');
  if (btn) btn.addEventListener('click', () => {
    prepararNuevo();
    const modal = document.getElementById('modalContacto');
    (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
  });

  // Refrescar KPIs cuando cambie el dataset
  document.addEventListener('reload-tabla-contactos', refrescarKPIs);
  refrescarKPIs();
}

function tieneEmpresa(c) {
  return !!(c.empresaId) || (!!c.proveedorKey && !!c.proveedorNombre);
}

export function refrescarKPIs() {
  const arr = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  const total = arr.length;
  const con   = arr.filter(tieneEmpresa).length;
  const sin   = total - con;

  // (opcional) si no tienes dato de visitas, déjalo en 0
  const visitasSin30d = 0;

  const t = $('#kpiPTotal');        if (t) t.textContent = String(total);
  const s = $('#kpiPSin');          if (s) s.textContent = String(sin);
  const c = $('#kpiPCon');          if (c) c.textContent = String(con);
  const v = $('#kpiPVisitasSin');   if (v) v.textContent = String(visitasSin30d);
}
