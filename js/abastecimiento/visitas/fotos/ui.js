// /js/abastecimiento/visitas/fotos/ui.js
import * as fotos from './service.js';

let mounted = false;
let pendingFiles = [];

// 🔁 SELECTORES CORREGIDOS: el input real es #visita_fotos_input
const SEL = {
  input:   '#visita_fotos_input',   // ⬅️ input file real
  preview: '#visita_fotos_preview', // pendientes (antes de guardar)
  gallery: '#visita_fotos_gallery', // guardadas (después de guardar)
  btn:     '#btnPickFotos',         // botón visible (opcional)
};

const $ = (s) => document.querySelector(s);

/* =========================================================
   Visor FULLSCREEN (doble click en miniatura)
   ========================================================= */
let viewerEl = null, viewerImg = null;

function ensureViewer(){
  if (viewerEl) return;
  const html = `
    <div class="foto-viewer" id="fotoViewer" role="dialog" aria-modal="true">
      <button class="foto-viewer__close" type="button" aria-label="Cerrar">Cerrar</button>
      <img id="fotoViewerImg" alt="Foto" />
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  viewerEl  = document.getElementById('fotoViewer');
  viewerImg = document.getElementById('fotoViewerImg');

  const closeViewer = () => viewerEl.classList.remove('open');
  viewerEl.querySelector('.foto-viewer__close')?.addEventListener('click', closeViewer);
  // Click en fondo cierra
  viewerEl.addEventListener('click', (e) => { if (e.target === viewerEl) closeViewer(); });
  // ESC cierra
  document.addEventListener('keydown', (e) => {
    if (viewerEl.classList.contains('open') && e.key === 'Escape') closeViewer();
  });
}

function openViewer(src){
  ensureViewer();
  viewerImg.src = src;
  viewerEl.classList.add('open');
}

/* =========================================================
   UI de miniaturas
   ========================================================= */
function thumbHTML(src, title, actions = ''){
  return `
    <div class="foto-item">
      <div class="foto-thumb"><img src="${src}" alt="${title || ''}"></div>
      <div class="foto-meta">
        <span class="trunc" title="${title || ''}">${title || ''}</span>
        <div class="foto-actions">${actions || ''}</div>
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

  // quitar pendientes
  wrap.querySelectorAll('.foto-del-pend').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const idx = Number(a.dataset.idx);
      if (!Number.isNaN(idx)) { pendingFiles.splice(idx,1); renderPending(); }
    });
  });

  // doble click → visor fullscreen
  wrap.addEventListener('dblclick', (e)=>{
    const img = e.target.closest('.foto-thumb img');
    if (img) openViewer(img.src);
  }, { once: true }); // se vuelve a adjuntar en cada render
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

  // eliminar guardadas
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

  // doble click → visor fullscreen
  wrap.addEventListener('dblclick', (e)=>{
    const img = e.target.closest('.foto-thumb img');
    if (img) openViewer(img.src);
  }, { once: true });
}

/* =========================================================
   Montaje de UI
   ========================================================= */
export function mountFotosUIOnce(){
  if (mounted) return; mounted = true;

  const input = $(SEL.input);
  const btn = $(SEL.btn);

  // 1) Cambio en el INPUT correcto ✅
  if (input){
    input.addEventListener('change', ()=>{
      pendingFiles = Array.from(input.files || []);
      renderPending();
    }, { passive: true });
  } else {
    console.warn('[fotos] No se encontró', SEL.input);
  }

  // 2) (Opcional) botón visible dispara el picker
  if (btn && input){
    btn.addEventListener('click', ()=>{
      input.click();
    });
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

