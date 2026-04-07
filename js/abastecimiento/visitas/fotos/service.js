// /js/abastecimiento/visitas/fotos/service.js
import { processFiles } from '../../../shared/media/image-pipeline.js';
import { update as updateVisita } from '../api.js';
import { state } from '../../contactos/state.js';

function toId(v) {
  return String(v == null ? '' : v).trim();
}

function findVisita(visitId) {
  const id = toId(visitId);
  return (state.visitasGuardadas || []).find((v) => toId(v?._id || v?.id) === id) || null;
}

function normalizeFoto(raw, idx = 0) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const src = raw.trim();
    if (!src) return null;
    return {
      id: `f_legacy_${idx}`,
      name: `foto_${idx + 1}`,
      type: '',
      size: 0,
      dataURL: src,
      width: 0,
      height: 0,
      createdAt: Date.now()
    };
  }
  const src = String(raw.dataURL || raw.url || '').trim();
  if (!src) return null;
  return {
    id: String(raw.id || `f_${idx}_${Date.now()}`),
    name: String(raw.name || `foto_${idx + 1}`),
    type: String(raw.type || ''),
    size: Number(raw.size) || 0,
    dataURL: src,
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
    createdAt: Number(raw.createdAt) || Date.now()
  };
}

function normalizeFotos(list = []) {
  if (!Array.isArray(list)) return [];
  return list
    .map((it, idx) => normalizeFoto(it, idx))
    .filter(Boolean);
}

async function persistFotos(visitId, fotos) {
  await updateVisita(visitId, { fotos });
  const v = findVisita(visitId);
  if (v) v.fotos = fotos;
}

export async function list(visitId) {
  const visita = findVisita(visitId);
  return normalizeFotos(visita?.fotos || []);
}

export async function upload(visitId, files = [], pipelineOpts = {}) {
  if (!visitId || !files.length) return [];

  const processed = await processFiles(files, {
    maxBytes: 1.6 * 1024 * 1024,
    maxEdge: 1600,
    format: 'image/webp',
    quality: 0.82,
    minQuality: 0.5,
    stepQuality: 0.08,
    ...pipelineOpts
  });

  const entries = processed.map((p) => ({
    id: `f_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    name: p.name,
    type: p.type,
    size: p.bytes,
    dataURL: p.dataURL,
    width: p.width,
    height: p.height,
    createdAt: Date.now()
  }));

  const current = await list(visitId);
  const next = current.concat(entries);
  await persistFotos(visitId, next);
  return entries;
}

export async function remove(visitId, fotoId) {
  const current = await list(visitId);
  const next = current.filter((f) => String(f.id) !== String(fotoId));
  await persistFotos(visitId, next);
  return true;
}

