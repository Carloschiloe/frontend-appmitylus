// /js/abastecimiento/visitas/fotos/ui.js
import * as fotos from './service.js';

let mounted = false;
let pendingFiles = [];

// Selectores
const SEL = {
  input: '#visita_fotos_input',
  preview: '#visita_fotos_preview',
  gallery: '#visita_fotos_gallery',
  btn: '#btnPickFotos',
};

const $ = (s) => document.querySelector(s);

/* ========= HTML de thumbnails ========= */
function thumbHTML(src, title, actions = '') {
  return `
    <div class="foto-item">
      <div class="foto-thumb" data-full="${src}">
        <img src="${src}" alt="${title || ''}">
      </div>
      <div class="foto-meta">
        <span class="trunc" title="${title || ''}">${title || ''}</span>
        <div class="foto-actions">${actions || ''}</div>
      </div>
    </div>`;
}

/* ========= Render pendientes ========= */
function renderPending() {
  const wrap = $(SEL.preview);
  if (!wrap) return;
  if (!pendingFiles.length) return wrap.replaceChildren();
  wrap.innerHTML = pendingFiles
    .map((f, i) =>
      thumbHTML(
        URL.createObjectURL(f),
        f.name,
        `<a href="#!" class="foto-del-pend" data-idx="${i}" title="Quitar"><i class="material-icons">close</i></a>`
      )
    )
    .join('');
  wrap.querySelectorAll('.foto-del-pend').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = Number(a.dataset.idx);
      if (!Number.isNaN(idx)) {
        pendingFiles.splice(idx, 1);
        renderPending();
      }
    });
  });
}

/* ========= Render fotos guardadas ========= */
export async function renderGallery(visitId) {
  const wrap = $(SEL.gallery);
  if (!wrap) return;
  if (!visitId) return wrap.replaceChildren();

  const list = await fotos.list(visitId);
  if (!list.length) return wrap.replaceChildren();

  wrap.innerHTML = list
    .map((item) =>
      thumbHTML(
        item.dataURL,
        item.name,
        `<a href="#!" class="foto-del" data-id="${item.id}" title="Eliminar"><i class="material-icons">delete</i></a>`
      )
    )
    .join('');

  // Eliminar fotos
  wrap.querySelectorAll('.foto-del').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = a.dataset.id;
      if (!id) return;
      if (!confirm('¿Eliminar esta foto?')) return;
      await fotos.remove(visitId, id);
      await renderGallery(visitId);
      M.toast?.({ html: 'Foto eliminada', displayLength: 1400 });
    });
  });

  // Doble click para abrir fullscreen
  wrap.querySelectorAll('.foto-thumb').forEach((thumb) => {
    thumb.addEventListener('dblclick', () => {
      const src = thumb.dataset.full;
      openFotoViewer(src);
    });
  });
}

/* ========= Montar UI ========= */
export function mountFotosUIOnce() {
  if (mounted) return;
  mounted = true;

  const input = $(SEL.input);
  const btn = $(SEL.btn);

  if (input) {
    input.addEventListener(
      'change',
      () => {
        pendingFiles = Array.from(input.files || []);
        renderPending();
      },
      { passive: true }
    );
  }

  if (btn && input) {
    btn.addEventListener('click', () => {
      input.click();
    });
  }

  // Cerrar visor con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFotoViewer();
  });
}

/* ========= Reset modal ========= */
export function resetFotosModal() {
  pendingFiles = [];
  $(SEL.preview)?.replaceChildren();
  $(SEL.gallery)?.replaceChildren();
  const input = $(SEL.input);
  if (input) input.value = '';
}

/* ========= Subida tras guardar ========= */
export async function handleFotosAfterSave(visitId) {
  if (!visitId) return;
  if (pendingFiles.length) {
    try {
      await fotos.upload(visitId, pendingFiles);
      pendingFiles = [];
      const input = $(SEL.input);
      if (input) input.value = '';
      $(SEL.preview)?.replaceChildren();
      await renderGallery(visitId);
      M.toast?.({ html: 'Fotos subidas', classes: 'teal', displayLength: 1600 });
    } catch (e) {
      console.warn('[fotos] upload error', e);
      M.toast?.({ html: 'No se pudieron subir las fotos', classes: 'red' });
    }
  } else {
    await renderGallery(visitId);
  }
}

/* ========= Visor fullscreen ========= */
function openFotoViewer(src) {
  let viewer = document.querySelector('.foto-viewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.className = 'foto-viewer';
    viewer.innerHTML = `
      <img src="${src}">
      <button class="foto-viewer__close">×</button>
    `;
    document.body.appendChild(viewer);
  } else {
    viewer.querySelector('img').src = src;
  }

  viewer.classList.add('open');
  document.body.classList.add('viewer-open');

  viewer.querySelector('.foto-viewer__close').onclick = closeFotoViewer;
  viewer.onclick = (e) => {
    if (e.target === viewer) closeFotoViewer();
  };
}

function closeFotoViewer() {
  const viewer = document.querySelector('.foto-viewer');
  if (viewer) {
    viewer.classList.remove('open');
    document.body.classList.remove('viewer-open');
  }
}
