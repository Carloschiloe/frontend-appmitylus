// /js/abastecimiento/visitas/fotos/ui.js
import * as fotos from './service.js';

let mounted = false;
let pendingFiles = [];
let dblBound = false; // evita registrar doble el listener global

const SEL = {
  input:   '#visita_fotos_input',
  preview: '#visita_fotos_preview',
  gallery: '#visita_fotos_gallery',
  btn:     '#btnPickFotos',
};

const $ = (s) => document.querySelector(s);

/* =========================================================
   Visor overlay + Fullscreen API
   ========================================================= */
let viewerEl = null, viewerImg = null, closeBtn = null;

function buildViewer(){
  if (viewerEl) return;
  viewerEl = document.createElement('div');
  viewerEl.className = 'foto-viewer';
  viewerEl.innerHTML = `
    <img alt="Foto" />
    <button type="button" class="fv-close" aria-label="Cerrar">Cerrar ✕</button>
  `;
  document.body.appendChild(viewerEl);
  viewerImg = viewerEl.querySelector('img');
  closeBtn  = viewerEl.querySelector('.fv-close');

  const close = () => {
    viewerEl.classList.remove('open');
    document.body.classList.remove('viewer-open');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(()=>{});
    }
  };

  // Cerrar con X
  closeBtn.addEventListener('click', close);
  // Cerrar al clicar fuera de la imagen
  viewerEl.addEventListener('click', (e) => { if (e.target === viewerEl) close(); });
  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (viewerEl.classList.contains('open') && e.key === 'Escape') close();
  });
  // Si el usuario sale de fullscreen con ESC, quitamos el overlay
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && viewerEl.classList.contains('open')) {
      viewerEl.classList.remove('open');
      document.body.classList.remove('viewer-open');
    }
  });
}

async function openViewer(src){
  buildViewer();
  viewerImg.src = src;
  viewerEl.classList.add('open');
  document.body.classList.add('viewer-open');

  // Intentar Fullscreen (mejor experiencia). Si falla, queda el overlay.
  if (viewerEl.requestFullscreen) {
    try { await viewerEl.requestFullscreen(); } catch {}
  }
}

/* =========================================================
   Doble click global (sirve aunque se re-renderice el grid)
   ========================================================= */
function bindGlobalDblClick(){
  if (dblBound) return; dblBound = true;
  document.addEventListener('dblclick', (e) => {
    const img = e.target.closest('#visita_fotos_preview img, #visita_fotos_gallery img');
    if (!img) return;
    e.preventDefault();
    openViewer(img.currentSrc || img.src);
  }, true); // captura para adelantarnos a otros handlers
}

/* =========================================================
   UI de miniaturas
   ========================================================= */
function thumbHTML(src, title, actions=''){
  return `
    <div class="foto-item" data-src="${src}">
      <div class="foto-thumb"><img src="${src}" alt="${title||''}"></div>
      <div class="foto-meta">
        <span class="trunc" title="${title||''}">${title||''}</span>
        <div class="foto-actions">${actions||''}</div>
      </div>
    </div>`;
}

function renderPending(){
  const wrap = $(SEL.preview); if (!wrap) return;
  if (!pendingFiles.length) return wrap.replaceChildren();
  wrap.innerHTML = pendingFiles.map((f,i)=> thumbHTML(
    URL.createObjectURL(f), f.name,
    `<a href="#!" class="foto-del-pend" data-idx="${i}" title="Quitar"><i class="material-icons">close</i></a>`
  )).join('');

  wrap.querySelectorAll('.foto-del-pend').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const idx = Number(a.dataset.idx);
      if (!Number.isNaN(idx)) { pendingFiles.splice(idx,1); renderPending(); }
    });
  });
}

export async function renderGallery(visitId){
  const wrap = $(SEL.gallery); if (!wrap) return;
  if (!visitId) return wrap.replaceChildren();
  const list = await fotos.list(visitId);
  if (!list.length) return wrap.replaceChildren();
  wrap.innerHTML = list.map(item => thumbHTML(
    item.dataURL, item.name,
    `<a href="#!" class="foto-del" data-id="${item.id}" title="Eliminar"><i class="material-icons">delete</i></a>`
  )).join('');

  wrap.querySelectorAll('.foto-del').forEach(a=>{
    a.addEventListener('click', async (e)=>{
      e.preventDefault();
      const id = a.dataset.id; if (!id) return;
      if (!confirm('¿Eliminar esta foto?')) return;
      await fotos.remove(visitId, id);
      await renderGallery(visitId);
      M.toast?.({ html: 'Foto eliminada', displayLength: 1400 });
    });
  });
}

/* =========================================================
   Montaje
   ========================================================= */
export function mountFotosUIOnce(){
  if (mounted) return; mounted = true;

  buildViewer();         // tener el overlay listo
  bindGlobalDblClick();  // un solo listener global

  const input = $(SEL.input);
  const btn = $(SEL.btn);

  if (input){
    input.addEventListener('change', ()=>{
      pendingFiles = Array.from(input.files || []);
      renderPending();
    }, { passive: true });
  } else {
    console.warn('[fotos] No se encontró', SEL.input);
  }

  if (btn && input){
    btn.addEventListener('click', ()=> input.click());
  }
}

/* =========================================================
   Utilidades públicas
   ========================================================= */
export function resetFotosModal(){
  pendingFiles = [];
  $(SEL.preview)?.replaceChildren();
  $(SEL.gallery)?.replaceChildren();
  const input = $(SEL.input);
  if (input) input.value = '';
}

export async function handleFotosAfterSave(visitId){
  if (!visitId) return;
  if (pendingFiles.length){
    try {
      await fotos.upload(visitId, pendingFiles);
      pendingFiles = [];
      const input = $(SEL.input); if (input) input.value = '';
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

