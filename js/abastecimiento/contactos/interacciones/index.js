// Monta la vista Interacciones cuando se abre la pestaña (lazy)
import { mountInteracciones } from './ui.js';

function mountOnce() {
  const root = document.getElementById('interacciones-root');
  if (!root || root.dataset.mounted === '1') return;
  mountInteracciones(root);
  root.dataset.mounted = '1';
}

document.addEventListener('DOMContentLoaded', () => {
  const tabAnchor = document.querySelector('a[href="#tab-interacciones"]');
  const tabDiv = document.getElementById('tab-interacciones');
  if (!tabAnchor || !tabDiv) return;

  // 1) Click en la pestaña → montar (una sola vez)
  tabAnchor.addEventListener('click', mountOnce, { once: true });

  // 2) Si llegas con hash directo (#tab-interacciones), montar también
  if (location.hash === '#tab-interacciones') {
    // Espera a que Materialize termine de mostrar las tabs
    setTimeout(mountOnce, 0);
  }

  // 3) Al cambiar a otra pestaña, avisar que Interacciones se “oculta”
  //    (para que el viewer del calendario libere MMppApi, etc.)
  const allTabLinks = document.querySelectorAll('.tabs .tab a');
  allTabLinks.forEach(a => {
    a.addEventListener('click', () => {
      const target = a.getAttribute('href');
      if (target !== '#tab-interacciones' && tabDiv) {
        tabDiv.dispatchEvent(new Event('mmpp:tab-hide'));
      }
    });
  });

  // 4) Por si el hash cambia vía navegación (sin click)
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tab-interacciones') mountOnce();
    else if (tabDiv) tabDiv.dispatchEvent(new Event('mmpp:tab-hide'));
  });
});

