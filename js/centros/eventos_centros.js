// js/centros/eventos_centros.js  — versión simplificada (sin líneas)
import { Estado } from '../core/estado.js';
import { deleteCentro, getCentrosAll } from '../core/centros_repo.js';
import { openEditForm } from './form_centros.js';
import { loadCentros } from './tabla_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

/* ===== Utiles ===== */
const $  = (sel, ctx = document) => (ctx.querySelector ? ctx.querySelector(sel) : null);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const toast = (html, classes = '') => window.M?.toast?.({ html, classes });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const fmtDate = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? esc(s) : d.toISOString().slice(0, 10);
};

/* Refresca tabla + mapa desde API (sin depender de app.js) */
async function refreshCentros() {
  try {
    Estado.centros = await getCentrosAll();
    await loadCentros(Estado.centros);
    if (tabMapaActiva()) renderMapaAlways(true);
  } catch (e) {
    console.error('Error refrescando centros:', e);
    toast('Error refrescando centros', 'red');
  }
}

/* ============ Registro de eventos de la tabla ============ */
export function registerTablaCentrosEventos() {
  const $t = window.$('#centrosTable');

  // --- Modal de Detalles / Coordenadas ---
  $t.off('click', '.btn-coords').on('click', '.btn-coords', function () {
    const idx   = +this.dataset.idx;
    const c     = Estado.centros[idx];
    const modal = $('#modalDetallesCentro');
    const body  = $('#detallesCentroBody');
    if (!c || !modal || !body) return;

    const d = (c.detalles && typeof c.detalles === 'object') ? c.detalles : {};
    const plan = { ...d };
    if (d.resSSP) {
      if (d.resSSP.numero) plan.numeroResSSP = d.resSSP.numero;
      if (d.resSSP.fecha)  plan.fechaResSSP  = d.resSSP.fecha;
    }
    if (d.resSSFFAA) {
      if (d.resSSFFAA.numero) plan.numeroResSSFFAA = d.resSSFFAA.numero;
      if (d.resSSFFAA.fecha)  plan.fechaResSSFFAA  = d.resSSFFAA.fecha;
    }

    const LABELS = {
      region: 'Región',
      codigoArea: 'Código Área',
      ubicacion: 'Ubicación',
      grupoEspecie: 'Grupo Especie',
      especies: 'Especies',
      tonsMax: 'Tons Máx',
      numeroResSSP: 'N° ResSSP',
      fechaResSSP: 'Fecha ResSSP',
      numeroResSSFFAA: 'N° ResSSFFAA',
      fechaResSSFFAA: 'Fecha ResSSFFAA',
      rutTitular: 'RUT Titular',
      nroPert: 'Nro. Pert',
    };
    const prettyKey = k => LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase());

    const ORDER_TOP = ['region','codigoArea','ubicacion','grupoEspecie','especies','tonsMax'];
    const ORDER_DET = ['rutTitular','nroPert','numeroResSSP','fechaResSSP','numeroResSSFFAA','fechaResSSFFAA'];

    let html = `<table class="striped"><tbody>
      <tr><th>Proveedor</th><td>${esc(toTitleCase(c.proveedor || ''))}</td></tr>
      <tr><th>Comuna</th><td>${esc(toTitleCase(c.comuna || ''))}</td></tr>
      <tr><th>Código</th><td>${esc(c.code || '')}</td></tr>
      <tr><th>Hectáreas</th><td>${esc(c.hectareas ?? '')}</td></tr>
    `;

    ORDER_TOP.forEach(k => {
      let v = c[k];
      if (k === 'especies' && Array.isArray(c.especies)) v = c.especies.join(', ');
      if (v !== undefined && v !== null && String(v) !== '') {
        html += `<tr><th>${esc(prettyKey(k))}</th><td>${k.startsWith('fecha') ? fmtDate(v) : esc(v)}</td></tr>`;
      }
    });
    html += `</tbody></table>`;

    const orderedRows = [];
    ORDER_DET.forEach(k => {
      const v = plan[k];
      if (v !== undefined && v !== null && String(v) !== '') orderedRows.push([k, v]);
    });
    Object.keys(plan)
      .filter(k => !ORDER_DET.includes(k) && plan[k] !== '' && plan[k] != null)
      .sort()
      .forEach(k => orderedRows.push([k, plan[k]]));

    if (orderedRows.length) {
      html += `<h6 style="margin-top:1.5em;">Detalles</h6><table class="striped"><tbody>`;
      orderedRows.forEach(([k, v]) => {
        html += `<tr><th>${esc(prettyKey(k))}</th><td>${k.startsWith('fecha') ? fmtDate(v) : esc(v)}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else {
      html += `<div class="grey-text" style="margin-top:1em;">Sin detalles adicionales</div>`;
    }

    if (Array.isArray(c.coords) && c.coords.length) {
      html += `<h6 style="margin-top:1.5em;">Coordenadas</h6>
        <table class="striped">
          <thead><tr><th>#</th><th>Latitud</th><th>Longitud</th></tr></thead>
          <tbody>`;
      c.coords.forEach((p, i) => {
        const { lat, lng } = p || {};
        const latStr = Number.isFinite(lat) ? lat.toFixed(6) : esc(lat ?? '');
        const lngStr = Number.isFinite(lng) ? lng.toFixed(6) : esc(lng ?? '');
        html += `<tr><td>${i + 1}</td><td>${latStr}</td><td>${lngStr}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else {
      html += `<div class="grey-text" style="margin-top:1em;">Sin coordenadas registradas</div>`;
    }

    body.innerHTML = html;
    const inst = window.M?.Modal?.getInstance(modal) || window.M?.Modal?.init(modal);
    inst?.open();
  });

  // --- Editar centro ---
  $t.off('click', '.editar-centro').on('click', '.editar-centro', function () {
    const idx = +this.dataset.idx;
    Estado.currentCentroIdx = idx;

    const modalElem = $('#centroModal');
    const modal = modalElem ? (window.M?.Modal?.getInstance(modalElem) || window.M?.Modal?.init(modalElem)) : null;

    const els = {
      formTitle:      $('#formTitle'),
      inputCentroId:  $('#inputCentroId'),
      inputProveedor: $('#inputProveedor'),
      inputComuna:    $('#inputComuna'),
      inputCode:      $('#inputCode'),
      inputHectareas: $('#inputHectareas'),
      inputLat:       $('#inputLat'),
      inputLng:       $('#inputLng'),
      pointsBody:     $('#pointsBody')
    };

    openEditForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v), idx);
    modal?.open();
  });

  // --- Eliminar centro ---
  $t.off('click', '.eliminar-centro').on('click', '.eliminar-centro', async function () {
    const idx = +this.dataset.idx;
    const c = Estado.centros[idx];
    if (!c) return;
    const nombreRef = c.proveedor || c.comuna || 'este centro';
    if (!confirm(`¿Eliminar el centro "${nombreRef}"?`)) return;

    try {
      await deleteCentro(c._id);
      toast('Centro eliminado', 'green');
      await refreshCentros();
    } catch (e) {
      console.error(e);
      toast('No se pudo eliminar el centro', 'red');
    }
  });
}
