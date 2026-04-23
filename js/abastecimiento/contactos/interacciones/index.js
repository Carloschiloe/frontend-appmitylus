// Monta la vista de Interacciones cuando se abre la pestaña (lazy)
import { mountInteracciones } from './ui.js';

function mountOnce() {
  const root = document.getElementById('interacciones-root');
  if (!root || root.dataset.mounted === '1') return;
  mountInteracciones(root);
  root.dataset.mounted = '1';
}

function emitTabHide(tabDiv) {
  if (!tabDiv) return;
  tabDiv.dispatchEvent(new Event('mmpp:tab-hide'));
}

document.addEventListener('DOMContentLoaded', () => {
  const tabDiv = document.getElementById('tab-interacciones');
  if (!tabDiv) return;

  // 1) Click en sidebar (legacy anchor) o en el nuevo botón principal
  document.querySelector('a[href="#tab-interacciones"]')
    ?.addEventListener('click', mountOnce);
  document.querySelector('[data-c-tab="tab-interacciones"]')
    ?.addEventListener('click', mountOnce);

  // 2) Click en sub-tab "Registros" dentro de Interacciones
  document.querySelector('[data-inter-tab="inter-registros"]')
    ?.addEventListener('click', mountOnce);

  // 3) Si carga con hash directo
  if (location.hash === '#tab-interacciones' || location.hash === '#inter-registros') {
    requestAnimationFrame(mountOnce);
  }

  // 4) Cubrir navegación por hash
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tab-interacciones') mountOnce();
    else emitTabHide(tabDiv);
  });
});
