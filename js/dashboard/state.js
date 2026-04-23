/**
 * js/dashboard/state.js
 * Estado centralizado del Dashboard principal.
 */

export const STATUS_ORDER = ['disponible', 'semi_acordado', 'acordado', 'descartado', 'perdido'];

export const STATUS_LABELS = {
  disponible: 'Disponible',
  semi_acordado: 'Semi-acordado',
  acordado: 'Acordado',
  descartado: 'Descartado',
  perdido: 'Perdido'
};

export const state = {
  raw: {
    contactos: [],
    visitas: [],
    interacciones: [],
    disponibilidades: [],
    oportunidades: []
  },
  filters: {
    responsable: '',
    comuna: '',
    periodoDias: 30,
    texto: ''
  },
  bio: {
    scale: 'week',
    offset: 0,
    focusStatus: null,
    activeStatuses: new Set(STATUS_ORDER),
    annualMode: 'line',
    annualFocusMonth: null,
    annualProvidersQuery: '',
    annualFocusProviderKey: ''
  },
  chart: null,
  chartAnnual: null,
  bioContrib: {},
  annualYear: null,
  annualRowsByMonth: [],
  annualVisibleProviders: []
};

/**
 * Helpers de formateo
 */
export function fmtN(n) {
  return Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]
  ));
}

export function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}
