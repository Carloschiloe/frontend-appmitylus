// /js/abastecimiento/visitas/fotos/ui.js
import * as fotos from './service.js';

let mounted = false;
let pendingFiles = [];
let dblBound = false; // para no registrar dos veces el listener global

// Selectores (input real + contenedores de previews)
const SEL = {
  input:   '#visita_fotos_input',   // input file real
  preview: '#visita_fotos_preview', // pendientes (antes de guardar)
  gallery: '#visita_fotos_gallery', // guardadas (después de guardar)
  btn:     '#btnPickFotos',         // botón visible (opcional)
};

const $ = (s) => document.querySelector(s);

/* =========================================================
   Visor en VENTANA NUEVA (fullscreen sin scroll)
   ========================================================= */
function openViewer(src){
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    alert('Tu navegador bloqueó la ventana emergente. Habilita popups para este sitio.');
    return;
  }
  const safeSrc = String(src || '').replace(/"/g, '&quot;');
  w.document.write(`<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Foto</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#000;}
      .wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;}
      img{max-width:100vw;max-height:100vh;object-fit:contain;display:block}
      .hint{
        position:fixed;left:12px;bottom:10px;color:#bbb;font:14px/1.2 system-ui,Segoe UI,Roboto,Arial;
        background:rgba(255,255,255,.08);padding:6px 10px;border-radius:8px
      }
      .close{
        position:fixed;right:12px;top:10px;color:#eee;font:14px/1.2 system-ui,Segoe UI,Roboto,Arial;
        background:rgba(255,255,255,.12);padding:8px 12px;border-radius:999px;cursor:pointer;user-select:none
      }
      .close:hover{background:rgba(255,255,255,.2)}
    </style>
  </head>
  <body>
    <div class="wrap"><img src="${safeSrc}" alt="Foto"></div>
    <div class="hint">Doble clic o ESC para cerrar</div>
    <div class="close" id="btnClose">Cerrar</div>
    <script>
      const close = () => window.close();
      document.getElementById('btnClose').addEventListener('click', close);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      document.addEventListener('dblclick', close);
    </script>
  </body>
  </html>`);
  w.document.close();
  w.focus();
}

// Listener global en captura para doble click (funciona aunque se re-renderice)
function bindGlobalDblClick(){
  if (dblBound) return; dblBound = true;
  document.addEventListener('dblclick', (e) => {
    const img = e.target.closest('#visita_fotos_preview img, #visita_fotos_gallery img');
    if (!img) return;
    e.preventDefault();
    openViewer(img.currentSrc || img.src);
  }, true);
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
}

/* =========================================================
   Montaje de UI
   ========================================================= */
export function mountFotosUIOnce(){
  if (mounted) return; mounted = true;

  bindGlobalDblClick();

  const input = $(SEL.input);
  const btn = $(SEL.btn);

  // 1) Cambio en el INPUT correcto
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
