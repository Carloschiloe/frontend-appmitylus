// js/centros/eventos_centros.js
import { Estado } from '../core/estado.js';
import {
  updateLinea,
  deleteLinea,
  deleteCentro,
  getCentrosAll,
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { openEditForm } from './form_centros.js';
import { loadCentros } from './tabla_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

/* ===== Utiles ===== */
const $ = (sel, ctx = document) => (ctx.querySelector ? ctx.querySelector(sel) : null);
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

/* Busca el <tr> actual de un centro por data-idx (independiente del orden) */
function trByIdx(idx) {
  const btn = window.$(`#centrosTable .btn-toggle-lineas[data-idx="${idx}"]`);
  return btn.length ? btn.first().closest('tr') : null;
}

/* Re-render del acordeón del centro idx (cierra y vuelve a abrir) */
function reopenAccordion(idx) {
  const $btn = window.$(`#centrosTable .btn-toggle-lineas[data-idx="${idx}"]`);
  if ($btn.length) $btn.first().click().click();
}

/* ============ Registro de eventos de la tabla ============ */
export function registerTablaCentrosEventos() {
  const $t2 = window.$('#centrosTable');

  // --- Modal de Detalles / Coordenadas ---
  $t2.off('click', '.btn-coords').on('click', '.btn-coords', function () {
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
      if (v !== undefined && v !== null && String(v) !== '') {
        orderedRows.push([k, v]);
      }
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

  // --- Abrir/colapsar líneas (acordeón)
  $t2.off('click', '.btn-toggle-lineas').on('click', '.btn-toggle-lineas', function () {
    const idx = +this.dataset.idx;
    const $tr = window.$(this).closest('tr');
    const row = Estado.table.row($tr);

    if (row.child.isShown()) {
      row.child.hide();
      $tr.removeClass('shown');
      Estado.lineAcordionOpen = null;
      return;
    }

    // Cierra otros
    Estado.table.rows().every(function () {
      if (this.child.isShown()) {
        window.$(this.node()).removeClass('shown');
        this.child.hide();
      }
    });

    const lineasHtml = renderAcordeonLineas(idx, Estado.centros, Estado.editingLine);
    row.child(`<div class="child-row-lineas">${lineasHtml}</div>`).show();
    $tr.addClass('shown');
    Estado.lineAcordionOpen = idx;

    const acordeonCont = $tr.next().find('.child-row-lineas')[0];
    if (acordeonCont) {
      const selects = acordeonCont.querySelectorAll('select');
      if (selects.length) window.M?.FormSelect?.init(selects);
      const inputBuscar = acordeonCont.querySelector('#inputBuscarLineas');
      if (inputBuscar) inputBuscar.addEventListener('input', () => filtrarLineas(acordeonCont));
      attachLineasListeners(idx, acordeonCont);
    }
  });

  // --- Editar centro ---
  $t2.off('click', '.editar-centro').on('click', '.editar-centro', function () {
    const idx = +this.dataset.idx;
    Estado.currentCentroIdx = idx;

    const modalElem = $('#centroModal');
    const modal     = modalElem ? (window.M?.Modal?.getInstance(modalElem) || window.M?.Modal?.init(modalElem)) : null;

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
  $t2.off('click', '.eliminar-centro').on('click', '.eliminar-centro', async function () {
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

/* ============ Listeners dentro del acordeón de líneas ============ */
function attachLineasListeners(idx, acordeonCont) {
  const tbody = acordeonCont.querySelector('table.striped tbody');
  if (!tbody) return;

  // Eliminar línea
  tbody.querySelectorAll('.btn-del-line').forEach(btn => {
    btn.onclick = async () => {
      const lineIdx = +btn.dataset.lineIdx;
      const centro = Estado.centros[idx];
      const linea = centro?.lines?.[lineIdx];
      if (!linea) return;
      if (!confirm(`¿Eliminar la línea ${linea.number}?`)) return;

      try {
        await deleteLinea(centro._id, linea._id);
        toast('Línea eliminada', 'green');
        Estado.lineAcordionOpen = idx;
        await refreshCentros();
      } catch (e) {
        console.error(e);
        toast('No se pudo eliminar la línea', 'red');
      }
    };
  });

  // Editar línea
  tbody.querySelectorAll('.btn-edit-line').forEach(btn => {
    btn.onclick = () => {
      Estado.editingLine = { idx, lineIdx: +btn.dataset.lineIdx };
      reopenAccordion(idx);
    };
  });

  // Cancelar edición de línea
  tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
    btn.onclick = () => {
      Estado.editingLine = { idx: null, lineIdx: null };
      reopenAccordion(idx);
    };
  });

  // Guardar edición de línea
  tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
    btn.onclick = async () => {
      const rowEl       = btn.closest('tr');
      const numInput     = rowEl.querySelector('.edit-line-num');
      const longInput    = rowEl.querySelector('.edit-line-long');
      const obsInput     = rowEl.querySelector('.edit-line-observaciones');
      const stateInput   = rowEl.querySelector('.edit-line-state');
      const tonsInput    = rowEl.querySelector('.edit-line-tons');
      const unkgInput    = rowEl.querySelector('.edit-line-unKg');
      const rechazoInput = rowEl.querySelector('.edit-line-porcRechazo');
      const rdmtInput    = rowEl.querySelector('.edit-line-rendimiento');

      const centro = Estado.centros[idx];
      const linea  = centro?.lines?.[+btn.dataset.lineIdx];
      if (!centro || !linea) return;

      const num        = (numInput?.value || '').trim();
      const longitud   = longInput?.value.trim() ? parseFloat(longInput.value) : null;
      const observ     = (obsInput?.value || '').trim();
      const state      = stateInput?.value || '';
      const tons       = tonsInput?.value.trim() ? parseFloat(tonsInput.value) : null;
      const unKg       = unkgInput?.value.trim() ? parseFloat(unkgInput.value) : null;
      const porcRech   = rechazoInput?.value.trim() ? parseFloat(rechazoInput.value) : null;
      const rendimiento= rdmtInput?.value.trim() ? parseFloat(rdmtInput.value) : null;

      if (!num || longitud === null || !state) return toast('Completa N° Línea, Longitud y Estado', 'red');
      if ((tonsInput?.value && isNaN(tons)) ||
          (unkgInput?.value && isNaN(unKg)) ||
          (rechazoInput?.value && isNaN(porcRech)) ||
          (rdmtInput?.value && isNaN(rendimiento))) {
        return toast('Revisa los campos numéricos', 'red');
      }

      try {
        await updateLinea(centro._id, linea._id, {
          number:        num,
          longitud,
          observaciones: observ,
          state,
          tons,
          unKg,
          porcRechazo:   porcRech,
          rendimiento
        });
        toast('Línea actualizada', 'green');
        Estado.editingLine = { idx: null, lineIdx: null };
        Estado.lineAcordionOpen = idx;
        reopenAccordion(idx);
        await refreshCentros();
      } catch (e) {
        console.error(e);
        toast('No se pudo actualizar la línea', 'red');
      }
    };
  });

  // Agregar línea nueva
  const formAdd = acordeonCont.querySelector('.form-inline-lineas');
  if (formAdd) {
    formAdd.onsubmit = async (e) => {
      e.preventDefault();
      const numStr      = formAdd.querySelector('.line-num').value.trim();
      const longValStr  = formAdd.querySelector('.line-long').value.trim();
      const obsStr      = formAdd.querySelector('.line-observaciones').value.trim();
      const stateStr    = formAdd.querySelector('.line-state').value;
      const tonsStr2    = formAdd.querySelector('.line-tons').value.trim();
      const unkgStr2    = formAdd.querySelector('.line-unKg').value.trim();
      const rechazoStr2 = formAdd.querySelector('.line-porcRechazo').value.trim();
      const rdmtStr2    = formAdd.querySelector('.line-rendimiento').value.trim();

      const longVal = longValStr === '' ? NaN : parseFloat(longValStr);
      if (!numStr || Number.isNaN(longVal) || !stateStr) return toast('Completa todos los campos obligatorios', 'red');

      const tons2    = tonsStr2    === '' ? 0    : parseFloat(tonsStr2);
      const unkg2    = unkgStr2    === '' ? null : parseFloat(unkgStr2);
      const rechazo2 = rechazoStr2 === '' ? null : parseFloat(rechazoStr2);
      const rdmt2    = rdmtStr2    === '' ? null : parseFloat(rdmtStr2);

      if ((tonsStr2 && isNaN(tons2)) ||
          (unkgStr2 && isNaN(unkg2)) ||
          (rechazoStr2 && isNaN(rechazo2)) ||
          (rdmtStr2 && isNaN(rdmt2))) {
        return toast('Verifica valores numéricos de líneas', 'red');
      }

      try {
        const centro = Estado.centros[idx];
        await import('../core/centros_repo.js').then(m =>
          m.addLinea(centro._id, {
            number:        numStr,
            longitud:      longVal,
            observaciones: obsStr,
            state:         stateStr,
            tons:          tons2,
            unKg:          unkg2,
            porcRechazo:   rechazo2,
            rendimiento:   rdmt2
          })
        );
        formAdd.reset();
        toast('Línea agregada', 'green');
        Estado.lineAcordionOpen = idx;
        reopenAccordion(idx);
        await refreshCentros();
      } catch (e2) {
        console.error(e2);
        toast('No se pudo agregar la línea', 'red');
      }
    };
  }
}

/* --- Filtro para líneas --- */
export function filtrarLineas(contenedor) {
  const cont = contenedor || document;
  const txt  = (cont.querySelector('#inputBuscarLineas')?.value || '').toLowerCase();
  cont.querySelectorAll('table.striped tbody tr').forEach(fila => {
    const num = (fila.cells[0]?.textContent || '').toLowerCase();
    const est = (fila.cells[4]?.textContent || '').toLowerCase();
    fila.style.display = (num.includes(txt) || est.includes(txt)) ? '' : 'none';
  });
}
