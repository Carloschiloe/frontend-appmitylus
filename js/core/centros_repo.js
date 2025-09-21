// js/core/centros_repo.js — versión sin “líneas”

import {
  apiGetCentros,
  apiCreateCentro,
  apiUpdateCentro,
  apiDeleteCentro,
  apiBulkUpsertCentros
} from './api.js';

// Nota: en tu almacenamiento.js no existe saveCentros y además hace HTTP.
// Dejamos sólo getCentros para un posible modo offline.
import { getCentros } from './almacenamiento.js';

// Usa la API siempre (modo online). Si algún día quieres offline, cambia a false.
const USE_API = true;

/* --------- Lectura --------- */
export async function getCentrosAll() {
  return USE_API ? await apiGetCentros() : getCentros();
}

/* --------- CRUD Centros --------- */
export async function createCentro(data) {
  return USE_API ? await apiCreateCentro(data) : localCreateCentro(data);
}
export async function updateCentro(id, data) {
  return USE_API ? await apiUpdateCentro(id, data) : localUpdateCentro(id, data);
}
export async function deleteCentro(id) {
  return USE_API ? await apiDeleteCentro(id) : localDeleteCentro(id);
}

/* --------- BULK UPSERT (centros) --------- */
export async function bulkUpsertCentros(arr) {
  if (USE_API) return apiBulkUpsertCentros(arr);
  return localBulkUpsertCentros(arr);
}

/* ===== BUSCAR CENTRO POR CODE (para importador o UI) ===== */
export async function getCentroByCode(code) {
  if (!code) return null;
  const all = await getCentrosAll();
  return all.find(c => c.code && c.code.toString() === String(code)) || null;
}

/* ====== Stubs modo offline (no usados con USE_API=true) ====== */
function persist(list){ return list; } // no-op

async function localCreateCentro(data){
  const list = await getCentros(); // viene de servidor en tu impl; aquí solo stub
  list.push({ ...data, _id: crypto.randomUUID() });
  return persist(list);
}
async function localUpdateCentro(id,data){
  const list = await getCentros();
  const i = list.findIndex(c=>c._id===id);
  if(i>-1) list[i] = { ...list[i], ...data };
  return persist(list);
}
async function localDeleteCentro(id){
  const list = (await getCentros()).filter(c=>c._id!==id);
  return persist(list);
}
async function localBulkUpsertCentros(arr){
  const list = await getCentros();
  const indexByCode = new Map(list.map(c => [String(c.code), c]));
  let matched=0, modified=0, upserted=0;

  for (const doc of arr) {
    const code = String(doc.code);
    const existente = indexByCode.get(code);
    if (existente) {
      matched++;
      const before = JSON.stringify(existente);
      Object.assign(existente, doc);
      const after = JSON.stringify(existente);
      if (before !== after) modified++;
    } else {
      const nuevo = { ...doc, _id: crypto.randomUUID() };
      list.push(nuevo);
      indexByCode.set(code, nuevo);
      upserted++;
    }
  }
  return { ok:true, matched, modified, upserted };
}
