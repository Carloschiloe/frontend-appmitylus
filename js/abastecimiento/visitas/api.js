// /js/abastecimiento/visitas/api.js
import {
  apiGetVisitas,
  apiGetVisitasByContacto,
  apiCreateVisita,
  apiUpdateVisita,
  apiDeleteVisita,
} from '../../core/api.js';
import { normalizeVisita } from './normalizers.js';

const normList = (raw) => {
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  return arr.map(normalizeVisita);
};

export async function getAll() {
  const raw = await apiGetVisitas();
  return normList(raw);
}
export async function getByContacto(contactoId) {
  const raw = await apiGetVisitasByContacto(contactoId);
  return normList(raw);
}
export async function create(payload) {
  return apiCreateVisita(payload);
}
export async function update(id, payload) {
  return apiUpdateVisita(id, payload);
}
export async function remove(id) {
  return apiDeleteVisita(id);
}


