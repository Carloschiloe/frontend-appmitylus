// js/centros/eventos_centros.js
import { Estado } from '../core/estado.js';
import {
  updateLinea,
  deleteLinea,
  deleteCentro,
  getCentrosAll,     // ← para refrescar desde API
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { openEditForm } from './form_centros.js';
import { loadCentros } from './tabla_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

// Helper: Capitaliza tipo título
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Refresca tabla + mapa desde API (evita depender de app.js)
async function refreshCentros() {
  try {
    Estado.centros = await getCentrosAll();
    loadCentros(Estado.centros);
    if (tabMapaActiva()) renderMapaAlways(true);
  } catch (e) {
    console.error('Error refrescando centros:', e);
    window.M?.toast?.({ html: 'Error refrescando centros', classes: 'red' });
  }
}

// Registra todos los eventos de la tabla de centros
export function registerTablaCentrosEventos() {
  const $t2 = window.$('#centrosTable');

  // --- Mostrar detalles (y coordenadas) en modal ---
  $t2
    .off('click', '.btn-coords')
    .on('click', '.btn-coords', function () {
      const idx   = +this.dataset.idx;
      const c     = Estado.centros[idx];
      const modal = document.getElementById('modalDetallesCentro');
      const body  = document.getElementById('detallesCentroBody');
      if (!c || !modal || !body) return;

      // Alineado al importador: varios campos son top-level (NO en detalles)
      // - region, ubicacion, grupoEspecie, especies[], codigoArea, tonsMax
      // En detalles vienen objetos: detalles.resSSP{numero,fecha}, detalles.resSSFFAA{numero,fecha}
      const d = (c.detalles && typeof c.detalles === 'object') ? c.detalles : {};
      const dFlat = { ...d };
      if (d.resSSP) {
        if (d.resSSP.numero) dFlat.numeroResSSP = d.resSSP.numero;
        if (d.resSSP.fecha)  dFlat.fechaResSSP  = d.resSSP.fecha;
      }
      if (d.resSSFFAA) {
        if (d.resSSFFAA.numero) dFlat.numeroResSSFFAA = d.resSSFFAA.numero;
        if (d.resSSFFAA.fecha)  dFlat.fechaResSSFFAA  = d.resSSFFAA.fecha;
      }

      const LABELS = {
        region: 'Región',
        codigoArea: 'Código Área',
        ubicacion: 'Ubicación',
        grupoEspecie: 'Grupo Especie',
        especies: 'Especies',
        tonsMax: 'Tons Máx',
        // de detalles “aplanados”
        numeroResSSP: 'N° ResSSP',
        fechaResSSP: 'Fecha ResSSP',
        numeroResSSFFAA: 'N° ResSSFFAA',
        fechaResSSFFAA: 'Fecha ResSSFFAA',
        rutTitular: 'RUT Titular',
        nroPert: 'Nro. Pert',
      };
      const ORDER_TOP = [
        'region','codigoArea','ubicacion','grupoEspecie','especies','tonsMax'
      ];
      const ORDER_DET = [
        'rutTitular','nroPert',
        'numeroResSSP','fechaResSSP',
        'numeroResSSFFAA','fechaResSSFFAA',
      ];

      const prettyKey = k =>
        LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase());

      const fmtDate = v => {
        if (!v) return '';
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
      };

      // DATOS PRINCIPALES
      let html = `<table class="striped"><tbody>
        <tr><th>Proveedor</th><td>${toTitleCase(c.proveedor || '')}</td></tr>
        <tr><th>Comuna</th><td>${toTitleCase(c.comuna || '')}</td></tr>
        <tr><th>Código</th><td>${c.code || ''}</td></tr>
        <tr><th>Hectáreas</th><td>${(c.hectareas ?? '')}</td></tr>
      `;

      // Agrega top-level extra si existen
      ORDER_TOP.forEach(k => {
        let v = c[k];
        if (k === 'especies' && Array.isArray(c.especies)) v = c.especies.join(', ');
        if (v !== undefined && v !== null && String(v) !== '') {
          html += `<tr><th>${prettyKey(k)}</th><td>${k.startsWith('fecha') ? fmtDate(v) : v}</td></tr>`;
        }
      });
      html += `</tbody></table>`;

      // DETALLES EXTRAS (ordenado + etiquetas)
      const orderedRows = [];
      ORDER_DET.forEach(k => {
        const v = dFlat[k];
        if (v !== undefined && v !== null && String(v) !== '') {
          orderedRows.push([k, (k.startsWith('fecha') ? fmtDate(v) : v)]);
        }
      });
      // Cualquier otra clave no contemplada
      Object.keys(dFlat)
        .filter(k => !ORDER_DET.includes(k) && dFlat[k] !== '' && dFlat[k] != null)
        .sort()
        .forEach(k => orderedRows.push([k, dFlat[k]]));

      if (orderedRows.length) {
        html += `<h6 style="margin-top:1.5em;">Detalles</h6>
          <table class="striped"><tbody>`;
        orderedRows.forEach(([k, v]) => {
          html += `<tr><th>${prettyKey(k)}</th><td>${v}</td></tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<div class="grey-text" style="margin-top:1em;">Sin detalles adicionales</div>`;
      }

      // COORDENADAS
      if (Array.isArray(c.coords) && c.coords.length) {
        html += `<h6 style="margin-top:1.5em;">Coordenadas</h6>
          <table class="striped">
            <thead><tr><th>#</th><th>Latitud</th><th>Longitud</th></tr></thead>
            <tbody>`;
        c.coords.forEach((p, i) => {
          const { lat, lng } = p || {};
          const latStr = Number.isFinite(lat) ? lat.toFixed(6) : (lat ?? '');
          const lngStr = Number.isFinite(lng) ? lng.toFixed(6) : (lng ?? '');
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

  // --- Abrir/colapsar líneas (acordeón) ---
  $t2
    .off('click', '.btn-toggle-lineas')
    .on('click', '.btn-toggle-lineas', function () {
      const idx = +this.dataset.idx;
      const tr = $(this).closest('tr');
      const row = Estado.table.row(tr);

      if (row.child.isShown()) {
        row.child.hide();
        tr.removeClass('shown');
        Estado.lineAcordionOpen = null;
        return;
      }

      // Cierra otros child abiertos
      Estado.table.rows().every(function () {
        if (this.child.isShown()) {
          $(this.node()).removeClass('shown');
          this.child.hide();
        }
      });

      const lineasHtml = renderAcordeonLineas(idx, Estado.centros, Estado.editingLine);
      row.child(`<div class="child-row-lineas">${lineasHtml}</div>`).show();
      tr.addClass('shown');
      Estado.lineAcordionOpen = idx;

      const acordeonCont = tr.next().find('.child-row-lineas')[0];
      if (acordeonCont) {
        const selects = acordeonCont.querySelectorAll('select');
        if (selects.length) window.M?.FormSelect?.init(selects);

        const inputBuscar = acordeonCont.querySelector('#inputBuscarLineas');
        if (inputBuscar) inputBuscar.addEventListener('input', () => filtrarLineas(acordeonCont));

        attachLineasListeners(idx, acordeonCont);
      }
    });

  // --- Editar centro ---
  $t2
    .off('click', '.editar-centro')
    .on('click', '.editar-centro', function () {
      const idx = +this.dataset.idx;
      Estado.currentCentroIdx = idx;

      const modalElem = document.getElementById('centroModal');
      const modal     = modalElem ? (window.M?.Modal?.getInstance(modalElem) || window.M?.Modal?.init(modalElem)) : null;

      const els = {
        formTitle:      document.getElementById('formTitle'),
        inputCentroId:  document.getElementById('inputCentroId'),
        inputProveedor: document.getElementById('inputProveedor'),
        inputComuna:    document.getElementById('inputComuna'),
        inputCode:      document.getElementById('inputCode'),
        inputHectareas: document.getElementById('inputHectareas'),
        inputLat:       document.getElementById('inputLat'),
        inputLng:       document.getElementById('inputLng'),
        pointsBody:     document.getElementById('pointsBody')
      };

      openEditForm(
        els,
        Estado.map,
        Estado.currentPoints,
        v => (Estado.currentCentroIdx = v),
        idx
      );

      modal?.open();
    });

  // --- Eliminar centro ---
  $t2
    .off('click', '.eliminar-centro')
    .on('click', '.eliminar-centro', async function () {
      const idx = +this.dataset.idx;
      const c = Estado.centros[idx];
      if (!c) return;

      const nombreRef = c.proveedor || c.comuna || 'este centro';
      if (confirm(`¿Eliminar el centro "${nombreRef}"?`)) {
        await deleteCentro(c._id);
        await refreshCentros(); // ← refresca desde API y re-renderiza
      }
    });
}

// ============ LISTENERS DE LÍNEAS DENTRO DEL ACORDEÓN ============
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
      if (confirm(`¿Eliminar la línea ${linea.number}?`)) {
        await deleteLinea(centro._id, linea._id);
        await refreshCentros();
      }
    };
  });

  // Editar línea
  tbody.querySelectorAll('.btn-edit-line').forEach(btn => {
    btn.onclick = () => {
      Estado.editingLine = { idx, lineIdx: +btn.dataset.lineIdx };
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').click().click();
    };
  });

  // Cancelar edición de línea
  tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
    btn.onclick = () => {
      Estado.editingLine = { idx: null, lineIdx: null };
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').click().click();
    };
  });

  // Guardar edición de línea
  tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
    btn.onclick = async () => {
      const trFila       = btn.closest('tr');
      const numInput     = trFila.querySelector('.edit-line-num');
      const longInput    = trFila.querySelector('.edit-line-long');
      const obsInput     = trFila.querySelector('.edit-line-observaciones');
      const stateInput   = trFila.querySelector('.edit-line-state');
      const tonsInput    = trFila.querySelector('.edit-line-tons');
      const unkgInput    = trFila.querySelector('.edit-line-unKg');
      const rechazoInput = trFila.querySelector('.edit-line-porcRechazo');
      const rdmtInput    = trFila.querySelector('.edit-line-rendimiento');

      const centro = Estado.centros[idx];
      const linea  = centro?.lines?.[+btn.dataset.lineIdx];

      const num        = numInput?.value.trim() || '';
      const longitud   = longInput?.value.trim() ? parseFloat(longInput.value) : null;
      const observ     = obsInput?.value.trim() || '';
      const state      = stateInput?.value || '';
      const tons       = tonsInput?.value.trim() ? parseFloat(tonsInput.value) : null;
      const unKg       = unkgInput?.value.trim() ? parseFloat(unkgInput.value) : null;
      const porcRech   = rechazoInput?.value.trim() ? parseFloat(rechazoInput.value) : null;
      const rendimiento= rdmtInput?.value.trim() ? parseFloat(rdmtInput.value) : null;

      // Validaciones
      if (!num || longitud === null || !state) {
        window.M?.toast?.({ html: 'Completa N° Línea, Longitud y Estado', classes: 'red' });
        return;
      }
      if (
        (tonsInput?.value && isNaN(tons)) ||
        (unkgInput?.value && isNaN(unKg)) ||
        (rechazoInput?.value && isNaN(porcRech)) ||
        (rdmtInput?.value && isNaN(rendimiento))
      ) {
        window.M?.toast?.({ html: 'Revisa los campos numéricos', classes: 'red' });
        return;
      }

      await updateLinea(centro._id, linea._id, {
        number:        num,
        longitud,
        observaciones: observ,
        state,
        tons,
        unKg,
        porcRechazo:  porcRech,
        rendimiento
      });

      Estado.editingLine = { idx: null, lineIdx: null };
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').click().click();
      await refreshCentros();
    };
  });

  // Agregar línea nueva
  const formAdd = acordeonCont.querySelector('.form-inline-lineas');
  if (formAdd) {
    formAdd.onsubmit = async (e) => {
      e.preventDefault();
      const numStr       = formAdd.querySelector('.line-num').value.trim();
      const longVal      = parseFloat(formAdd.querySelector('.line-long').value);
      const obsStr       = formAdd.querySelector('.line-observaciones').value.trim();
      const stateStr     = formAdd.querySelector('.line-state').value;
      const tonsStr2     = formAdd.querySelector('.line-tons').value.trim();
      const unkgStr2     = formAdd.querySelector('.line-unKg').value.trim();
      const rechazoStr2  = formAdd.querySelector('.line-porcRechazo').value.trim();
      const rdmtStr2     = formAdd.querySelector('.line-rendimiento').value.trim();

      if (!numStr || isNaN(longVal) || !stateStr) {
        window.M?.toast?.({ html: 'Completa todos los campos obligatorios', classes: 'red' });
        return;
      }

      const tons2     = tonsStr2 === '' ? 0 : parseFloat(tonsStr2);
      const unkg2     = unkgStr2 === '' ? null : parseFloat(unkgStr2);
      const rechazo2  = rechazoStr2 === '' ? null : parseFloat(rechazoStr2);
      const rdmt2     = rdmtStr2 === '' ? null : parseFloat(rdmtStr2);

      if ((tonsStr2 && isNaN(tons2)) ||
          (unkgStr2 && isNaN(unkg2)) ||
          (rechazoStr2 && isNaN(rechazo2)) ||
          (rdmtStr2 && isNaN(rdmt2))) {
        window.M?.toast?.({ html: 'Verifica valores numéricos de líneas', classes: 'red' });
        return;
      }

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
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').click().click();
      await refreshCentros();
    };
  }
}

// --- Filtro para líneas ---
export function filtrarLineas(contenedor) {
  const cont = contenedor || document;
  const txt  = (cont.querySelector('#inputBuscarLineas')?.value || '').toLowerCase();
  cont.querySelectorAll('table.striped tbody tr').forEach(fila => {
    const num = (fila.cells[0]?.textContent || '').toLowerCase();
    const est = (fila.cells[4]?.textContent || '').toLowerCase();
    fila.style.display = num.includes(txt) || est.includes(txt) ? '' : 'none';
  });
}
