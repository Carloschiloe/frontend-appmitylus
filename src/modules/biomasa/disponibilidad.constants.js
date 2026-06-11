export const DISPONIBILIDAD_ESTADOS = [
  { value: 'disponible', label: 'Disponible', tone: 'info' },
  { value: 'semi_cerrado', label: 'Semi-cerrado', tone: 'warning' },
  { value: 'cerrado', label: 'Cerrado', tone: 'success' },
  { value: 'perdido', label: 'Perdido', tone: 'danger' },
  { value: 'descartado', label: 'Descartado', tone: 'muted' },
];

export const DISPONIBILIDAD_PRODUCTOS = [
  { value: 'entero', label: 'Entero' },
  { value: 'carne', label: 'Carne' },
  { value: 'media_concha', label: 'Media concha' },
  { value: 'sin_definir', label: 'Sin definir' },
];

export const DISPONIBILIDAD_ORIGENES = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'visita', label: 'Visita' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'otro', label: 'Otro' },
];

export const optionLabel = (options, value) => (
  options.find((option) => option.value === value)?.label || value || 'Sin definir'
);

const emptyStateTotals = () => Object.fromEntries(DISPONIBILIDAD_ESTADOS.map((state) => [state.value, 0]));

export function buildDisponibilidadAnnualProjection(items = [], year) {
  const totalsByState = emptyStateTotals();
  const rows = Array.from({ length: 12 }, (_, index) => {
    const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
    const stateTons = emptyStateTotals();

    items.forEach((item) => {
      if (item.mesKey !== monthKey) return;
      const state = item.estado || 'disponible';
      if (state in stateTons) stateTons[state] += Number(item.tons || item.tonsDisponible || 0);
    });

    Object.entries(stateTons).forEach(([state, tons]) => {
      totalsByState[state] += tons;
    });

    return {
      monthKey,
      stateTons,
      total: Object.values(stateTons).reduce((sum, tons) => sum + tons, 0),
    };
  });

  return {
    rows,
    totalsByState,
    annualTotal: Object.values(totalsByState).reduce((sum, tons) => sum + tons, 0),
  };
}

const providerKeyOf = (item) => String(item?.proveedorKey || item?.proveedorNombre || item?.proveedor || '').trim().toLowerCase();

export function buildDisponibilidadProviders(contactos = [], centros = []) {
  const providers = new Map();

  contactos.forEach((contacto, index) => {
    const proveedorKey = providerKeyOf(contacto);
    if (!proveedorKey) return;
    providers.set(proveedorKey, {
      id: `contact-${contacto._id || index}`,
      contactoId: contacto._id || '',
      proveedorKey,
      proveedorNombre: contacto.proveedorNombre || contacto.empresaNombre || contacto.contactoNombre || 'Proveedor sin nombre',
      contactoNombre: contacto.contactoNombre || '',
      comuna: contacto.centroComuna || contacto.comuna || '',
      centros: [],
    });
  });

  centros.forEach((centro, index) => {
    const proveedorKey = providerKeyOf(centro);
    if (!proveedorKey) return;
    const provider = providers.get(proveedorKey) || {
      id: `center-${proveedorKey || index}`,
      contactoId: '',
      proveedorKey,
      proveedorNombre: centro.proveedor || centro.proveedorNombre || 'Proveedor sin nombre',
      contactoNombre: '',
      comuna: centro.comuna || '',
      centros: [],
    };
    provider.centros.push(centro);
    if (!provider.comuna && centro.comuna) provider.comuna = centro.comuna;
    providers.set(proveedorKey, provider);
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

export function filterDisponibilidadProviders(providers = [], search = '', limit = 8) {
  const query = String(search || '').trim().toLowerCase();
  return providers
    .filter((provider) => {
      if (!query) return true;
      return `${provider.proveedorNombre} ${provider.contactoNombre} ${provider.comuna}`.toLowerCase().includes(query);
    })
    .slice(0, limit);
}
