export const ESTADOS_TRATO = [
  { val: 'pendiente', label: 'Pendiente' },
  { val: 'acordado', label: 'Acordado' },
  { val: 'rechazado', label: 'Rechazado' },
  { val: 'cerrado_ok', label: 'Cerrado OK' },
];

const UI_TO_API_ESTADO = {
  pendiente: 'negociando',
  acordado: 'acordado',
  rechazado: 'caido',
  cerrado_ok: 'compra_efectuada',
};

const API_TO_UI_ESTADO = {
  prospecto: 'pendiente',
  negociando: 'pendiente',
  semi_acordado: 'pendiente',
  acordado: 'acordado',
  compra_efectuada: 'cerrado_ok',
  cerrado: 'cerrado_ok',
  caido: 'rechazado',
  perdido: 'rechazado',
  descartado: 'rechazado',
};

export function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

export function getUiEstadoFromApi(estado) {
  return API_TO_UI_ESTADO[String(estado || '').toLowerCase()] || 'pendiente';
}

export function getApiEstadoFromUi(estado) {
  return UI_TO_API_ESTADO[String(estado || '').toLowerCase()] || 'negociando';
}

export function parseNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function formatInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '-';
  return number.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

export function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '-';
  return `$${number.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}

export function createEmptyForm(condiciones = []) {
  return {
    proveedorNombre: '',
    responsableNombre: '',
    tonsAcordadas: '',
    fechaInicioCosecha: '',
    estadoCierre: '',   // '' = activo/negociando, 'perdido', 'descartado', 'cerrado_ok'
    motivoCierre: '',
    notas: '',
    condiciones,
  };
}

export const TONS_POR_CAMION_SIMPLE = 11;

export function calcularFechaTerminoEstimadaTrato({
  fechaInicioCosecha,
  vigenciaDesde,
  tonsAcordadas,
  camionesXDia,
  condiciones,
  transporte,
  capacidadCamion,
} = {}) {
  const inicio = fechaInicioCosecha || vigenciaDesde;
  const parts = getDateOnlyParts(inicio);
  const tons = parseNumberOrNull(tonsAcordadas) ?? deriveVolumenDesdeCondiciones(condiciones);
  const camiones = parseNumberOrNull(camionesXDia) ?? deriveCamionesXDia(condiciones);
  if (!parts || !tons || !camiones) return null;

  let capReal = capacidadCamion || TONS_POR_CAMION_SIMPLE;
  if (!capacidadCamion && transporte && transporte.maxisPorUnidad > 0 && transporte.kgPorMaxiRef > 0) {
    capReal = (transporte.maxisPorUnidad * transporte.kgPorMaxiRef) / 1000;
  }

  const diasNecesarios = Math.ceil(Number(tons) / (Number(camiones) * capReal));
  if (!Number.isFinite(diasNecesarios) || diasNecesarios <= 0) return null;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + diasNecesarios - 1);
  return date.toISOString();
}

export function getEstadoCierreFromApi(estadoApi) {
  const e = String(estadoApi || '').toLowerCase();
  if (['perdido', 'caido'].includes(e)) return 'perdido';
  if (e === 'descartado') return 'descartado';
  if (['compra_efectuada', 'cerrado'].includes(e)) return 'cerrado_ok';
  return '';
}

export function buildInitialConditions(maestros = [], existingCondiciones = []) {
  const byId   = new Map(existingCondiciones.map(c => [String(c.condicionId), c]));
  const byName = new Map(existingCondiciones.map(c => [String(c.nombre || '').toLowerCase(), c]));
  return maestros.map((m) => {
    const saved = byId.get(String(m._id)) || byName.get(String(m.nombre || '').toLowerCase());
    return {
      condicionId:   m._id,
      nombre:        m.nombre,
      tipoValor:     m.tipoValor,
      estado:        saved?.estado       ?? 'pendiente',
      valor:         saved?.valor        ?? null,
      modoCondicion: saved?.modoCondicion ?? null,
    };
  });
}

export function buildProviderDirectory(centros = [], contactos = []) {
  const firstContactByKey = new Map();
  contactos.forEach((item) => {
    const key = String(item.proveedorKey || item.proveedorNombre || '').trim().toLowerCase();
    if (!key || firstContactByKey.has(key)) return;
    firstContactByKey.set(key, item);
  });

  const providers = new Map();
  centros.forEach((centro, index) => {
    const proveedorNombre = String(centro.proveedor || '').trim() || 'Proveedor sin nombre';
    const proveedorKey = String(centro.proveedorKey || proveedorNombre).trim().toLowerCase();
    if (!proveedorKey) return;

    const linkedContact = firstContactByKey.get(proveedorKey);
    const existing = providers.get(proveedorKey);

    if (!existing) {
      providers.set(proveedorKey, {
        id: `prov-${proveedorKey || index}`,
        contactoId: linkedContact?._id || '',
        proveedorKey,
        proveedorNombre,
        contactoNombre: linkedContact?.contactoNombre || '',
        contactoTelefono: linkedContact?.contactoTelefono || '',
        contactoEmail: linkedContact?.contactoEmail || '',
        comuna: centro.comuna || '',
        centros: 1,
      });
      return;
    }

    existing.centros += 1;
    if (!existing.contactoId && linkedContact?._id) existing.contactoId = linkedContact._id;
    if (!existing.contactoNombre && linkedContact?.contactoNombre) existing.contactoNombre = linkedContact.contactoNombre;
    if (!existing.contactoTelefono && linkedContact?.contactoTelefono) existing.contactoTelefono = linkedContact.contactoTelefono;
    if (!existing.contactoEmail && linkedContact?.contactoEmail) existing.contactoEmail = linkedContact.contactoEmail;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  contactos.forEach((contacto, index) => {
    const proveedorNombre = String(contacto.proveedorNombre || '').trim() || 'Proveedor sin nombre';
    const proveedorKey = String(contacto.proveedorKey || proveedorNombre).trim().toLowerCase();
    if (!proveedorKey || providers.has(proveedorKey)) return;

    providers.set(proveedorKey, {
      id: `contact-${contacto._id || proveedorKey || index}`,
      contactoId: contacto._id || '',
      proveedorKey,
      proveedorNombre,
      contactoNombre: contacto.contactoNombre || '',
      contactoTelefono: contacto.contactoTelefono || '',
      contactoEmail: contacto.contactoEmail || '',
      comuna: contacto.centroComuna || contacto.comuna || '',
      centros: 0,
    });
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

export function getDateOnlyParts(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function formatDateOnlySafe(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return '-';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${day}-${month}-${parts.year}`;
}

