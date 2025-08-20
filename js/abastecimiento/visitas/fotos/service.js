// /js/abastecimiento/visitas/fotos/service.js
import { processFiles } from '/js/shared/media/image-pipeline.js';

const LS_KEY = 'visitas:fotos:v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };

export async function list(visitId) {
  const s = load(); return s[visitId] || [];
}

export async function upload(visitId, files=[], pipelineOpts={}) {
  if (!visitId || !files.length) return [];
  const s = load();

  const processed = await processFiles(files, {
    maxBytes: 1.6 * 1024 * 1024, // ajusta a 2MB si quieres
    maxEdge: 1600,
    format: 'image/webp',
    quality: 0.82, minQuality: 0.5, stepQuality: 0.08,
    ...pipelineOpts
  });

  const entries = processed.map(p => ({
    id: 'f_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: p.name, type: p.type, size: p.bytes, dataURL: p.dataURL,
    width: p.width, height: p.height, createdAt: Date.now(),
  }));

  s[visitId] = (s[visitId] || []).concat(entries);
  save(s);
  return entries;
}

export async function remove(visitId, fotoId) {
  const s = load();
  s[visitId] = (s[visitId] || []).filter(f => f.id !== fotoId);
  save(s);
  return true;
}

/* Para backend real:
   - Reemplaza list/upload/remove por fetch a tu API.
   - Mantén processFiles() antes del POST para subir ya comprimido. */
