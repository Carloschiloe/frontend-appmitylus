// js/centros/eventos_centros.js — sin líneas, con “Ver en mapa”
import { Estado } from '../core/estado.js';
import { deleteCentro, getCentrosAll } from '../core/centros_repo.js';
import { openEditForm } from './form_centros.js';
import { loadCentros } from './tabla_centros.js';
import { renderMapaAlways, focusCentroInMap } from '../mapas/control_mapa.js';

const toast = (html, classes = '') => window.M?.toast?.({ html, classes });

async function refreshCentros() {
  try {
    Estado.centros = await getCentrosAll();
    await loadCentros(Estado.centros);
    await renderMapaAlways(true);
  } catch (e) {
    console.error('Error refrescando centros:', e);
    toast('Error refrescando centros', 'red');
  }
}

function keyActivatesClick(e){
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.currentTarget?.click?.();
  }
}

export function registerTablaCentrosEventos() {
  const $t = window.$('#centrosTable');
  if (!$t.length) return;

  // Detalles
  $t.off('click', '.btn-coords').on('click', '.btn-coords', function () {
    const idx = Number(this.dataset.idx);
    const c   = Estado.centros?.[idx];
    const modal = document.getElementById('modalDetallesCentro');
    const body  = document.getElementById('detallesCentroBody');
    if (!c || !modal || !body) return;

    // Reutilizamos el mismo HTML de detalles que arma el módulo del mapa:
    import('../mapas/mapa.js').then(mod => {
      body.innerHTML = mod ? (mod.__esModule && mod?.default ? '' : mod.buildCentroDetallesHtml?.(c) || '') : '';
      (window.M?.Modal.getInstance(modal) || window.M?.Modal.init(modal))?.open();
    }).catch(()=>{ /* fallback simple */ 
      body.innerHTML = `<div><b>${c.proveedor||'-'}</b><div>Código: ${c.code||'-'}</div></div>`;
      (window.M?.Modal.getInstance(modal) || window.M?.Modal.init(modal))?.open();
    });
  });
  $t.off('keydown', '.btn-coords').on('keydown', '.btn-coords', keyActivatesClick);

  // Ver en mapa
  $t.off('click', '.btn-ver-mapa').on('click', '.btn-ver-mapa', async function () {
    const idx = Number(this.dataset.idx);
    const tabs = document.getElementById('tabs');
    const inst = tabs ? (window.M?.Tabs?.getInstance(tabs) || window.M?.Tabs?.init(tabs)) : null;
    inst?.select?.('tab-mapa');
    await renderMapaAlways(true);
    focusCentroInMap(idx);
    document.getElementById('mapShell')?.focus?.();
  });
  $t.off('keydown', '.btn-ver-mapa').on('keydown', '.btn-ver-mapa', keyActivatesClick);

  // Editar
  $t.off('click', '.editar-centro').on('click', '.editar-centro', function () {
    const idx = Number(this.dataset.idx);
    Estado.currentCentroIdx = idx;

    const modalElem = document.getElementById('centroModal');
    const modal = modalElem ? (window.M?.Modal?.getInstance(modalElem) || window.M?.Modal?.init(modalElem)) : null;

    const $ = (id)=> document.getElementById(id);
    const els = {
      formTitle:      $('formTitle'),
      inputCentroId:  $('inputCentroId'),
      inputProveedor: $('inputProveedor'),
      inputComuna:    $('inputComuna'),
      inputCode:      $('inputCode'),
      inputHectareas: $('inputHectareas'),
      inputLat:       $('inputLat'),
      inputLng:       $('inputLng'),
      pointsBody:     $('pointsBody'),
    };

    try { openEditForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v), idx); modal?.open(); }
    catch(e){ console.error(e); toast('No se pudo abrir el editor', 'red'); }
  });
  $t.off('keydown', '.editar-centro').on('keydown', '.editar-centro', keyActivatesClick);

  // Eliminar
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
