// /js/abastecimiento/visitas/fotos/ui.js
import * as fotos from './service.js';
import { createModalConfirm } from '../../contactos/ui-common.js';
import { toast } from '../../../ui/toast.js';

// Estado del módulo
let pendingFiles = [];
let currentVisitId = null;

const askDeleteFoto = createModalConfirm({
  id: 'modalConfirmDeleteFotoVisita',
  defaultTitle: 'Eliminar foto',
  defaultMessage: '¿Eliminar esta foto?',
  acceptText: 'Eliminar'
});

// ── Helpers DOM ──────────────────────────────────────────────────────────────

function getInput()    { return document.getElementById('visita_fotos_input'); }
function getDropzone() { return document.getElementById('visita_fotos_dropzone'); }
function getPending()  { return document.getElementById('visita_fotos_pending'); }
function getGallery()  { return document.getElementById('visita_fotos_gallery'); }
function getPendingCount()  { return document.getElementById('visita_fotos_pending_count'); }
function getGalleryCount()  { return document.getElementById('visita_fotos_gallery_count'); }

// ── Render pending (por subir) ───────────────────────────────────────────────

function renderPending() {
  const wrap = getPending();
  const countEl = getPendingCount();
  if (!wrap) return;

  if (!pendingFiles.length) {
    wrap.innerHTML = '';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = `(${pendingFiles.length})`;

  wrap.innerHTML = pendingFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="fv-thumb" data-idx="${i}">
        <div class="fv-img-wrap">
          <img src="${url}" alt="${f.name}">
          <button type="button" class="fv-remove" data-idx="${i}" title="Quitar">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <span class="fv-name">${truncName(f.name)}</span>
        <span class="fv-badge pending">Por subir</span>
      </div>`;
  }).join('');

  wrap.querySelectorAll('.fv-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      if (!Number.isNaN(idx)) {
        // revocar el object URL antes de quitar
        URL.revokeObjectURL(wrap.querySelectorAll('.fv-img-wrap img')[idx]?.src || '');
        pendingFiles.splice(idx, 1);
        renderPending();
      }
    });
  });
}

// ── Render galería (fotos guardadas) ────────────────────────────────────────

export async function renderGallery(visitId) {
  const wrap = getGallery();
  const countEl = getGalleryCount();
  if (!wrap) return;

  currentVisitId = visitId || null;
  if (!visitId) { wrap.innerHTML = ''; if (countEl) countEl.textContent = ''; return; }

  const list = await fotos.list(visitId);

  if (!list.length) {
    wrap.innerHTML = `<p class="fv-empty-saved">Sin fotos guardadas</p>`;
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = `(${list.length})`;

  wrap.innerHTML = list.map(item => `
    <div class="fv-thumb" data-id="${item.id}">
      <div class="fv-img-wrap">
        <img src="${item.dataURL}" alt="${item.name || ''}" loading="lazy">
        <div class="fv-overlay">
          <button type="button" class="fv-view" data-src="${item.dataURL}" title="Ver ampliado">
            <i class="bi bi-fullscreen"></i>
          </button>
          <button type="button" class="fv-del" data-id="${item.id}" title="Eliminar">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
      <span class="fv-name">${truncName(item.name || 'foto')}</span>
    </div>`
  ).join('');

  // Eliminar
  wrap.querySelectorAll('.fv-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      const ok = await askDeleteFoto('Eliminar foto', '¿Eliminar esta foto?', 'Eliminar');
      if (!ok) return;
      btn.closest('.fv-thumb')?.classList.add('fv-removing');
      await fotos.remove(visitId, id);
      await renderGallery(visitId);
      toast('Foto eliminada', { variant: 'success', durationMs: 1400 });
    });
  });

  // Ver ampliado
  wrap.querySelectorAll('.fv-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openViewer(btn.dataset.src);
    });
  });

  // Click en imagen también abre visor
  wrap.querySelectorAll('.fv-img-wrap img').forEach(img => {
    img.addEventListener('click', () => openViewer(img.src));
  });
}

// ── Setup principal (llamar cuando el bloque ya está en el DOM) ─────────────

export function setupFotosUI() {
  const input    = getInput();
  const dropzone = getDropzone();
  if (!input) return;   // bloque aún no montado

  // Escuchar cambio de archivos
  input.addEventListener('change', () => {
    const added = Array.from(input.files || []).filter(f => f.type.startsWith('image/'));
    if (!added.length) return;
    pendingFiles = [...pendingFiles, ...added];
    input.value = '';   // reset para poder seleccionar mismos archivos de nuevo
    renderPending();
  });

  // Dropzone: click abre el input
  if (dropzone) {
    dropzone.addEventListener('click', (e) => {
      // evitar que el click en el botón quitar burbuje hasta aquí
      if (e.target.closest('.fv-remove')) return;
      input.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    ['dragleave', 'dragend'].forEach(ev =>
      dropzone.addEventListener(ev, () => dropzone.classList.remove('is-dragover'))
    );
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      pendingFiles = [...pendingFiles, ...files];
      renderPending();
    });
  }

  // Cerrar visor con Escape
  if (!window.__fotosViewerKeybound) {
    window.__fotosViewerKeybound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeViewer();
    });
  }
}

// ── mountFotosUIOnce: alias de compatibilidad (no hace nada, setupFotosUI lo reemplaza) ──
export function mountFotosUIOnce() { /* llamar setupFotosUI() después de crear el bloque */ }

// ── Reset modal ──────────────────────────────────────────────────────────────

export function resetFotosModal() {
  pendingFiles = [];
  currentVisitId = null;
  getPending()?.replaceChildren();
  getGallery()?.replaceChildren();
  const countP = getPendingCount();
  const countG = getGalleryCount();
  if (countP) countP.textContent = '';
  if (countG) countG.textContent = '';
  const input = getInput();
  if (input) input.value = '';
}

// ── Subida tras guardar ──────────────────────────────────────────────────────

export async function handleFotosAfterSave(visitId) {
  if (!visitId) return;
  const wrap     = getPending();
  const gallery  = getGallery();
  const dropzone = getDropzone();

  if (pendingFiles.length) {
    // Estado de carga visual
    const thumbs = wrap?.querySelectorAll('.fv-thumb') || [];
    thumbs.forEach(t => t.classList.add('fv-uploading'));
    if (dropzone) {
      dropzone.classList.add('fv-dz-uploading');
      dropzone.innerHTML = `<i class="bi bi-arrow-repeat fv-dz-spinner"></i><p class="fv-dz-text">Subiendo ${pendingFiles.length} foto${pendingFiles.length > 1 ? 's' : ''}…</p>`;
    }
    if (gallery) gallery.innerHTML = `<p class="fv-uploading-msg"><i class="bi bi-hourglass-split"></i> Subiendo fotos…</p>`;

    try {
      await fotos.upload(visitId, pendingFiles);
      pendingFiles = [];
      wrap?.replaceChildren();
      const countEl = getPendingCount();
      if (countEl) countEl.textContent = '';
      // Restaurar dropzone
      if (dropzone) {
        dropzone.classList.remove('fv-dz-uploading');
        dropzone.innerHTML = `
          <i class="bi bi-cloud-upload fv-dz-icon"></i>
          <p class="fv-dz-text">Arrastra fotos aquí o <span class="fv-dz-link">selecciona archivos</span></p>
          <p class="fv-dz-hint">JPG, PNG, HEIC · se comprimen automáticamente</p>`;
      }
      await renderGallery(visitId);
      toast('Fotos guardadas', { variant: 'success', durationMs: 1800 });
    } catch (e) {
      console.warn('[fotos] upload error', e);
      thumbs.forEach(t => t.classList.remove('fv-uploading'));
      if (dropzone) dropzone.classList.remove('fv-dz-uploading');
      toast('No se pudieron subir las fotos', { variant: 'error' });
    }
  } else {
    await renderGallery(visitId);
  }
}

// ── Visor fullscreen ─────────────────────────────────────────────────────────

function openViewer(src) {
  let viewer = document.getElementById('fv-viewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'fv-viewer';
    viewer.className = 'fv-viewer';
    viewer.innerHTML = `
      <div class="fv-viewer-backdrop"></div>
      <div class="fv-viewer-content">
        <img src="" alt="Foto visita">
        <button class="fv-viewer-close" title="Cerrar (Esc)">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>`;
    document.body.appendChild(viewer);
    viewer.querySelector('.fv-viewer-backdrop').addEventListener('click', closeViewer);
    viewer.querySelector('.fv-viewer-close').addEventListener('click', closeViewer);
  }
  viewer.querySelector('img').src = src;
  viewer.classList.add('is-open');
  document.body.classList.add('fv-viewer-open');
}

function closeViewer() {
  const viewer = document.getElementById('fv-viewer');
  if (!viewer) return;
  viewer.classList.remove('is-open');
  document.body.classList.remove('fv-viewer-open');
}

// ── Utils ────────────────────────────────────────────────────────────────────

function truncName(name, max = 20) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}
