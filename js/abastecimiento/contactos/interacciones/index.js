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
  const tabAnchor = document.querySelector('a[href="#tab-interacciones"]');
  const tabDiv = document.getElementById('tab-interacciones');
  if (!tabAnchor || !tabDiv) return;

  // 1) Click en la pestaña: montar una sola vez.
  tabAnchor.addEventListener('click', mountOnce, { once: true });

  // 2) Si llega con hash directo (#tab-interacciones), montar también.
  if (location.hash === '#tab-interacciones') {
    requestAnimationFrame(mountOnce);
  }

  // 3) Al cambiar a otra pestaña, avisar que Interacciones se ocultó.
  const allTabLinks = document.querySelectorAll('.tabs .tab a');
  allTabLinks.forEach((a) => {
    a.addEventListener('click', () => {
      const target = a.getAttribute('href');
      if (target !== '#tab-interacciones') emitTabHide(tabDiv);
    });
  });

  // 4) También cubrir navegación que cambia hash sin click.
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tab-interacciones') mountOnce();
    else emitTabHide(tabDiv);
  });
});
