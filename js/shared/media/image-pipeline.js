// /js/shared/media/image-pipeline.js
// Redimensiona, corrige orientación (si el navegador lo soporta) y comprime hasta un tamaño objetivo.
// Útil para aceptar fotos de 5–15MB y guardarlas en ~1–2MB.

/*
Uso:
  import { processFiles } from 'image-pipeline.js';
  const items = await processFiles(files, {
    maxBytes: 1.6 * 1024 * 1024,  // ~1.6MB por foto
    maxEdge: 1600,                 // px lado mayor
    format: 'image/webp',          // o 'image/jpeg'
    quality: 0.82, minQuality: 0.5, stepQuality: 0.08
  });
*/

const defaults = {
  maxBytes: 1.6 * 1024 * 1024,
  maxEdge: 1600,
  format: 'image/webp',
  quality: 0.82,
  minQuality: 0.5,
  stepQuality: 0.08,
};

export async function processFiles(filesLike, opts={}) {
  const o = { ...defaults, ...opts };
  const files = Array.from(filesLike || []).filter(f => f?.type?.startsWith('image/'));
  const out = [];
  for (const f of files) {
    try { out.push(await processOne(f, o)); }
    catch (e) { console.warn('[image-pipeline]', f?.name, e); }
  }
  return out;
}

async function processOne(file, o) {
  const bm = await decodeToBitmap(file);
  let { width, height } = bm;

  const scale = o.maxEdge / Math.max(width, height);
  if (scale < 1) { width = Math.round(width*scale); height = Math.round(height*scale); }

  let q = o.quality, w = width, h = height;
  let blob = await renderToBlob(bm, w, h, o.format, q);

  let guard = 0;
  while (blob.size > o.maxBytes && guard < 12) {
    guard++;
    if (q > o.minQuality + 1e-3) {
      q = Math.max(o.minQuality, q - o.stepQuality);
    } else {
      w = Math.round(w * 0.85);
      h = Math.round(h * 0.85);
      q = o.quality;
    }
    blob = await renderToBlob(bm, w, h, o.format, q);
  }

  const dataURL = await blobToDataURL(blob);
  return {
    blob, dataURL, width: w, height: h, bytes: blob.size,
    name: recomputeName(file.name, o.format), type: blob.type,
    original: { name: file.name, type: file.type, size: file.size },
  };
}

function recomputeName(name, format) {
  const base = (name || 'foto').replace(/\.[a-z0-9]+$/i, '');
  const ext = format === 'image/jpeg' ? '.jpg' : (format === 'image/webp' ? '.webp' : '.png');
  return base + ext;
}

async function decodeToBitmap(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap: bmp, width: bmp.width, height: bmp.height, _type: 'bitmap' };
  } catch {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    return { img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, _type: 'img' };
  }
}
function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

async function renderToBlob(bm, w, h, format, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha:false });
  if (bm._type === 'bitmap') ctx.drawImage(bm.bitmap, 0, 0, w, h);
  else ctx.drawImage(bm.img, 0, 0, w, h);
  return await canvasToBlob(canvas, format, quality);
}
function canvasToBlob(canvas, type='image/webp', quality=0.82){
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob(b => b?resolve(b):reject(new Error('toBlob null')), type, quality);
    else {
      const dataURL = canvas.toDataURL(type, quality);
      resolve(dataURLToBlob(dataURL));
    }
  });
}
function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{ const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(blob); });
}
function dataURLToBlob(dataURL){
  const [head, body] = dataURL.split(',');
  const m = head.match(/data:(.*?);base64/);
  const mime = m ? m[1] : 'application/octet-stream';
  const bin = atob(body); const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}
