// js/centros/eventos-centros.js — sin Materialize
import { Estado } from '../core/estado.js';
import { deleteCentro, getCentrosAll } from '../core/centros-repo.js';
import { openEditForm } from './form-centros.js';
import { loadCentros } from './tabla-centros.js';
import { tabMapaActiva } from '../core/utilidades-app.js';
import { renderMapaAlways, focusCentroInMap } from '../mapas/control-mapa.js';
import { toast as uiToast } from '../ui/toast.js';

/* ===== Utils locales ===== */
const $   = (sel, ctx = document) => (ctx.querySelector ? ctx.querySelector(sel) : null);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const SANITARIO_LABELS = { rojo:'Suspendida', naranja:'Alerta activa', amarillo:'En seguimiento', verde:'Sin alertas', gris:'Sin datos' };
const fmtDate = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? esc(s) : d.toISOString().slice(0, 10);
};

function toast(msg, variant = 'success') {
  uiToast(msg, { variant: variant === 'red' ? 'error' : variant });
}

/* Refresca tabla + mapa desde API */
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

/* Accesibilidad: Enter / Espacio activa click */
function keyActivatesClick(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget?.click?.(); }
}

function closeAllCentroMenus() {
  document.querySelectorAll('.centro-row-menu.is-open').forEach((menu) => menu.classList.remove('is-open'));
}

