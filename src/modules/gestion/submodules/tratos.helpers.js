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
    precioBase: '',
    fechaInicioCosecha: '',
    estadoCierre: '',   // '' = activo/negociando, 'perdido', 'descartado', 'cerrado_ok'
    motivoCierre: '',
    notas: '',
    condiciones,
  };
}

export function getEstadoCierreFromApi(estadoApi) {
  const e = String(estadoApi || '').toLowerCase();
  if (['perdido', 'caido'].includes(e)) return 'perdido';
  if (e === 'descartado') return 'descartado';
  if (['compra_efectuada', 'cerrado'].includes(e)) return 'cerrado_ok';
  return '';
}

export function buildInitialConditions(maestros = []) {
  return maestros.map((m) => ({
    condicionId: m._id,
    nombre: m.nombre,
    tipoValor: m.tipoValor,
    estado: 'pendiente',
    valor: null,
  }));
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
  const centro = item?.centroCodigo || item?.centroNombre || item?.meta?.centroNombre || '';
  const estado = ESTADOS_TRATO.find(e => e.val === getUiEstadoFromApi(item?.estado))?.label || item?.estado || 'Trato';

  return [
    '*Mitynex | Confirmacion publica de trato*',
    `Proveedor: ${proveedor}`,
    centro ? `Centro: ${centro}` : null,
    tons ? `Volumen acordado: ${formatInteger(tons)} t` : null,
    precio ? `Precio: ${formatMoney(precio)} / kg` : null,
    camiones ? `Carga: ${formatInteger(camiones)} cam/dia` : null,
    inicio ? `Inicio probable cosecha: ${formatDateOnlySafe(inicio)}` : null,
    `Estado: ${estado}`,
    '',
    'Ver confirmacion:',
    url,
  ].filter((line) => line !== null).join('\n');
}
