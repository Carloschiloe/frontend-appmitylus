// js/centros/eventos_centros.js — simplificado (sin líneas)
import { Estado } from '../core/estado.js';
import { deleteCentro, getCentrosAll } from '../core/centros_repo.js';
import { openEditForm } from './form_centros.js';
import { loadCentros } from './tabla_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways, focusCentroInMap } from '../mapas/control_mapa.js';

/* ===== Utils locales ===== */
const $  = (sel, ctx = document) => (ctx.querySelector ? ctx.querySelector(sel) : null);
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
    if (tabMapaActiva()) await renderMapaAlways(true);
  } catch (e) {
    console.error('Error refrescando centros:', e);
    toast('Error refrescando centros', 'red');
  }
}

/* Accesibilidad: dispara click con Enter o Espacio en elementos “icon-button” */
function keyActivatesClick(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget?.click?.(); }
}

/* ============ Registro de eventos de la tabla ============ */
export function registerTablaCentrosEventos() {
  const $t = window.$('#centrosTable'); // jQuery (DataTables)
  if (!$t.length) return;

  /* --- Detalles / Coordenadas --- */
  $t.off('click', '.btn-coords').on('click', '.btn-coords', function () {
    try {
      const idx = Number(this.dataset.idx);
      const c   = Estado.centros?.[idx];
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
        region: 'Región', codigoArea: 'Código Área', ubicacion: 'Ubicación',
        grupoEspecie: 'Grupo Especie', especies: 'Especies', tonsMax: 'Tons Máx',
        numeroResSSP: 'N° ResSSP', fechaResSSP: 'Fecha ResSSP',
        numeroResSSFFAA: 'N° ResSSFFAA', fechaResSSFFAA: 'Fecha ResSSFFAA',
        rutTitular: 'RUT Titular', nroPert: 'Nro. Pert',
      };
      const prettyKey = k => LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase());
      const ORDER_TOP = ['region','codigoArea','ubicacion','grupoEspecie','especies','tonsMax'];
      const ORDER_DET = ['rutTitular','nroPert','numeroResSSP','fechaResSSP','numeroResSSFFAA','fechaResSSFFAA'];

      let html = `<table class="striped"><tbody>
        <tr><th>Proveedor</th><td>${esc(toTitleCase(c.proveedor || c.name || ''))}</td></tr>
        <tr><th>Comuna</th><td>${esc(toTitleCase(c.comuna || ''))}</td></tr>
        <tr><th>Código</th><td>${esc(c.code || '')}</td></tr>
        <tr><th>Hectáreas</th><td>${esc(c.hectareas ?? '')}</td></tr>`;

      ORDER_TOP.forEach(k => {
        let v = c[k];
        if (k === 'especies' && Array.isArray(c.especies)) v = c.especies.join(', ');
        if (v !== undefined && v !== null && String(v) !== '') {
          html += `<tr><th>${esc(prettyKey(k))}</th><td>${k.startsWith('fecha') ? fmtDate(v) : esc(v)}</td></tr>`;
        }
      });
      html += `</tbody></table>`;

      const rows = [];
      ORDER_DET.forEach(k => {
        const v = plan[k];
        if (v !== undefined && v !== null && String(v) !== '') rows.push([k, v]);
      });
      Object.keys(plan)
        .filter(k => !ORDER_DET.includes(k) && plan[k] !== '' && plan[k] != null)
        .sort()
        .forEach(k => rows.push([k, plan[k]]));

      if (rows.length) {
        html += `<h6 style="margin-top:1.5em;">Detalles</h6><table class="striped"><tbody>`;
        rows.forEach(([k, v]) => {
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
          const latStr = Number.isFinite(lat) ? Number(lat).toFixed(6) : esc(lat ?? '');
          const lngStr = Number.isFinite(lng) ? Number(lng).toFixed(6) : esc(lng ?? '');
          html += `<tr><td>${i + 1}</td><td>${latStr}</td><td>${lngStr}</td></tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<div class="grey-text" style="margin-top:1em;">Sin coordenadas registradas</div>`;
      }

      try { $('#detallesCentroBody').innerHTML = html; }
      catch (e) {
        console.error('Modal detalles build error:', e);
        $('#detallesCentroBody').innerHTML = `<pre style="white-space:pre-wrap">${esc(JSON.stringify(c, null, 2))}</pre>`;
      }

      const inst = window.M?.Modal?.getInstance(modal) || window.M?.Modal?.init(modal);
      inst?.open();
    } catch (err) {
      console.error(err);
      toast('No se pudieron mostrar los detalles', 'red');
    }
  });
  $t.off('keydown', '.btn-coords').on('keydown', '.btn-coords', keyActivatesClick);

  /* --- Ver en mapa --- */
  $t.off('click', '.btn-view-on-map').on('click', '.btn-view-on-map', async function () {
    const idx = Number(this.dataset.idx);
    if (!Number.isFinite(idx)) return;
    document.querySelector('a[href="#tab-mapa"]')?.click();  // cambia de tab
    await renderMapaAlways(true);
    setTimeout(() => focusCentroInMap(idx), 90);
  });
  $t.off('keydown', '.btn-view-on-map').on('keydown', '.btn-view-on-map', keyActivatesClick);

  /* --- Editar centro --- */
  $t.off('click', '.editar-centro').on('click', '.editar-centro', function () {
    const idx = Number(this.dataset.idx);
    if (!Number.isFinite(idx)) return;
    Estado.currentCentroIdx = idx;

    const modalElem = $('#centroModal');
    const modal = modalElem
      ? (window.M?.Modal?.getInstance(modalElem) || window.M?.Modal?.init(modalElem))
      : null;

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

    try { openEditForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v), idx); modal?.open(); }
    catch (e) { console.error('openEditForm error:', e); toast('No se pudo abrir el editor', 'red'); }
  });
  $t.off('keydown', '.editar-centro').on('keydown', '.editar-centro', keyActivatesClick);

  /* --- Eliminar centro --- */
  $t.off('click', '.eliminar-centro').on('click', '.eliminar-centro', async function () {
    const idx = Number(this.dataset.idx);
    const c = Estado.centros?.[idx];
    if (!c) return;

    const nombreRef = c.proveedor || c.comuna || 'este centro';
    if (!confirm(`¿Eliminar el centro "${nombreRef}"?`)) return;

    try { await deleteCentro(c._id); toast('Centro eliminado', 'green'); await refreshCentros(); }
    catch (e) { console.error(e); toast('No se pudo eliminar el centro', 'red'); }
  });
  $t.off('keydown', '.eliminar-centro').on('keydown', '.eliminar-centro', keyActivatesClick);
}
