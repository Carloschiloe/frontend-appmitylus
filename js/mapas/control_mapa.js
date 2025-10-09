// js/mapas/control_mapa.js
// Orquestación del mapa (creación única, invalidaciones y re-render)
// Sin dependencias de líneas/inventario.

import { Estado } from '../core/estado.js';
import { hashCentros, tabMapaActiva, actualizarTextoFullscreen } from '../core/utilidades_app.js';
import {
  crearMapa,
  clearMapPoints,
  redrawPolygon,
  addPointMarker,
  focusCentroInMap,
  initSidebarFiltro,
  cargarYRenderizarCentros
} from './mapa.js';

let _mapInitStarted = false;
let _wiredEvents = false;
let _sidebarInit = false;

function invalidateSoon(delay = 60) {
  setTimeout(() => Estado.map?.invalidateSize?.(), delay);
  setTimeout(() => Estado.map?.invalidateSize?.(), delay + 240);
}

function onTabShowInvalidate() {
  invalidateSoon(40);
}

/** Espera a que #map/#tab-mapa tengan altura renderizada (cuando cambian las tabs) */
function waitForMapDom() {
  return new Promise((resolve) => {
    const tryNow = () => {
      const mapEl = document.getElementById('map');
      const tabEl = document.getElementById('tab-mapa');
      const shell = document.getElementById('mapShell');

      const exists = !!mapEl;
      const visibleTab = tabEl ? (getComputedStyle(tabEl).display !== 'none' || tabMapaActiva?.()) : true;
      const hasHeight = shell ? shell.clientHeight > 0 : (mapEl ? mapEl.clientHeight > 0 : false);

      if (exists && (visibleTab || hasHeight)) {
        resolve(true);
        return;
      }
      requestAnimationFrame(tryNow);
    };
    tryNow();
  });
}

function wireGlobalEventsOnce() {
  if (_wiredEvents) return;
  _wiredEvents = true;

  const tabEl = document.getElementById('tab-mapa');
  if (tabEl) {
    // Observa cambios de estilo/clase para invalidar el mapa al mostrar pestaña
    const mo = new MutationObserver(onTabShowInvalidate);
    mo.observe(tabEl, { attributes: true, attributeFilter: ['style', 'class'] });
    // Guarda el observer por si necesitas desconectarlo en el futuro
    tabEl._mapMo = mo;
  }
  window.addEventListener('resize', onTabShowInvalidate, { passive: true });

  // Compat: si navegas con hash a la pestaña del mapa
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tab-mapa') onTabShowInvalidate();
  });

  // Clicks a <a href="#tab-mapa">
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a =>
    a.addEventListener('click', onTabShowInvalidate)
  );
}

/* ============================
   Fullscreen robusto para el mapa
   ============================ */
function wireFullscreenOnce() {
  const fsBtn = document.getElementById('btnFullscreenMapa');
  const shell = document.getElementById('mapShell');
  if (!fsBtn || !shell) return;

  // helpers con prefijos
  const fsElement = () =>
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement;

  const isFSFor = (el) => {
    const cur = fsElement();
    return cur === el || (el && cur && el.contains(cur));
  };

  const requestFS = async (el) => {
    try {
      if (el.requestFullscreen) return await el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
      if (el.msRequestFullscreen) return el.msRequestFullscreen();
    } catch (e) { console.warn('Fullscreen error:', e); }
  };

  const exitFS = async () => {
    try {
      if (document.exitFullscreen) return await document.exitFullscreen();
      if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
      if (document.msExitFullscreen) return document.msExitFullscreen();
    } catch (e) { console.warn('Exit FS error:', e); }
  };

  const onFSChange = () => {
    try { actualizarTextoFullscreen(fsBtn, shell); } catch {}
    invalidateSoon(50);   // Leaflet reflow
    invalidateSoon(350);  // segundo “golpecito”
  };

  if (!fsBtn.dataset._wired) {
    fsBtn.dataset._wired = '1';
    fsBtn.addEventListener('click', () => {
      if (!fsElement()) {
        requestFS(shell);
      } else if (isFSFor(shell)) {
        exitFS();
      } else {
        requestFS(shell);
      }
    });

    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('MSFullscreenChange', onFSChange);
  }

  // Estado inicial del texto/ícono del botón
  try { actualizarTextoFullscreen(fsBtn, shell); } catch {}

  // Atajo teclado "f" solo si está activa la pestaña y no escribes en inputs
  if (!document.body.dataset._mapKeyWired) {
    document.body.dataset._mapKeyWired = '1';
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
      if (typing) return;
      if ((e.key || '').toLowerCase() === 'f' && tabMapaActiva?.()) fsBtn?.click();
    });
  }
}

async function ensureMapCreated() {
  if (_mapInitStarted && Estado.map) return Estado.map;
  _mapInitStarted = true;

  await waitForMapDom();

  // Crear mapa (idempotente en crearMapa)
  Estado.map = crearMapa(Estado.defaultLatLng);
  if (!Estado.map) {
    await new Promise(r => setTimeout(r, 60));
    Estado.map = crearMapa(Estado.defaultLatLng);
  }
  if (!Estado.map) return null;

  // Cerrar popups al hacer click fuera de polígonos
  if (!Estado.map._nerdClickWired) {
    Estado.map._nerdClickWired = true;
    Estado.map.on('click', (e) => {
      try {
        // @ts-ignore (SVGPathElement puede no existir en algunos navegadores)
        if (!(e?.originalEvent?.target instanceof SVGPathElement)) {
          Estado.map.closePopup();
        }
      } catch { Estado.map.closePopup(); }
    });
  }

  wireGlobalEventsOnce();
  wireFullscreenOnce();

  // Sidebar filtro (una vez, pero después del primer render)
  if (!_sidebarInit) {
    _sidebarInit = true;
    setTimeout(() => { try { initSidebarFiltro(); } catch {} }, 0);
  }

  // Asegurar tamaño correcto tras crear
  invalidateSoon(40);

  return Estado.map;
}

export async function initMapa() {
  await ensureMapCreated();
}

/**
 * Dibuja los centros si cambiaron (o si force=true).
 * Mantiene el mapa “sano” cuando se activa la pestaña con retardos.
 */
export async function renderMapaAlways(force = false) {
  await ensureMapCreated();
  if (!Estado.map) return;

  const h = hashCentros(Estado.centros);
  if (!force && h === Estado.centrosHashRender) {
    Estado.map.invalidateSize();
    return;
  }
  Estado.centrosHashRender = h;

  // Render + alimentar buscador flotante
  cargarYRenderizarCentros(Estado.centros);

  invalidateSoon(60);
}

// Reexport: helpers usados por el formulario de puntos
export { clearMapPoints, redrawPolygon, addPointMarker, focusCentroInMap };
