import { fetchJson } from './ui-common.js';

const API_BASE = '/api';
const API_MUESTREOS = `${API_BASE}/muestreos`;

function S(v) {
  return String(v == null ? '' : v).trim();
}

function normalizeRow(raw = {}) {
  return {
    id: String(raw.id || raw._id || ''),
    visitaId: S(raw.visitaId),
    proveedorKey: S(raw.proveedorKey).toLowerCase(),
    proveedor: S(raw.proveedor || raw.proveedorNombre),
    proveedorNombre: S(raw.proveedorNombre || raw.proveedor),
    centroId: S(raw.centroId),
    centroCodigo: S(raw.centroCodigo),
    centro: S(raw.centro || raw.centroCodigo),
    linea: S(raw.linea),
    fecha: S(raw.fecha).slice(0, 10),
    origen: S(raw.origen || 'terreno').toLowerCase() || 'terreno',
    responsable: S(raw.responsable || raw.responsablePG),
    responsablePG: S(raw.responsablePG || raw.responsable),
    uxkg: Number(raw.uxkg) || 0,
    pesoVivo: Number(raw.pesoVivo) || 0,
    pesoCocida: Number(raw.pesoCocida) || 0,
    rendimiento: Number(raw.rendimiento) || 0,
    total: Number(raw.total) || 0,
    procesable: Number(raw.procesable) || 0,
    rechazos: Number(raw.rechazos) || 0,
    defectos: Number(raw.defectos) || 0,
    cats: raw.cats && typeof raw.cats === 'object' ? raw.cats : {},
    clasificaciones: Array.isArray(raw.clasificaciones) ? raw.clasificaciones : [],
    evaluacion: Array.isArray(raw.evaluacion) ? raw.evaluacion : []
  };
}

function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function listMuestreos(params = {}) {
  const data = await fetchJson(`${API_MUESTREOS}${buildQuery(params)}`, { method: 'GET' });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  return items.map(normalizeRow);
}

export async function getMuestreosResumen(params = {}) {
  const data = await fetchJson(`${API_MUESTREOS}/resumen${buildQuery(params)}`, { method: 'GET' });
  return data && typeof data === 'object' ? data : {};
}

export async function createMuestreo(payload = {}) {
  const data = await fetchJson(API_MUESTREOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  return normalizeRow(data?.item || data || {});
}

export async function updateMuestreo(id, payload = {}) {
  const key = S(id);
  if (!key) throw new Error('ID_MUESTREO_REQUERIDO');
  const data = await fetchJson(`${API_MUESTREOS}/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  return normalizeRow(data?.item || data || {});
}
