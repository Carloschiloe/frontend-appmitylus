// /js/abastecimiento/visitas/fotos/ui.js
import * as fotos from './service.js';

let mounted = false;
let pendingFiles = [];

const SEL = {
  input:   '#visita_fotos_input',
  preview: '#visita_fotos_preview',
  gallery: '#visita_fotos_gallery',
  btn:     '#btnPickFotos',
};

const $ = (s) => document.querySelector(s);

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

function openViewer(src) {
  let viewer = document.querySelector('.foto-viewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.className = 'foto-viewer';
    viewer.innerHTML = `
      <div class="foto-viewer__content">
        <img src="" alt="Foto" />
        <button class="foto-viewer__close">×</button>
      </div>`;
    document.body.appendChild(viewer);

    viewer.addEventListener('click', (e) => {
      if (e.target.classList.contains('foto-viewer') || e.target.classList.contains('foto-viewer__close')) {
        viewer.classList.remove('open');
      }
    });
  }

  viewer.querySelector('img').src = src;
  viewer.classList.add('open');
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

  // Doble click → fullscreen
  wrap.querySelectorAll('.foto-item').forEach(item=>{
    item.addEventListener('dblclick', ()=> openViewer(item.dataset.src));
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

  // Doble click → fullscreen
  wrap.querySelectorAll('.foto-item').forEach(item=>{
    item.addEventListener('dblclick', ()=> openViewer(item.dataset.src));
  });
}

export function mountFotosUIOnce(){
  if (mounted) return; mounted = true;

  const input = $(SEL.input);
  const btn = $(SEL.btn);

  if (input){
    input.addEventListener('change', ()=>{
      pendingFiles = Array.from(input.files || []);
      renderPending();
    }, { passive: true });
  }

  if (btn && input){
    btn.addEventListener('click', ()=> input.click());
  }
}

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