export function normalizeDateOnlyForUiSafe(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return value;
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}T12:00:00.000Z`;
}

export function deriveCamionesXDia(condiciones = []) {
  const match = (condiciones || []).find((item) => /camiones?\s*dia/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

export function derivePrecioDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /precio/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

export function deriveVolumenDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /volumen|total/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

export function derivePlazoDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /plazo|pago/.test(normalizeText(item?.nombre)));
  return match?.valor || '';
}

/**
 * Devuelve la representación legible del descuento planta:
 * "Normal", "Fijo X%", o null si no existe la condición.
 */
export function deriveDescuentoPlanta(condiciones = []) {
  const match = (condiciones || []).find((item) =>
    /descuento.*planta|planta/.test(normalizeText(item?.nombre))
  );
  if (!match) return null;
  if (match.modoCondicion === 'fijo') {
    return match.valor != null && match.valor !== '' ? `Fijo ${match.valor}%` : 'Fijo';
  }
  return 'Normal';
}

export function isEquivalentEstado(actualApi, nextUi) {
  const current = String(actualApi || '').toLowerCase();
  if (nextUi === 'cerrado_ok') return ['compra_efectuada', 'cerrado'].includes(current);
  if (nextUi === 'acordado') return current === 'acordado';
  if (nextUi === 'rechazado') return ['caido', 'perdido', 'descartado'].includes(current);
  if (nextUi === 'pendiente') return ['prospecto', 'negociando', 'semi_acordado'].includes(current);
  return false;
}

export function buildTratoShareMessage(item, url) {
  const proveedor = item?.proveedorNombre || 'Proveedor';
  const tons = item?.tonsAcordadas || deriveVolumenDesdeCondiciones(item?.condiciones) || 0;
  const precio = item?.precioAcordado ?? derivePrecioDesdeCondiciones(item?.condiciones);
  const camiones = item?.camionesXDia || deriveCamionesXDia(item?.condiciones);
  const inicio = item?.vigenciaDesde || item?.fechaCierre;
  const termino = item?.fechaTerminoCosecha || calcularFechaTerminoEstimadaTrato({
    vigenciaDesde: inicio,
    tonsAcordadas: tons,
    camionesXDia: camiones,
    condiciones: item?.condiciones,
  });
  const responsable = item?.responsableNombre || 'Sin responsable registrado';
  const centro = item?.centroCodigo || item?.centroNombre || item?.meta?.centroNombre || '';
  const estado = ESTADOS_TRATO.find(e => e.val === getUiEstadoFromApi(item?.estado))?.label || item?.estado || 'Trato';
  const descuentoPlanta = deriveDescuentoPlanta(item?.condiciones);

  const transporteTrato = item?.transportes?.[0];
  const nombreTransporte = transporteTrato?.nombre || 'Camion Simple';
  
  return [
    '*Mitynex | Confirmación pública de acuerdo*',
    `Proveedor: ${proveedor}`,
    centro ? `Centro: ${centro}` : null,
    tons ? `Volumen acordado: ${formatInteger(tons)} t` : null,
    precio ? `Precio: ${formatMoney(precio)} / kg` : null,
    camiones ? `Carga: ${formatInteger(camiones)} ${nombreTransporte}` : null,
    descuentoPlanta ? `Descuento planta: ${descuentoPlanta}` : null,
    inicio ? `Inicio probable cosecha: ${formatDateOnlySafe(inicio)}` : null,
    termino ? `Término estimado: ${formatDateOnlySafe(termino)}` : null,
    `Responsable: ${responsable}`,
    `Estado: ${estado}`,
    '',
    'Ver confirmación:',
    url,
  ].filter((line) => line !== null).join('\n');
}
