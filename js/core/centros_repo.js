//js/core/centros_repo.js

import {
  apiGetCentros, apiCreateCentro, apiUpdateCentro, apiDeleteCentro,
  apiAddLinea, apiUpdateLinea, apiDeleteLinea, apiAddInventarioLinea
} from './api.js';
import { getCentros, saveCentro } from './almacenamiento.js';

// pon en false para trabajar offline
const USE_API = true;

/* --------- Lectura --------- */
export async function getCentrosAll() {
  return USE_API ? await apiGetCentros() : getCentros();
}

/* --------- CRUD Centros --------- */
export async function createCentro(data) {
  return USE_API ? await apiCreateCentro(data) : (localCreateCentro(data));
}
export async function updateCentro(id, data) {
  return USE_API ? await apiUpdateCentro(id, data) : (localUpdateCentro(id, data));
}
export async function deleteCentro(id) {
  return USE_API ? await apiDeleteCentro(id) : (localDeleteCentro(id));
}

/* --------- CRUD Líneas --------- */
export async function addLinea(centroId, data) {
  return USE_API ? await apiAddLinea(centroId, data) : (localAddLinea(centroId, data));
}
export async function updateLinea(centroId, lineaId, data) {
  return USE_API ? await apiUpdateLinea(centroId, lineaId, data) : (localUpdateLinea(centroId, lineaId, data));
}
export async function deleteLinea(centroId, lineaId) {
  return USE_API ? await apiDeleteLinea(centroId, lineaId) : (localDeleteLinea(centroId, lineaId));
}

/* --------- Inventario Línea --------- */
export async function addInventarioLinea(centroId, lineaId, data) {
  return USE_API ? await apiAddInventarioLinea(centroId, lineaId, data) : (localAddInventarioLinea(centroId, lineaId, data));
}

/* ===== IMPLEMENTACIÓN LOCALSTORAGE (offline) ===== */
function persist(list){ saveCentros(list); return list; }

async function localCreateCentro(data){
  const list = getCentros(); list.push({ ...data, _id: crypto.randomUUID() }); return persist(list);
}
async function localUpdateCentro(id,data){
  const list = getCentros(); const i = list.findIndex(c=>c._id===id);
  if(i>-1) list[i] = { ...list[i], ...data }; return persist(list);
}
async function localDeleteCentro(id){
  const list = getCentros().filter(c=>c._id!==id); return persist(list);
}

async function localAddLinea(centroId, data){
  const list = getCentros(); const c = list.find(c=>c._id===centroId);
  if(!c) throw new Error('Centro no encontrado');
  c.lines ||= []; c.lines.push({ ...data, _id: crypto.randomUUID(), inventarios: [] });
  return persist(list);
}
async function localUpdateLinea(centroId, lineaId, data){
  const list = getCentros(); const c = list.find(c=>c._id===centroId);
  const l = c?.lines?.find(l=>l._id===lineaId); if(!l) throw new Error('Línea no encontrada');
  Object.assign(l, data); return persist(list);
}
async function localDeleteLinea(centroId, lineaId){
  const list = getCentros(); const c = list.find(c=>c._id===centroId);
  c.lines = c.lines.filter(l=>l._id!==lineaId); return persist(list);
}
async function localAddInventarioLinea(centroId,lineaId,data){
  const list = getCentros(); const c = list.find(c=>c._id===centroId);
  const l = c?.lines?.find(l=>l._id===lineaId); if(!l) throw new Error('Línea no encontrada');
  l.inventarios ||= []; l.inventarios.push({ ...data, _id: crypto.randomUUID() });
  return persist(list);
}

// ===== BUSCAR CENTRO POR CODE (para importador inteligente) =====
export async function getCentroByCode(code) {
  if (!code) return null;
  const all = await getCentrosAll();
  return all.find(c => c.code && c.code.toString() === code.toString()) || null;
}
