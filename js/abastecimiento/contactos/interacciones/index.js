// Monta la vista Interacciones cuando se abre la pestaña (lazy)
import { mountInteracciones } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const tabAnchor = document.querySelector('a[href="#tab-interacciones"]');
  const tabDiv   = document.getElementById('tab-interacciones');
  if (!tabAnchor || !tabDiv) return;

  tabAnchor.addEventListener('click', () => {
    tabDiv.style.display = 'block';
    const root = document.getElementById('interacciones-root');
    if (!root) return;
    if (!root.dataset.mounted){
      mountInteracciones(root);
      root.dataset.mounted = '1';
    }
  });
});