/* ============ Registro de eventos de la tabla ============ */
export function registerTablaCentrosEventos() {
  const $t = window.$('#centrosTable');
  if (!$t.length) return;

  $t.off('click', '.centro-row-menu-toggle').on('click', '.centro-row-menu-toggle', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const menu = this.closest('.centro-row-menu');
    if (!menu) return;
    const willOpen = !menu.classList.contains('is-open');
    closeAllCentroMenus();
    menu.classList.toggle('is-open', willOpen);
  });

  document.removeEventListener('click', closeAllCentroMenus);
  document.addEventListener('click', closeAllCentroMenus);

  /* --- Detalles / Coordenadas --- */
  $t.off('click', '.btn-coords').on('click', '.btn-coords', function () {
    closeAllCentroMenus();
    try {
      const idx = Number(this.dataset.idx);
      const c   = Estado.centros?.[idx];
      const body = $('#detallesCentroBody');
      if (!c || !body) return;

      const d = (c.detalles && typeof c.detalles === 'object') ? c.detalles : {};
      const sanitario = c.sanitario || {};
      const plan = { ...d };
      if (d.resSSP)    { if (d.resSSP.numero)    plan.numeroResSSP    = d.resSSP.numero;    if (d.resSSP.fecha)    plan.fechaResSSP    = d.resSSP.fecha;    }
      if (d.resSSFFAA) { if (d.resSSFFAA.numero)  plan.numeroResSSFFAA = d.resSSFFAA.numero; if (d.resSSFFAA.fecha) plan.fechaResSSFFAA = d.resSSFFAA.fecha; }

      const LABELS = {
        region:'Región', codigoArea:'Código Área', areaPSMB:'Área PSMB', estadoAreaSernapesca:'Estado Sernapesca',
        estadoSanitario:'Estado sanitario', ubicacion:'Ubicación',
        grupoEspecie:'Grupo Especie', especies:'Especies', tonsMax:'Tons Máx',
        numeroResSSP:'N° ResSSP', fechaResSSP:'Fecha ResSSP',
        numeroResSSFFAA:'N° ResSSFFAA', fechaResSSFFAA:'Fecha ResSSFFAA',
        rutTitular:'RUT Titular', nroPert:'Nro. Pert',
      };
      const prettyKey = k => LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase());
      const ORDER_TOP = ['region','codigoArea','areaPSMB','estadoSanitario','estadoAreaSernapesca','ubicacion','grupoEspecie','especies','tonsMax'];
      const ORDER_DET = ['rutTitular','nroPert','numeroResSSP','fechaResSSP','numeroResSSFFAA','fechaResSSFFAA'];

      let html = `<table class="am-table"><tbody>
        <tr><th>Proveedor</th><td>${esc(toTitleCase(c.proveedor || c.name || ''))}</td></tr>
        <tr><th>Comuna</th><td>${esc(toTitleCase(c.comuna || ''))}</td></tr>
        <tr><th>Código de Centro</th><td>${esc(c.code || '')}</td></tr>
        <tr><th>Hectáreas</th><td>${esc(c.hectareas ?? '')}</td></tr>`;

      ORDER_TOP.forEach(k => {
        let v = (c[k] !== undefined && c[k] !== null && String(c[k]) !== '') ? c[k] : plan[k];
        if (k === 'especies' && !v && Array.isArray(c.especies)) v = c.especies.join(', ');
        if (k === 'codigoArea') v = c.codigoArea ?? d.codigoArea ?? v;
        if (k === 'areaPSMB') v = c.areaPSMB ?? sanitario.areaPSMB ?? v;
        if (k === 'estadoSanitario') v = sanitario.estado ? (SANITARIO_LABELS[sanitario.estado] || toTitleCase(sanitario.estado)) : v;
        if (k === 'estadoAreaSernapesca') v = c.estadoAreaSernapesca ?? sanitario.estadoSernapesca ?? v;
        if (v !== undefined && v !== null && String(v) !== '') {
          html += `<tr><th>${esc(prettyKey(k))}</th><td>${k.startsWith('fecha') ? fmtDate(v) : esc(v)}</td></tr>`;
        }
      });
      html += `</tbody></table>`;

      const rows = [];
      ORDER_DET.forEach(k => { const v = plan[k]; if (v !== undefined && v !== null && String(v) !== '') rows.push([k, v]); });
      Object.keys(plan).filter(k => !ORDER_DET.includes(k) && plan[k] !== '' && plan[k] != null).sort().forEach(k => rows.push([k, plan[k]]));

      if (rows.length) {
        html += `<h6 style="margin-top:1.5em;font-weight:700;">Detalles</h6><table class="am-table"><tbody>`;
        rows.forEach(([k, v]) => { html += `<tr><th>${esc(prettyKey(k))}</th><td>${k.startsWith('fecha') ? fmtDate(v) : esc(v)}</td></tr>`; });
        html += `</tbody></table>`;
      } else {
        html += `<p style="margin-top:1em;color:#94a3b8;">Sin detalles adicionales</p>`;
      }

      if (Array.isArray(c.coords) && c.coords.length) {
        html += `<h6 style="margin-top:1.5em;font-weight:700;">Coordenadas</h6>
          <table class="am-table">
            <thead><tr><th>#</th><th>Latitud</th><th>Longitud</th></tr></thead>
            <tbody>`;
        c.coords.forEach((p, i) => {
          const latStr = Number.isFinite(p?.lat) ? Number(p.lat).toFixed(6) : esc(p?.lat ?? '');
          const lngStr = Number.isFinite(p?.lng) ? Number(p.lng).toFixed(6) : esc(p?.lng ?? '');
          html += `<tr><td>${i + 1}</td><td>${latStr}</td><td>${lngStr}</td></tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<p style="color:#94a3b8;margin-top:1em;">Sin coordenadas registradas</p>`;
      }

      body.innerHTML = html;
      window.openDetallesModal?.();

    } catch (err) {
      console.error(err);
      toast('No se pudieron mostrar los detalles', 'red');
    }
  });
  $t.off('keydown', '.btn-coords').on('keydown', '.btn-coords', keyActivatesClick);

  /* --- Ver en mapa --- */
  $t.off('click', '.btn-view-on-map').on('click', '.btn-view-on-map', async function () {
    closeAllCentroMenus();
    const idx = Number(this.dataset.idx);
    if (!Number.isFinite(idx)) return;
    
    // Cambio nativo de pestaña usando el sistema de hash de la aplicación
    location.hash = '#tab-mapa';

    await renderMapaAlways(true);
    setTimeout(() => {
      if (typeof focusCentroInMap === 'function') {
        focusCentroInMap(idx);
      }
    }, 150);
  });
  $t.off('keydown', '.btn-view-on-map').on('keydown', '.btn-view-on-map', keyActivatesClick);

  /* --- Editar centro --- */
  $t.off('click', '.editar-centro').on('click', '.editar-centro', function () {
    closeAllCentroMenus();
    const idx = Number(this.dataset.idx);
    if (!Number.isFinite(idx)) return;
    Estado.currentCentroIdx = idx;

    const els = {
      formTitle:       $('#centroModalTitle'),
      inputCentroId:   $('#inputCentroId'),
      inputProveedor:  $('#inputProveedor'),
      inputComuna:     $('#inputComuna'),
      inputCode:       $('#inputCode'),
      inputCodigoArea: $('#inputCodigoArea'),
      inputHectareas:  $('#inputHectareas'),
      inputLat:        $('#inputLat'),
      inputLng:        $('#inputLng'),
      pointsBody:      $('#pointsBody'),
    };

    try {
      openEditForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v), idx);
      window.openCentroModal?.();
    } catch (e) {
      console.error('openEditForm error:', e);
      toast('No se pudo abrir el editor', 'red');
    }
  });
  $t.off('keydown', '.editar-centro').on('keydown', '.editar-centro', keyActivatesClick);

  /* --- Eliminar centro --- */
  $t.off('click', '.eliminar-centro').on('click', '.eliminar-centro', async function () {
    closeAllCentroMenus();
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
