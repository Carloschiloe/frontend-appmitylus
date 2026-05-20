export const fmtNum = (value, digits = 2) => (
  (Number(value) || 0).toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
);

const MESES_LARGO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const getCurrentMonthKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthLabel = (monthKey = '') => {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  return `${MESES_LARGO[parseInt(month, 10) - 1]} ${year}`.toUpperCase();
};

export const getWeekDays = (weekOffset = 0) => {
  const start = new Date();
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().split('T')[0];
  });
};

export const getWeekLabel = (weekDays = []) => {
  if (!weekDays.length) return '';
  const start = new Date(`${weekDays[0]}T12:00:00`);
  const end = new Date(`${weekDays[weekDays.length - 1]}T12:00:00`);
  return `${start.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

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
        contactoTelefono: linkedContact?.contactoTelefono || '',
        contactoEmail: linkedContact?.contactoEmail || '',
        comuna: centro.comuna || '',
        centros: 1,
      });
      return;
    }

    existing.centros += 1;
    if (!existing.contactoNombre && linkedContact?.contactoNombre) existing.contactoNombre = linkedContact.contactoNombre;
    if (!existing.contactoTelefono && linkedContact?.contactoTelefono) existing.contactoTelefono = linkedContact.contactoTelefono;
    if (!existing.contactoEmail && linkedContact?.contactoEmail) existing.contactoEmail = linkedContact.contactoEmail;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

export function filterMuestreos(muestreos = [], searchTerm = '') {
  const query = searchTerm.toLowerCase();
  return muestreos.filter((item) => (
    (item.proveedorNombre || item.proveedor || '').toLowerCase().includes(query) ||
    (item.centroCodigo || item.centro || '').toLowerCase().includes(query)
  ));
}

export function groupMuestreosByProvider(muestreos = []) {
  const groups = {};
  muestreos.forEach((item) => {
    const key = item.proveedorNombre || item.proveedor || 'S/P';
    if (!groups[key]) {
      groups[key] = {
        key,
        muestras: 0,
        rendSum: 0,
        uxkgSum: 0,
        totalSum: 0,
        rechazosSum: 0,
        items: [],
      };
    }
    groups[key].muestras += 1;
    groups[key].rendSum += Number(item.rendimiento) || 0;
    groups[key].uxkgSum += Number(item.uxkg) || 0;
    groups[key].totalSum += Number(item.total) || 0;
    groups[key].rechazosSum += Number(item.rechazos) || 0;
    groups[key].items.push(item);
  });

  return Object.values(groups).sort((a, b) => b.muestras - a.muestras);
}

export function filterProviders(directory = [], searchTerm = '') {
  if (!searchTerm.trim()) return [];
  const query = searchTerm.toLowerCase();
  return directory.filter((provider) => (
    (provider.proveedorNombre || '').toLowerCase().includes(query) ||
    (provider.proveedorKey || '').toLowerCase().includes(query) ||
    (provider.contactoNombre || '').toLowerCase().includes(query)
  )).slice(0, 10);
}

export function getAvailableCats(cats = [], activeTab, selectedCats = new Set()) {
  return cats.filter((cat) => (
    cat.tipoCat === activeTab &&
    !selectedCats.has(cat._id)
  ));
}

export function getSelectedCatsForTab({
  selectedCats = new Set(),
  cats = [],
  activeTab,
  formCats = {},
  catDetails = {},
}) {
  const selectedList = [];

  selectedCats.forEach((id) => {
    let cat = cats.find((item) => item._id === id);

    if (!cat) {
      const value = Number(formCats[id]) || 0;
      const details = catDetails[id];
      const photos = details?.photos || details?.fotos || [];

      if (value > 0 || details?.obs || photos.length > 0) {
        cat = { _id: id, nombre: `(Inactivo) ${id.slice(-4)}`, tipoCat: 'unknown' };
      }
    }

    if (cat && (cat.tipoCat === activeTab || cat.tipoCat === 'unknown')) {
      selectedList.push(cat);
    }
  });

  return selectedList;
}

export function computeSamplingTotals({ form = {}, selectedCats = new Set(), cats = [] }) {
  const multiplier = form.unidadPeso === 'g' ? 0.001 : 1;
  const vivo = Number(form.pesoVivo) || 0;
  const cocida = Number(form.pesoCocida) || 0;
  const rend = vivo > 0 ? (cocida / vivo) * 100 : 0;

  let procesable = 0;
  let rechazos = 0;
  let defectos = 0;

  selectedCats.forEach((id) => {
    const value = (Number(form.cats?.[id]) || 0) * multiplier;
    const cat = cats.find((item) => item._id === id);
    if (cat?.tipoCat === 'procesable') procesable += value;
    else if (cat?.tipoCat === 'rechazo') rechazos += value;
    else if (cat?.tipoCat === 'defecto') defectos += value;
  });

  const totalMuestra = procesable + rechazos;
  return { rend, totalMuestra, procesable, rechazos, defectos };
}
