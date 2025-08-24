import { Estado } from './estado.js';

export const hashCentros = (arr) => arr.map(c => `${c.name}|${(c.coords||[]).length}`).join('§');

export function tabMapaActiva() {
  const a = document.querySelector('#tabs .tab a[href="#tab-mapa"]');
  return a && a.classList.contains('active');
}

export function actualizarTextoFullscreen(btn, shell) {
  if (!btn || !shell) return;
  const enFS = document.fullscreenElement === shell;
  btn.innerHTML = enFS
    ? '<i class="material-icons left" style="line-height:inherit;">fullscreen_exit</i>Salir pantalla completa'
    : '<i class="material-icons left" style="line-height:inherit;">fullscreen</i>Pantalla completa';
}