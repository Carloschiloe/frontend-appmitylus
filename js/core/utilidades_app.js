// js/core/utilidades_app.js
// Utilidades compartidas para la vista de Centros/Mapa.

export function tabMapaActiva() {
  try {
    const tab = document.getElementById('tab-mapa');
    if (!tab) return false;
    // Visible si no está display:none y es “renderizable” en el flujo
    return getComputedStyle(tab).display !== 'none' && tab.offsetParent !== null;
  } catch {
    return false;
  }
}

/**
 * Hash estable de la lista de centros para evitar re-renders innecesarios.
 * - Considera: name/proveedor, code, comuna y la cantidad + coords redondeadas.
 * - Ignora orden de propiedades y valores undefined.
 */
export function hashCentros(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '0';
  try {
    const norm = arr.map((c, i) => {
      const name = (c.name || c.proveedor || '').toString();
      const code = (c.code || '').toString();
      const comuna = (c.comuna || c?.detalles?.comuna || '').toString();
      const coords = Array.isArray(c.coords) ? c.coords.map(p => [
        // redondeo a 6 decimales para estabilidad
        (p && p.lat != null) ? Number(p.lat).toFixed(6) : '',
        (p && p.lng != null) ? Number(p.lng).toFixed(6) : ''
      ]) : [];
      return `${name}|${code}|${comuna}|${coords.length}|${JSON.stringify(coords)}`;
    });
    // Unimos con separador difícil de colisionar y hacemos un hash simple
    const s = norm.join('§§');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0; // int32
    }
    return String(h >>> 0);
  } catch {
    // Fallback conservador
    return String(Date.now());
  }
}

/**
 * Actualiza icono/texto/aria del botón fullscreen según el estado actual.
 * Soporta prefijos (webkit/ms) por compatibilidad.
 */
export function actualizarTextoFullscreen(btn, shellEl) {
  if (!btn || !shellEl) return;

  const curFs =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null;

  const enFS = curFs === shellEl;

  if (enFS) {
    btn.innerHTML =
      '<i class="material-icons left" style="line-height:inherit;">fullscreen_exit</i>Salir pantalla completa';
    btn.setAttribute('aria-label', 'Salir de pantalla completa');
  } else {
    btn.innerHTML =
      '<i class="material-icons left" style="line-height:inherit;">fullscreen</i>Pantalla completa';
    btn.setAttribute('aria-label', 'Pantalla completa');
  }
}
