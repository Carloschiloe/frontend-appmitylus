export const TIPOS_INTERACCION = [
  { val: 'interaccion', label: 'Nota' },
  { val: 'llamada', label: 'Llamada' },
  { val: 'reunion', label: 'Reunion' },
  { val: 'muestreo', label: 'Muestreo' },
  { val: 'visita', label: 'Visita' },
  { val: 'compromiso', label: 'Compromiso' },
];

export function createEmptyInteraccionForm(date = new Date()) {
  return {
    proveedorNombre: '',
    tipo: 'interaccion',
    fecha: date.toISOString().slice(0, 10),
    resumen: '',
    notas: '',
    proximaAccion: '',
    fechaProxima: '',
  };
}

export function toItems(payload) {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : (payload.items || []);
}

export function buildProviderDirectory(centros = [], contactos = []) {
  const firstContactByKey = new Map();
  contactos.forEach((item) => {
    const key = String(item.proveedorKey || '').trim().toLowerCase();
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
        comuna: centro.comuna || '',
      });
      return;
    }

    if (!existing.contactoNombre && linkedContact?.contactoNombre) existing.contactoNombre = linkedContact.contactoNombre;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

export function filterProviders(providers = [], search = '', limit = 10) {
  const query = String(search || '').toLowerCase();
  return providers
    .filter((item) => {
      if (!query) return true;
      const providerText = `${item.proveedorNombre || ''} ${item.comuna || ''}`.toLowerCase();
      return providerText.includes(query);
    })
    .slice(0, limit);
}

export function filterInteracciones(items = [], search = '') {
  const query = String(search || '').toLowerCase();
  return items.filter((item) =>
    (item.proveedorNombre || '').toLowerCase().includes(query) ||
    (item.resumen || '').toLowerCase().includes(query)
  );
}

export function getTipoLabel(tipo) {
  return TIPOS_INTERACCION.find((item) => item.val === tipo)?.label || 'Nota';
}
