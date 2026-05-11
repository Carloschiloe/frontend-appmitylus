import React, { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  X,
  CheckCircle2,
  AlertTriangle,
  Award,
  Edit,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Check,
  ChevronRight,
  Printer,
  Calendar,
  User,
  MapPin,
  Layers,
  ArrowRight,
  ArrowLeft,
  Settings2,
  RotateCcw,
  Target,
  Trash2
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useMuestreosData } from '../../../hooks/useMuestreosData';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';

const fmtNum = (v, d = 2) => (Number(v) || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

function buildProviderDirectory(centros = [], contactos = []) {
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

export default function Muestreos() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
  const { muestreos, maestros, loading, page, setPage, pagination, refresh: loadData } = useMuestreosData(viewMode);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/muestreos/${deleteTarget._id}`);
      addToast({ title: 'Éxito', message: 'Muestreo eliminado.', type: 'success' });
      loadData(page);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo eliminar.', type: 'error' });
    } finally {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, page, addToast, loadData]);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null); // 'procesable' | 'rechazo' | 'defecto'



  // Formulario
  const [form, setForm] = useState({
    proveedorNombre: '',
    proveedorKey: '',
    centroId: '',
    centroCodigo: '',
    linea: '',
    fecha: new Date().toISOString().slice(0, 10),
    origen: 'abastecimiento',
    responsable: '',
    uxkg: '',
    pesoVivo: '',
    pesoCocida: '',
    cats: {},
    unidadPeso: 'kg'
  });

  const resetForm = useCallback(() => {
    setForm({
      proveedorNombre: '',
      proveedorKey: '',
      centroId: '',
      centroCodigo: '',
      linea: '',
      fecha: new Date().toISOString().slice(0, 10),
      origen: 'abastecimiento',
      responsable: user?.nombre || '',
      uxkg: '',
      pesoVivo: '',
      pesoCocida: '',
      cats: {},
      unidadPeso: 'kg'
    });
    setEditingId(null);
    setStep(1);
    setSelectedProvider(null);
    setProviderCenters([]);
    setSearchProviders('');
    setSelectedCats(new Set(maestros.cats.filter(c => c.tipoCat === 'procesable').map(c => c._id)));
    setIsModalOpen(true);
  }, [user, maestros.cats]);

  // Buscador de Proveedor (Patrón Registro Rápido)
  const [searchProviders, setSearchProviders] = useState('');
  const [directory, setDirectory] = useState([]);
  const [allCentros, setAllCentros] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerCenters, setProviderCenters] = useState([]);

  // Carga de directorio (al abrir modal)
  React.useEffect(() => {
    if (!isModalOpen || directory.length > 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadDirectory() {
      setLoadingProviders(true);
      try {
        const [centrosRes, contactosRes] = await Promise.all([
          apiClient.get('/centros', { signal: controller.signal }),
          apiClient.get('/contactos?conEmpresa=1', { signal: controller.signal }),
        ]);

        if (!cancelled) {
          const rawCentros = Array.isArray(centrosRes) ? centrosRes : (centrosRes.items || []);
          const rawContactos = Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || []);
          setAllCentros(rawCentros);
          setDirectory(buildProviderDirectory(rawCentros, rawContactos));
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        addToast({ title: 'Error', message: 'No se pudo cargar el directorio de proveedores.', type: 'error' });
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    }

    loadDirectory();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isModalOpen, directory.length, addToast]);

  const filteredProviders = useMemo(() => {
    if (!searchProviders.trim()) return [];
    const q = searchProviders.toLowerCase();
    return directory.filter(p => 
      (p.proveedorNombre || '').toLowerCase().includes(q) ||
      (p.proveedorKey || '').toLowerCase().includes(q) ||
      (p.contactoNombre || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [directory, searchProviders]);

  const handleSelectProvider = (provider) => {
    setSelectedProvider(provider);
    setForm(prev => ({
      ...prev,
      proveedorNombre: provider.proveedorNombre,
      proveedorKey: provider.proveedorKey,
      centroId: '',
      centroCodigo: ''
    }));
    setSearchProviders('');

    // Filtrar centros de este proveedor
    const centers = allCentros.filter(c => c.proveedorKey === provider.proveedorKey);
    setProviderCenters(centers);

    // Autoselección si hay solo uno
    if (centers.length === 1) {
      setForm(prev => ({
        ...prev,
        centroId: centers[0]._id,
        centroCodigo: centers[0].code
      }));
    }
  };

  // Cálculos Automáticos
  const totals = useMemo(() => {
    const isG = form.unidadPeso === 'g';
    const mult = isG ? 0.001 : 1;

    const vivo = Number(form.pesoVivo) || 0;
    const cocida = Number(form.pesoCocida) || 0;
    const rend = vivo > 0 ? (cocida / vivo) * 100 : 0;

    let totalMuestra = 0;
    let procesable = 0;
    let rechazos = 0;
    let defectos = 0;

    selectedCats.forEach(id => {
      const val = (Number(form.cats[id]) || 0) * mult;
      const cat = maestros.cats.find(c => c._id === id);
      totalMuestra += val;
      if (cat?.tipoCat === 'procesable') procesable += val;
      else if (cat?.tipoCat === 'rechazo') rechazos += val;
      else defectos += val;
    });

    return { rend, totalMuestra, procesable, rechazos, defectos };
  }, [form.pesoVivo, form.pesoCocida, form.cats, selectedCats, maestros.cats, form.unidadPeso]);

  const filtered = useMemo(() => {
    return muestreos.filter(m => 
      (m.proveedorNombre || m.proveedor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.centroCodigo || m.centro || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [muestreos, searchTerm]);

  const groupedData = useMemo(() => {
    const groups = {};
    filtered.forEach(m => {
      const key = m.proveedorNombre || m.proveedor || 'S/P';
      if (!groups[key]) {
        groups[key] = { 
          key,
          muestras: 0, 
          rendSum: 0, 
          uxkgSum: 0, 
          totalSum: 0,
          rechazosSum: 0,
          items: []
        };
      }
      groups[key].muestras++;
      groups[key].rendSum += Number(m.rendimiento) || 0;
      groups[key].uxkgSum += Number(m.uxkg) || 0;
      groups[key].totalSum += Number(m.total) || 0;
      groups[key].rechazosSum += Number(m.rechazos) || 0;
      groups[key].items.push(m);
    });
    return Object.values(groups).sort((a, b) => b.muestras - a.muestras);
  }, [filtered]);

  // Handlers
  const handleAdvanceOnEnter = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const container = e.target.closest('.mu-step-container');
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll('input:not([disabled]):not([readonly]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])'));
      const index = focusable.indexOf(e.target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  }, []);

  const handleEdit = useCallback((m) => {
    setEditingId(m._id || m.id);
    const mCats = m.cats || {};
    const newSelected = new Set();
    Object.keys(mCats).forEach(id => { if (Number(mCats[id]) > 0) newSelected.add(id); });
    maestros.cats.filter(c => c.tipoCat === 'procesable').forEach(c => newSelected.add(c._id));
    
    setSelectedCats(newSelected);
    setForm({
      proveedorNombre: m.proveedorNombre || m.proveedor || '',
      proveedorKey: m.proveedorKey || '',
      centroId: m.centroId || '',
      centroCodigo: m.centroCodigo || m.centro || '',
      linea: m.linea || '',
      fecha: (m.fecha || '').slice(0, 10),
      origen: m.origen || 'abastecimiento',
      responsable: m.responsable || '',
      uxkg: m.uxkg || '',
      pesoVivo: m.pesoVivo || '',
      pesoCocida: m.pesoCocida || '',
      cats: mCats,
      unidadPeso: m.unidadPeso || 'kg'
    });

    // Intentar restaurar contexto de proveedor/centros si el directorio ya existe
    if (directory.length > 0) {
      const pKey = (m.proveedorKey || '').toLowerCase();
      const p = directory.find(it => it.proveedorKey === pKey);
      if (p) {
        setSelectedProvider(p);
        setProviderCenters(allCentros.filter(c => c.proveedorKey === pKey));
      }
    }

    setStep(1);
    setIsModalOpen(true);
  }, [maestros.cats, directory, allCentros]);

  const handleSave = useCallback(async () => {
    const isG = form.unidadPeso === 'g';
    const mult = isG ? 0.001 : 1;

    const finalCats = {};
    selectedCats.forEach(id => {
      finalCats[id] = (Number(form.cats[id]) || 0) * mult;
    });

    const payload = { 
      ...form,
      uxkg: Number(form.uxkg) || 0,
      pesoVivo: Number(form.pesoVivo) || 0,
      pesoCocida: Number(form.pesoCocida) || 0,
      rendimiento: Number(totals.rend) || 0, 
      total: Number(totals.totalMuestra) || 0, 
      procesable: Number(totals.procesable) || 0, 
      rechazos: Number(totals.rechazos) || 0, 
      defectos: Number(totals.defectos) || 0, 
      cats: finalCats 
    };

    if (payload.fecha && payload.fecha.length === 10) {
      payload.fecha = new Date(payload.fecha + 'T12:00:00Z').toISOString();
    }
    
    delete payload.unidadPeso;

    try {
      const endpoint = editingId ? `/muestreos/${editingId}` : '/muestreos';
      const method = editingId ? 'patch' : 'post';
      
      const data = await apiClient[method](endpoint, payload);
      setResultData(data.item || data);
      setIsModalOpen(false);
      setIsResultOpen(true);
      loadData(page);
      addToast({ title: 'Éxito', message: `Muestreo ${editingId ? 'actualizado' : 'guardado'} correctamente.`, type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo guardar el muestreo.', type: 'error' });
    }
  }, [selectedCats, form, totals, editingId, page, addToast, loadData]);

  const toggleCatSelection = useCallback((id) => {
    const next = new Set(selectedCats);
    if (next.has(id)) {
      const cat = maestros.cats.find(c => c._id === id);
      if (cat?.tipoCat !== 'procesable') {
        next.delete(id);
        const nextCats = { ...form.cats };
        delete nextCats[id];
        setForm({ ...form, cats: nextCats });
      }
    } else {
      next.add(id);
    }
    setSelectedCats(next);
  }, [selectedCats, maestros.cats, form]);

  const toggleGroup = useCallback((key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  }, [expandedGroups]);

  const generarInformePDF = useCallback((m) => {
    if (!m) return;
    const clasificaciones = Array.isArray(m.clasificaciones) ? m.clasificaciones : [];
    const evaluacion      = Array.isArray(m.evaluacion)      ? m.evaluacion      : [];
    const primary   = clasificaciones[0];
    const rend      = Number(m.rendimiento) || 0;
    const uxkg      = Number(m.uxkg)        || 0;
    const total     = Number(m.total)       || 0;
    const procesable= Number(m.procesable)  || 0;
    const rechazos  = Number(m.rechazos)    || 0;
    const pctProc   = fmtNum(total > 0 ? (procesable / total) * 100 : 0, 1);
    const pctRech   = fmtNum(total > 0 ? (rechazos   / total) * 100 : 0, 1);
    const fecha     = m.fecha || new Date().toISOString().slice(0, 10);

    // Texto de recomendación automático
    let recomendacion = '';
    if (primary) {
      recomendacion = `La materia prima muestreada <strong>califica como ${primary.nombre}</strong>${primary.tipoPrincipal ? ` (tipo: ${primary.tipoPrincipal})` : ''}. Los indicadores R%: <strong>${fmtNum(rend, 2)}%</strong> y calibre <strong>${fmtNum(uxkg, 0)} un/kg</strong> se encuentran dentro de los rangos requeridos.`;
    } else {
      const fallosPrincipales = evaluacion.filter(e => !e.cumple);
      const detallesFallos = fallosPrincipales.length
        ? `<ul style="margin:8px 0 0 18px;font-size:13px;color:#7f1d1d;">${fallosPrincipales.map(e => `<li><strong>${e.nombre}</strong>: ${e.razon || 'No cumple los parámetros requeridos'}</li>`).join('')}</ul>`
        : '';
      recomendacion = `La materia prima muestreada <strong>no clasifica en ninguna categoría</strong> según los parámetros actuales del maestro.${detallesFallos}<br><br>Se recomienda hacer seguimiento para determinar si los indicadores mejoran con el tiempo (maduración de calibre o mejora de rendimiento) antes de programar cosecha.`;
    }

    const evalHTML = evaluacion.length ? evaluacion.map(ev => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="width:22px;height:22px;border-radius:50%;background:${ev.cumple ? '#22c55e' : '#ef4444'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px;">${ev.cumple ? '✓' : '✗'}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${ev.nombre}</div>
          ${ev.razon ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${ev.razon}</div>` : ''}
        </div>
      </div>`).join('') : '<div style="color:#94a3b8;font-size:13px;">Sin criterios configurados.</div>';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Muestreo — ${m.proveedorNombre || m.proveedor || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;padding:32px;font-size:14px;line-height:1.5}
  h1{font-size:22px;font-weight:800;color:#0f766e;margin-bottom:4px}
  .sub{font-size:13px;color:#64748b;margin-bottom:28px}
  .section{margin-bottom:22px}
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;letter-spacing:.06em;margin-bottom:10px;padding-bottom:5px;border-bottom:1.5px solid #e2e8f0}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:4px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
  .kpi-label{font-size:11px;color:#64748b;margin-bottom:4px}
  .kpi-val{font-size:22px;font-weight:800;color:#0f766e}
  .clas-box{border:2px solid #16a34a;border-radius:10px;padding:16px;text-align:center;background:#f0fdf4}
  .clas-box.fail{border-color:#ef4444;background:#fef2f2}
  .clas-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569}
  .clas-val{font-size:26px;font-weight:800;color:#16a34a;margin-top:4px}
  .clas-val.fail{color:#ef4444}
  .rec-box{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.7}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;text-align:right;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:16px}.no-print{display:none}}
</style>
</head>
<body>
  <div class="no-print" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:700;">Informe de Muestreo MMPP — Vista preliminar</span>
    <button onclick="window.print()" style="background:#fff;color:#0f766e;border:none;padding:6px 16px;border-radius:6px;font-weight:700;cursor:pointer;">Imprimir / Guardar PDF</button>
  </div>
  <h1>Informe de Muestreo MMPP</h1>
  <div class="sub">${m.proveedorNombre || m.proveedor || '—'} &nbsp;·&nbsp; Centro: ${m.centro || m.centroCodigo || '—'} &nbsp;·&nbsp; Línea: ${m.linea || '—'} &nbsp;·&nbsp; Fecha: ${fecha} &nbsp;·&nbsp; Responsable: ${m.responsable || m.responsablePG || '—'}</div>
  <div class="section">
    <div class="sec-title">Indicadores del Muestreo</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">R% Carne</div><div class="kpi-val">${fmtNum(rend, 2)}%</div></div>
      <div class="kpi"><div class="kpi-label">U × Kg (Calibre)</div><div class="kpi-val">${fmtNum(uxkg, 0)}</div></div>
      <div class="kpi"><div class="kpi-label">Procesable</div><div class="kpi-val">${pctProc}%</div></div>
      <div class="kpi"><div class="kpi-label">Rechazo</div><div class="kpi-val">${pctRech}%</div></div>
    </div>
  </div>
  <div class="section">
    <div class="sec-title">Clasificación</div>
    <div class="clas-box ${primary ? '' : 'fail'}">
      <div class="clas-label">Tipo de producto</div>
      <div class="clas-val ${primary ? '' : 'fail'}">${primary ? primary.nombre : 'S/C — No clasifica'}</div>
      ${primary?.tipoPrincipal ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">${primary.tipoPrincipal}</div>` : ''}
    </div>
  </div>
  <div class="section">
    <div class="sec-title">Evaluación por Criterio (Parámetros Maestro)</div>
    ${evalHTML}
  </div>
  <div class="section">
    <div class="sec-title">Recomendación</div>
    <div class="rec-box">${recomendacion}</div>
  </div>
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-CL')} · Sistema MMPP Abastecimiento</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=860,height=960');
    if (!win) { 
      addToast({ title: 'Bloqueo Detectado', message: 'Habilita ventanas emergentes para generar el informe', type: 'warning' });
      return; 
    }
    win.document.write(html);
    win.document.close();
  }, [addToast]);

  // Render Helpers
  const renderStepIndicator = () => (
    <div className="mu-steps-header am-mb-24">
      {[1, 2, 3].map(n => (
        <div 
          key={n} 
          className={`mu-step-item ${step === n ? 'active' : ''} ${step > n ? 'completed' : ''}`}
          onClick={() => n < step && setStep(n)}
        >
          <div className="mu-step-circle">{step > n ? <Check size={14} /> : n}</div>
          <span className="mu-step-label">
            {n === 1 ? 'Contexto' : n === 2 ? 'Análisis' : 'Resultado'}
          </span>
          {n < 3 && <div className="mu-step-line" />}
        </div>
      ))}
    </div>
  );

  const renderOrigenSelector = () => (
    <div className="mx-form-group">
      <label className="mx-label">Origen del Muestreo</label>
      <select 
        className="mx-select"
        value={form.origen}
        onChange={e => setForm({...form, origen: e.target.value})}
      >
        <option value="abastecimiento">Abastecimiento</option>
        <option value="calidad">Control Calidad</option>
      </select>
    </div>
  );

  return (
    <div className="muestreos-container am-p-24" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      <div className="mx-toolbar am-mt-16">
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => { setViewMode('list'); setPage(1); }}><List size={14} /> Historial</button>
          <button className={`mx-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`} onClick={() => { setViewMode('grouped'); setPage(1); }}><LayoutGrid size={14} /> Agrupado</button>
        </div>
        <div className="mx-search-box" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor o centro..." 
            className="mx-input" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <button className="mx-btn mx-btn-outline sm" onClick={() => { setPage(1); loadData(1); }}><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary sm" onClick={resetForm}>
          <Plus size={18} /> Muestreo
        </button>
      </div>

      {loading ? (
        <div className="am-p-64 am-text-center"><div className="mx-loader"></div></div>
      ) : (
        <div className="mx-table-card am-mt-16">
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  <th style={{ width: viewMode === 'grouped' ? '40px' : '100px' }}>{viewMode === 'grouped' ? '' : 'Fecha'}</th>
                  <th>Proveedor / Centro</th>
                  <th style={{ textAlign: 'center' }}>Muestras</th>
                  <th style={{ textAlign: 'center' }}>R% Prom.</th>
                  <th style={{ textAlign: 'center' }}>U x Kg</th>
                  <th style={{ textAlign: 'center' }}>Procesable %</th>
                  <th style={{ textAlign: 'center' }}>% Rechazo</th>
                  <th style={{ textAlign: 'center' }}>{viewMode === 'list' ? 'Calificación' : ''}</th>
                  <th style={{ textAlign: 'right' }}>{viewMode === 'list' ? 'Acciones' : ''}</th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'list' ? (
                  filtered.map(m => (
                    <tr key={m._id || m.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL') : '—'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{m.proveedorNombre || m.proveedor}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={10} /> {m.centroCodigo || 'Sin Centro'} {m.linea && `· L: ${m.linea}`}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>1</td>
                      <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-info" style={{ fontWeight: 700 }}>{Number(m.rendimiento || 0).toFixed(1)}%</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{m.uxkg || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>
                        {m.total > 0 ? (m.procesable / m.total * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: (m.total > 0 && m.rechazos/m.total > 0.05) ? 'var(--color-error)' : 'inherit' }}>
                          {m.total > 0 ? (m.rechazos / m.total * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {m.clasificaciones?.[0] ? <span className="mx-badge mx-badge-success">{m.clasificaciones[0].nombre}</span> : <span className="mx-badge mx-badge-muted">S/C</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="mx-action-btn print" title="Informe PDF" onClick={() => generarInformePDF(m)}><Printer size={14} /></button>
                          <button className="mx-action-btn edit" title="Editar" onClick={() => handleEdit(m)}><Edit size={14} /></button>
                          <button className="mx-action-btn delete" title="Eliminar" onClick={() => { setDeleteTarget(m); setDeleteOpen(true); }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  groupedData.map(g => (
                    <React.Fragment key={g.key}>
                      <tr onClick={() => toggleGroup(g.key)} style={{ cursor: 'pointer', background: expandedGroups.has(g.key) ? 'var(--color-primary-bg)' : 'white' }}>
                        <td style={{ textAlign: 'center' }}>{expandedGroups.has(g.key) ? <ChevronUp size={16} color="var(--color-primary)" /> : <ChevronDown size={16} />}</td>
                        <td style={{ fontWeight: 800, color: 'var(--color-text)' }}>{g.key}</td>
                        <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-muted" style={{ fontWeight: 700 }}>{g.muestras}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-primary)' }}>{(g.rendSum / g.muestras).toFixed(1)}%</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{(g.uxkgSum / g.muestras).toFixed(0)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>
                          {g.totalSum > 0 ? ( (g.totalSum - g.rechazosSum) / g.totalSum * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: (g.rechazosSum / g.totalSum * 100) > 5 ? 'var(--color-error)' : 'inherit' }}>
                          {(g.totalSum > 0 ? (g.rechazosSum / g.totalSum * 100).toFixed(1) : 0)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td style={{ textAlign: 'right' }}><ChevronRight size={14} style={{ opacity: 0.2 }} /></td>
                      </tr>
                      {expandedGroups.has(g.key) && g.items.map(m => (
                        <tr key={m._id} style={{ background: '#fafafa' }}>
                          <td style={{ textAlign: 'right', borderRight: '2px solid var(--color-primary)' }}></td>
                          <td style={{ paddingLeft: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>{new Date(m.fecha).toLocaleDateString('es-CL')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>{m.centroCodigo || 'Sin Centro'} {m.linea && `· L: ${m.linea}`}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>1</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{Number(m.rendimiento).toFixed(1)}%</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{m.uxkg}</td>
                          <td style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-success)', fontWeight: 700 }}>
                            {m.total > 0 ? (m.procesable / m.total * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{m.total > 0 ? (m.rechazos / m.total * 100).toFixed(1) : 0}%</td>
                          <td style={{ textAlign: 'center' }}>
                            {m.clasificaciones?.[0] ? <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>{m.clasificaciones[0].nombre}</span> : <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>S/C</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                              <button className="mx-action-btn print" style={{ width: '28px', height: '28px' }} title="Informe PDF" onClick={(e) => { e.stopPropagation(); generarInformePDF(m); }}><Printer size={12} /></button>
                              <button className="mx-action-btn edit" style={{ width: '28px', height: '28px' }} title="Editar" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}><Edit size={12} /></button>
                              <button className="mx-action-btn delete" style={{ width: '28px', height: '28px' }} title="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); setDeleteOpen(true); }}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación — solo vista lista */}
          {viewMode === 'list' && pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-subtle)' }}>
                {pagination.total} muestreos &nbsp;·&nbsp; Pág. {pagination.page} / {pagination.pages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="mx-btn mx-btn-outline sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ArrowLeft size={14} /> Anterior
                </button>
                <button
                  className="mx-btn mx-btn-outline sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                >
                  Siguiente <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reutilización del modal de confirmación existente */}
      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar este muestreo?"
        itemName={deleteTarget?.proveedorNombre || deleteTarget?.proveedor}
        description={deleteTarget ? `Estás por eliminar el muestreo del ${new Date(deleteTarget.fecha).toLocaleDateString('es-CL')}${deleteTarget.centroCodigo ? ` en el centro ${deleteTarget.centroCodigo}` : ''}. Esta acción no se puede deshacer.` : ''}
      />

      {/* MODAL PRINCIPAL (3 FASES RESTAURADAS) */}
      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '800px', width: '95%', boxSizing: 'border-box' }}>
            <div className="mx-modal-header" style={{ width: '100%', boxSizing: 'border-box' }}>
              <div>
                <h3 className="mx-modal-title">{editingId ? 'Editar' : 'Nuevo'} Muestreo Técnico</h3>
                <p className="mx-modal-sub">{step === 1 ? 'Datos de origen y contexto' : step === 2 ? 'Análisis de categorías y mermas' : 'Resultados y clasificación'}</p>
              </div>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="mx-modal-body" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'clip', minWidth: 0 }}>
              {renderStepIndicator()}

              {/* FASE 1: CONTEXTO */}
              {step === 1 && (
                <div className="mu-step-container" style={{ animation: 'slideInRight 0.3s ease-out', width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
                  <div className="mx-form-row" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div className="mx-form-group" style={{ flex: 1, position: 'relative', minWidth: 0, boxSizing: 'border-box' }}>
                      <label className="mx-label"><User size={14} /> 1. Proveedor</label>
                      {!selectedProvider ? (
                        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                          <div className="mx-search-box" style={{ width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                            <Search size={16} />
                            <input 
                              className="mx-input" 
                              placeholder="Buscar proveedor..." 
                              value={searchProviders} 
                              onChange={e => setSearchProviders(e.target.value)} 
                              style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          
                          {filteredProviders.length > 0 && (
                            <div style={{ 
                              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                              background: 'white', borderRadius: '12px', border: '1px solid var(--color-border)',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginTop: '4px', overflow: 'hidden'
                            }}>
                              {filteredProviders.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectProvider(p)}
                                  style={{ 
                                    width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', 
                                    background: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column'
                                  }}
                                  className="mu-provider-opt"
                                >
                                  <strong style={{ fontSize: '0.9rem' }}>{p.proveedorNombre}</strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>{p.comuna} · {p.contactoNombre || 'Sin contacto'}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {searchProviders.trim() && filteredProviders.length === 0 && !loadingProviders && (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-subtle)' }}>
                              Sin proveedores encontrados.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ 
                          padding: '10px 14px', borderRadius: '12px', background: 'var(--color-primary-bg)', 
                          border: '1px solid var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <div>
                            <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{selectedProvider.proveedorNombre}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>{selectedProvider.comuna}</div>
                          </div>
                          <button 
                            type="button" 
                            className="mx-btn-icon" 
                            style={{ width: '24px', height: '24px' }}
                            onClick={() => { setSelectedProvider(null); setProviderCenters([]); setForm(prev => ({ ...prev, proveedorNombre: '', proveedorKey: '', centroId: '', centroCodigo: '' })); }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mx-form-row am-mt-16" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div className="mx-form-group" style={{ flex: 2, minWidth: 0, boxSizing: 'border-box' }}>
                      <label className="mx-label"><MapPin size={14} /> 2. Centro</label>
                      <select 
                        className="mx-select"
                        value={form.centroId}
                        onChange={e => {
                          const c = providerCenters.find(it => it._id === e.target.value);
                          setForm(prev => ({ ...prev, centroId: e.target.value, centroCodigo: c?.code || '' }));
                        }}
                        disabled={!selectedProvider || providerCenters.length === 0}
                        style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
                      >
                        <option value="">{!selectedProvider ? 'Selecciona proveedor primero' : providerCenters.length === 0 ? 'Sin centros registrados' : 'Selecciona un centro...'}</option>
                        {providerCenters.map(c => (
                          <option key={c._id} value={c._id}>{c.code} - {c.comuna} {c.areaPSMB ? `(${c.areaPSMB})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mx-form-group" style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}>
                      <label className="mx-label"><Layers size={14} /> Línea</label>
                      <input className="mx-input" placeholder="N° Línea..." value={form.linea} onChange={e => setForm({...form, linea: e.target.value})} style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div className="mx-form-row am-mt-16" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div className="mx-form-group" style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}>
                      <label className="mx-label"><Calendar size={14} /> Fecha</label>
                      <input type="date" className="mx-input" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div className="mx-form-group" style={{ flex: 2, minWidth: 0, boxSizing: 'border-box' }}>
                      <label className="mx-label"><User size={14} /> Responsable</label>
                      <input 
                        className="mx-input" 
                        placeholder="Nombre..." 
                        value={form.responsable} 
                        onChange={e => setForm({...form, responsable: e.target.value})}
                        readOnly
                        style={{ background: 'var(--color-bg)', cursor: 'default', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div className="am-mt-16" style={{ maxWidth: '300px' }}>
                    {renderOrigenSelector()}
                  </div>
                </div>
              )}

              {/* FASE 2: ANÁLISIS DE CATEGORÍAS */}
              {step === 2 && (
                <div className="mu-step-container" style={{ animation: 'slideInRight 0.3s ease-out' }}>
                  <div className="am-mb-24">
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text)' }}>Datos base de la muestra</h4>
                    <div className="mx-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                      <div className="mx-form-group">
                        <label className="mx-label">Unidades por kilo</label>
                        <input 
                          type="number" 
                          className="mx-input" 
                          value={form.uxkg} 
                          onChange={e => setForm({...form, uxkg: e.target.value})} 
                          onKeyDown={handleAdvanceOnEnter}
                          placeholder="0" 
                          min="0"
                        />
                      </div>
                      <div className="mx-form-group">
                        <label className="mx-label">Peso vivo (kg)</label>
                        <input 
                          type="number" 
                          className="mx-input" 
                          value={form.pesoVivo} 
                          onChange={e => setForm({...form, pesoVivo: e.target.value})} 
                          onKeyDown={handleAdvanceOnEnter}
                          placeholder="0.00" 
                          min="0" 
                          step="0.01"
                        />
                      </div>
                      <div className="mx-form-group">
                        <label className="mx-label">Peso carne (kg)</label>
                        <input 
                          type="number" 
                          className="mx-input" 
                          value={form.pesoCocida} 
                          onChange={e => setForm({...form, pesoCocida: e.target.value})} 
                          onKeyDown={handleAdvanceOnEnter}
                          placeholder="0.00" 
                          min="0" 
                          step="0.01"
                        />
                      </div>
                      <div className="mx-form-group">
                        <label className="mx-label">Rendimiento %</label>
                        <input 
                          type="text" 
                          className="mx-input" 
                          value={`${fmtNum(totals.rend, 1)}%`} 
                          readOnly 
                          style={{ 
                            background: 'var(--color-bg)', 
                            cursor: 'default', 
                            fontWeight: 700, 
                            color: 'var(--color-primary)' 
                          }} 
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Categorías</h4>
                    <div className="mx-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                      <label className="mx-label" style={{ margin: 0, fontSize: '0.8rem' }}>Unidad de peso:</label>
                      <select 
                        className="mx-select" 
                        value={form.unidadPeso || 'kg'} 
                        onChange={e => setForm({...form, unidadPeso: e.target.value})} 
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', minWidth: '60px' }}
                        tabIndex={-1}
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                    </div>
                  </div>
                  <div className="mu-cat-selector-bar">
                    {['procesable', 'rechazo', 'defecto'].map(type => (
                      <div key={type} className="mu-cat-group-wrap">
                        <button 
                          type="button"
                          tabIndex={-1}
                          className={`mu-cat-group-btn ${type} ${activeDropdown === type ? 'open' : ''}`}
                          onClick={() => setActiveDropdown(activeDropdown === type ? null : type)}
                        >
                          <span>{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
                          <ChevronDown size={14} />
                          {maestros.cats.filter(c => c.tipoCat === type && selectedCats.has(c._id)).length > 0 && (
                            <span className="count">{maestros.cats.filter(c => c.tipoCat === type && selectedCats.has(c._id)).length}</span>
                          )}
                        </button>
                        
                        {activeDropdown === type && (
                          <div className="mu-cat-dropdown shadow-lg">
                            {maestros.cats.filter(c => c.tipoCat === type).map(c => (
                              <label key={c._id} className="mu-cat-option">
                                <input 
                                  type="checkbox" 
                                  checked={selectedCats.has(c._id)} 
                                  disabled={type === 'procesable'}
                                  tabIndex={-1}
                                  onChange={() => toggleCatSelection(c._id)} 
                                />
                                <span>{c.nombre}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mu-cat-table-wrap am-mt-16">
                    <table className="mu-cat-table">
                      <thead>
                        <tr>
                          <th>Categoría Seleccionada</th>
                          <th style={{ textAlign: 'right' }}>Peso ({form.unidadPeso || 'kg'})</th>
                          <th style={{ textAlign: 'right' }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selectedCats]
                          .sort((a, b) => {
                            const order = { procesable: 1, rechazo: 2, defecto: 3 };
                            const catA = maestros.cats.find(c => c._id === a);
                            const catB = maestros.cats.find(c => c._id === b);
                            return (order[catA?.tipoCat] || 4) - (order[catB?.tipoCat] || 4);
                          })
                          .map(id => {
                          const cat = maestros.cats.find(c => c._id === id);
                          if (!cat) return null;
                          const val = Number(form.cats[id]) || 0;
                          const pct = totals.totalMuestra > 0 ? (val / totals.totalMuestra) * 100 : 0;
                          return (
                            <tr key={id} className={`mu-row-${cat.tipoCat}`}>
                              <td>
                                <div className="mu-cat-name">
                                  <span className={`dot ${cat.tipoCat}`}></span>
                                  {cat.nombre}
                                  {cat.tipoCat !== 'procesable' && (
                                    <button type="button" tabIndex={-1} className="mu-remove" onClick={() => toggleCatSelection(id)}>×</button>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <input 
                                  type="number" 
                                  className="mu-cat-input" 
                                  value={form.cats[id] || ''} 
                                  onChange={e => setForm({...form, cats: {...form.cats, [id]: e.target.value}})}
                                  onKeyDown={handleAdvanceOnEnter}
                                  placeholder={form.unidadPeso === 'g' ? "0" : "0.00"}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, opacity: 0.7 }}>{fmtNum(pct, 1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mu-totals-grid am-mt-24">
                    <div className="mu-total-card">
                      <label>Total Muestra</label>
                      <div className="val">{fmtNum(totals.totalMuestra, 2)} kg</div>
                    </div>
                    <div className="mu-total-card procesable">
                      <label>Procesable %</label>
                      <div className="val">{fmtNum(totals.totalMuestra > 0 ? 100 - ((totals.rechazos / totals.totalMuestra) * 100) : 0, 1)}%</div>
                    </div>
                    <div className="mu-total-card rechazo">
                      <label>Rechazos %</label>
                      <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.rechazos / totals.totalMuestra) * 100 : 0, 1)}%</div>
                    </div>
                    <div className="mu-total-card defecto">
                      <label>Defectos %</label>
                      <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.defectos / totals.totalMuestra) * 100 : 0, 1)}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* FASE 3: RESULTADO FINAL */}
              {step === 3 && (
                <div className="mu-step-container am-text-center am-py-32" style={{ animation: 'slideInRight 0.3s ease-out' }}>
                  <div className="mu-result-hero">
                    <Target size={48} color="var(--color-primary)" />
                    <h3 className="am-mt-16">Resumen del Análisis</h3>
                    <p className="am-mb-32">Verifica los datos antes de guardar la calificación oficial.</p>
                  </div>

                  <div className="mu-result-grid">
                    <div className="mu-res-item">
                      <label>Rendimiento Carne</label>
                      <div className="val">{fmtNum(totals.rend, 1)}%</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Unidades por kilo</label>
                      <div className="val">{form.uxkg || 0}</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Muestra Total</label>
                      <div className="val">{fmtNum(totals.totalMuestra, 2)} kg</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Procesable</label>
                      <div className="val success">{fmtNum(totals.totalMuestra > 0 ? 100 - ((totals.rechazos / totals.totalMuestra) * 100) : 0, 1)}%</div>
                    </div>
                  </div>

                  <div className="mu-confirm-msg am-mt-32">
                    <AlertTriangle size={16} />
                    <span>Este muestreo será registrado por <strong>{form.responsable || 'Usuario Sistema'}</strong> para el proveedor <strong>{form.proveedorNombre}</strong>.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mx-modal-footer" style={{ justifyContent: 'space-between', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <button 
                className="mx-btn mx-btn-outline" 
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <ArrowLeft size={16} /> Atrás
              </button>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                {step < 3 ? (
                  <button className="mx-btn mx-btn-primary" onClick={() => setStep(s => s + 1)}>
                    Siguiente <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="mx-btn mx-btn-primary" onClick={handleSave}>
                    <CheckCircle2 size={16} /> Guardar Calificación
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESULTADO (POPUP DE CLASIFICACIÓN) */}
      {isResultOpen && resultData && (
        <div className="mx-modal-overlay">
          <div className="mx-modal shadow-2xl" style={{ maxWidth: '400px', textAlign: 'center', borderRadius: '24px', padding: '24px' }}>
            <div className="mu-result-success-animation">
              {resultData.clasificaciones?.[0] ? (
                <div className="mu-icon-pulse success"><Award size={64} /></div>
              ) : (
                <div className="mu-icon-pulse error"><AlertTriangle size={64} /></div>
              )}
            </div>
            
            <h2 style={{ marginTop: '24px', fontWeight: 900, color: 'var(--color-text)' }}>
              {resultData.clasificaciones?.[0]?.nombre || 'Sin Clasificación'}
            </h2>
            <p style={{ color: 'var(--color-text-subtle)', marginTop: '8px' }}>
              La materia prima ha sido analizada y calificada según los parámetros vigentes.
            </p>

            <div className="mu-result-mini-kpis am-mt-24">
              <div className="kpi"><span>R%</span><strong>{Number(resultData.rendimiento).toFixed(1)}%</strong></div>
              <div className="kpi"><span>UxKg</span><strong>{resultData.uxkg}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="mx-btn mx-btn-outline" style={{ flex: 1 }} onClick={() => setIsResultOpen(false)}>Cerrar</button>
              <button className="mx-btn mx-btn-primary" style={{ flex: 1 }} onClick={() => generarInformePDF(resultData)}>
                <Printer size={16} /> Informe
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .mu-steps-header { display: flex; align-items: center; justify-content: space-between; position: relative; width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden; }
        .mu-step-item { display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1; cursor: pointer; flex: 1; position: relative; }
        .mu-step-circle { width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #64748b; transition: all 0.3s; }
        .mu-step-item.active .mu-step-circle { background: var(--color-primary); color: white; transform: scale(1.1); box-shadow: 0 0 15px var(--color-primary-bg); }
        .mu-step-item.completed .mu-step-circle { background: var(--color-success); color: white; }
        .mu-step-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
        .mu-step-item.active .mu-step-label { color: var(--color-primary); }
        .mu-step-line { position: absolute; top: 16px; left: 50%; width: 100%; height: 2px; background: #e2e8f0; z-index: -1; }
        
        .mu-origen-group { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .mu-origen-btn { flex: 1; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; }
        .mu-origen-btn.active { background: white; color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

        .mu-kpi-inputs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .mu-input-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
        .mu-input-card label { display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .mu-input-card input { width: 100%; border: none; background: transparent; font-size: 18px; font-weight: 800; color: var(--color-text); outline: none; }
        .mu-input-card.highlight { background: var(--color-primary); border-color: var(--color-primary); }
        .mu-input-card.highlight label { color: rgba(255,255,255,0.8); }
        .mu-input-card.highlight .val { font-size: 20px; font-weight: 900; color: white; }

        .mu-cat-selector-bar { display: flex; gap: 12px; }
        .mu-cat-group-wrap { position: relative; flex: 1; }
        .mu-cat-group-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: white; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.2s; }
        .mu-cat-group-btn.procesable { color: var(--color-success); }
        .mu-cat-group-btn.defecto { color: var(--color-info); }
        .mu-cat-group-btn.rechazo { color: var(--color-error); }
        .mu-cat-group-btn.open { border-color: currentColor; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .mu-cat-group-btn .count { background: currentColor; color: white; font-size: 10px; padding: 2px 6px; border-radius: 20px; }

        .mu-cat-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 100%; background: white; border-radius: 12px; border: 1px solid #e2e8f0; z-index: 100; max-height: 250px; overflow-y: auto; padding: 8px; }
        .mu-cat-option { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; }
        .mu-cat-option:hover { background: #f8fafc; }

        .mu-cat-table { width: 100%; border-collapse: collapse; }
        .mu-cat-table th { font-size: 11px; text-transform: uppercase; color: #94a3b8; padding: 12px; border-bottom: 1px solid #f1f5f9; }
        .mu-cat-table td { padding: 8px 12px; border-bottom: 1px solid #f8fafc; }
        .mu-row-procesable { background: #f0fdf4; }
        .mu-row-defecto { background: #eff6ff; }
        .mu-row-rechazo { background: #fef2f2; }
        .mu-cat-name { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; }
        .mu-cat-name .dot { width: 8px; height: 8px; border-radius: 50%; }
        .mu-cat-name .dot.procesable { background: var(--color-success); }
        .mu-cat-name .dot.defecto { background: var(--color-info); }
        .mu-cat-name .dot.rechazo { background: var(--color-error); }
        .mu-cat-input { width: 100px; height: 32px; border: 1.5px solid #e2e8f0; border-radius: 8px; text-align: right; padding: 0 8px; font-weight: 700; font-size: 14px; }
        .mu-remove { border: none; background: transparent; color: #94a3b8; cursor: pointer; font-size: 18px; margin-left: auto; }
        .mu-remove:hover { color: var(--color-error); }

        .mu-totals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .mu-total-card { background: #f1f5f9; padding: 16px; border-radius: 16px; text-align: center; }
        .mu-total-card label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .mu-total-card .val { font-size: 20px; font-weight: 900; margin-top: 4px; }
        .mu-total-card.procesable { background: #dcfce7; color: #16a34a; }
        .mu-total-card.defecto { background: #fff7ed; color: #ea580c; }
        .mu-total-card.rechazo { background: #fee2e2; color: #ef4444; }

        .mu-result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 500px; margin: 0 auto; }
        .mu-res-item { background: white; border: 1.5px solid #f1f5f9; padding: 20px; border-radius: 20px; }
        .mu-res-item label { font-size: 12px; color: #94a3b8; font-weight: 600; }
        .mu-res-item .val { font-size: 24px; font-weight: 900; color: var(--color-text); margin-top: 8px; }
        .mu-res-item .val.success { color: var(--color-success); }

        .mu-result-mini-kpis { display: flex; justify-content: center; gap: 24px; background: #f8fafc; padding: 16px; border-radius: 16px; }
        .mu-result-mini-kpis .kpi { display: flex; flex-direction: column; }
        .mu-result-mini-kpis .kpi span { font-size: 11px; font-weight: 800; color: #94a3b8; }
        .mu-result-mini-kpis .kpi strong { font-size: 18px; color: var(--color-primary); }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}} />
    </div>
  );
}
