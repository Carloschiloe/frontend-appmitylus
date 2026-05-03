import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  X,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  Award,
  TrendingUp,
  Edit,
  Trash2,
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
  Target
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

const fmtNum = (v, d = 2) => (Number(v) || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function Muestreos() {
  const { addToast } = useToast();
  const [muestreos, setMuestreos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [step, setStep] = useState(1); 
  const [editingId, setEditingId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Maestros
  const [maestros, setMaestros] = useState({ cats: [], rules: [] });
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null); // 'procesable' | 'rechazo' | 'defecto'

  // Formulario Completo (Restaurado)
  const [form, setForm] = useState({
    proveedorNombre: '',
    centroCodigo: '',
    linea: '',
    fecha: new Date().toISOString().slice(0, 10),
    origen: 'abastecimiento',
    responsable: '',
    uxkg: '',
    pesoVivo: '',
    pesoCocida: '',
    cats: {}
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [muRes, catsRes, rulesRes] = await Promise.all([
        apiClient.get('/muestreos?limit=2000').catch(() => ({ items: [] })),
        apiClient.get('/maestros?tipo=categoria-muestreo&soloActivos=true').catch(() => ({ items: [] })),
        apiClient.get('/maestros?tipo=clasificacion_producto&soloActivos=true').catch(() => ({ items: [] }))
      ]);
      setMuestreos(Array.isArray(muRes) ? muRes : (muRes.items || []));
      setMaestros({ 
        cats: catsRes.items || [], 
        rules: rulesRes.items || [] 
      });
    } catch (err) { 
      console.error('Error cargando datos:', err);
      addToast({ title: 'Error', message: 'No se pudieron cargar los datos.', type: 'error' });
    }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cálculos Automáticos
  const totals = useMemo(() => {
    const vivo = Number(form.pesoVivo) || 0;
    const cocida = Number(form.pesoCocida) || 0;
    const rend = vivo > 0 ? (cocida / vivo) * 100 : 0;

    let totalMuestra = 0;
    let procesable = 0;
    let rechazos = 0;
    let defectos = 0;

    selectedCats.forEach(id => {
      const val = Number(form.cats[id]) || 0;
      const cat = maestros.cats.find(c => c._id === id);
      totalMuestra += val;
      if (cat?.tipoCat === 'procesable') procesable = val;
      else if (cat?.tipoCat === 'rechazo') rechazos += val;
      else defectos += val;
    });

    return { rend, totalMuestra, procesable, rechazos, defectos };
  }, [form.pesoVivo, form.pesoCocida, form.cats, selectedCats, maestros.cats]);

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
  const handleEdit = (m) => {
    setEditingId(m._id || m.id);
    const mCats = m.cats || {};
    const newSelected = new Set();
    Object.keys(mCats).forEach(id => { if (Number(mCats[id]) > 0) newSelected.add(id); });
    maestros.cats.filter(c => c.tipoCat === 'procesable').forEach(c => newSelected.add(c._id));
    
    setSelectedCats(newSelected);
    setForm({
      proveedorNombre: m.proveedorNombre || m.proveedor || '',
      centroCodigo: m.centroCodigo || m.centro || '',
      linea: m.linea || '',
      fecha: (m.fecha || '').slice(0, 10),
      origen: m.origen || 'abastecimiento',
      responsable: m.responsable || '',
      uxkg: m.uxkg || '',
      pesoVivo: m.pesoVivo || '',
      pesoCocida: m.pesoCocida || '',
      cats: mCats
    });
    setStep(1);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const finalCats = {};
    selectedCats.forEach(id => {
      finalCats[id] = Number(form.cats[id]) || 0;
    });

    const payload = { 
      ...form, 
      rendimiento: totals.rend, 
      total: totals.totalMuestra, 
      procesable: totals.procesable, 
      rechazos: totals.rechazos, 
      defectos: totals.defectos, 
      cats: finalCats 
    };

    try {
      const endpoint = editingId ? `/muestreos/${editingId}` : '/muestreos';
      const method = editingId ? 'patch' : 'post';
      
      const data = await apiClient[method](endpoint, payload);
      setResultData(data.item || data); 
      setIsModalOpen(false); 
      setIsResultOpen(true); 
      loadData();
      addToast({ title: 'Éxito', message: `Muestreo ${editingId ? 'actualizado' : 'guardado'} correctamente.`, type: 'success' });
    } catch (err) { 
      console.error(err);
      addToast({ title: 'Error', message: 'No se pudo guardar el muestreo.', type: 'error' });
    }
  };

  const toggleCatSelection = (id) => {
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
  };

  const toggleGroup = (key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

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
    <div className="mx-field">
      <label className="mx-label">Origen / Responsable del Muestreo</label>
      <div className="mu-origen-group">
        <button 
          className={`mu-origen-btn ${form.origen === 'abastecimiento' ? 'active' : ''}`}
          onClick={() => setForm({...form, origen: 'abastecimiento'})}
        >
          Abastecimiento
        </button>
        <button 
          className={`mu-origen-btn ${form.origen === 'calidad' ? 'active' : ''}`}
          onClick={() => setForm({...form, origen: 'calidad'})}
        >
          Control Calidad
        </button>
      </div>
    </div>
  );

  return (
    <div className="muestreos-container am-p-24" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="mx-table-head">
        <div className="mx-table-title">
          <div className="mx-header-icon"><Beaker size={20} /></div>
          <div>
            <h2>Gestión de Muestreos MMPP</h2>
            <p>Análisis técnico, clasificación y control de rendimientos.</p>
          </div>
        </div>
        <div className="mx-table-actions">
          <div className="mx-toggle-group am-mr-12">
            <button className={`mx-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={16} /> Historial</button>
            <button className={`mx-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`} onClick={() => setViewMode('grouped')}><LayoutGrid size={16} /> Agrupado</button>
          </div>
          <button className="mx-btn mx-btn-primary" onClick={() => { setEditingId(null); setStep(1); setForm({...form, cats: {}}); setSelectedCats(new Set(maestros.cats.filter(c => c.tipoCat === 'procesable').map(c => c._id))); setIsModalOpen(true); }}>
            <Plus size={18} /> Nuevo Muestreo
          </button>
        </div>
      </div>

      <div className="centros-filters am-mt-32">
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} /><input type="text" placeholder="Buscar por proveedor o centro..." className="centros-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
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
                  <th style={{ textAlign: 'center' }}>% Rechazo</th>
                  <th style={{ textAlign: 'right' }}>{viewMode === 'list' ? 'Calificación' : ''}</th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'list' ? (
                  filtered.map(m => (
                    <tr key={m._id || m.id}>
                      <td style={{ fontWeight: 600 }}>{m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL') : '—'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{m.proveedorNombre || m.proveedor}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={10} /> {m.centroCodigo || 'Sin Centro'} {m.linea && `· L: ${m.linea}`}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>—</td>
                      <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-info" style={{ fontWeight: 700 }}>{Number(m.rendimiento || 0).toFixed(1)}%</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{m.uxkg || 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: (m.total > 0 && m.rechazos/m.total > 0.05) ? 'var(--color-error)' : 'inherit' }}>
                          {m.total > 0 ? (m.rechazos / m.total * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {m.clasificaciones?.[0] ? <span className="mx-badge mx-badge-success">{m.clasificaciones[0].nombre}</span> : <span className="mx-badge mx-badge-muted">S/C</span>}
                          <button className="mx-action-btn print" title="Informe PDF" onClick={() => generarInformePDF(m)}><Printer size={14} /></button>
                          <button className="mx-action-btn edit" title="Editar" onClick={() => handleEdit(m)}><Edit size={14} /></button>
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
                        <td style={{ textAlign: 'center', fontWeight: 700, color: (g.rechazosSum / g.totalSum * 100) > 5 ? 'var(--color-error)' : 'inherit' }}>
                          {(g.totalSum > 0 ? (g.rechazosSum / g.totalSum * 100).toFixed(1) : 0)}%
                        </td>
                        <td style={{ textAlign: 'right' }}><ChevronRight size={14} style={{ opacity: 0.2 }} /></td>
                      </tr>
                      {expandedGroups.has(g.key) && g.items.map(m => (
                        <tr key={m._id} style={{ background: '#fafafa' }}>
                          <td style={{ textAlign: 'right', borderRight: '2px solid var(--color-primary)' }}></td>
                          <td style={{ paddingLeft: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>{new Date(m.fecha).toLocaleDateString('es-CL')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>{m.centroCodigo || 'Sin Centro'} {m.linea && `· L: ${m.linea}`}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>—</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{Number(m.rendimiento).toFixed(1)}%</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{m.uxkg}</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{m.total > 0 ? (m.rechazos / m.total * 100).toFixed(1) : 0}%</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                              {m.clasificaciones?.[0] ? <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>{m.clasificaciones[0].nombre}</span> : <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>S/C</span>}
                              <button className="mx-action-btn print" style={{ width: '28px', height: '28px' }} title="Informe PDF" onClick={(e) => { e.stopPropagation(); generarInformePDF(m); }}><Printer size={12} /></button>
                              <button className="mx-action-btn edit" style={{ width: '28px', height: '28px' }} title="Editar" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}><Edit size={12} /></button>
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
        </div>
      )}

      {/* MODAL PRINCIPAL (3 FASES RESTAURADAS) */}
      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '800px', width: '95%' }}>
            <div className="mx-modal-head">
              <div>
                <h3 className="mx-modal-title">{editingId ? 'Editar' : 'Nuevo'} Muestreo Técnico</h3>
                <p className="mx-modal-sub">{step === 1 ? 'Datos de origen y contexto' : step === 2 ? 'Análisis de categorías y mermas' : 'Resultados y clasificación'}</p>
              </div>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="mx-modal-body">
              {renderStepIndicator()}

              {/* FASE 1: CONTEXTO */}
              {step === 1 && (
                <div className="mu-step-container" style={{ animation: 'slideInRight 0.3s ease-out' }}>
                  <div className="mx-field-row">
                    <div className="mx-field" style={{ flex: 2 }}>
                      <label className="mx-label"><User size={14} /> Proveedor</label>
                      <input className="mx-input" placeholder="Nombre del proveedor..." value={form.proveedorNombre} onChange={e => setForm({...form, proveedorNombre: e.target.value})} />
                    </div>
                    <div className="mx-field" style={{ flex: 1 }}>
                      <label className="mx-label"><Calendar size={14} /> Fecha</label>
                      <input type="date" className="mx-input" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                    </div>
                  </div>

                  <div className="mx-field-row am-mt-16">
                    <div className="mx-field" style={{ flex: 1 }}>
                      <label className="mx-label"><MapPin size={14} /> Centro</label>
                      <input className="mx-input" placeholder="Código centro..." value={form.centroCodigo} onChange={e => setForm({...form, centroCodigo: e.target.value})} />
                    </div>
                    <div className="mx-field" style={{ flex: 1 }}>
                      <label className="mx-label"><Layers size={14} /> Línea</label>
                      <input className="mx-input" placeholder="N° Línea..." value={form.linea} onChange={e => setForm({...form, linea: e.target.value})} />
                    </div>
                    <div className="mx-field" style={{ flex: 1 }}>
                      <label className="mx-label"><Settings2 size={14} /> Responsable</label>
                      <input className="mx-input" placeholder="Nombre..." value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} />
                    </div>
                  </div>

                  <hr className="am-my-24" style={{ opacity: 0.1 }} />
                  {renderOrigenSelector()}

                  <div className="mu-kpi-inputs am-mt-24">
                    <div className="mu-input-card">
                      <label>Calibre (U x Kg)</label>
                      <input type="number" value={form.uxkg} onChange={e => setForm({...form, uxkg: e.target.value})} placeholder="0" />
                    </div>
                    <div className="mu-input-card">
                      <label>Peso Vivo (kg)</label>
                      <input type="number" value={form.pesoVivo} onChange={e => setForm({...form, pesoVivo: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="mu-input-card">
                      <label>Peso Carne (kg)</label>
                      <input type="number" value={form.pesoCocida} onChange={e => setForm({...form, pesoCocida: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="mu-input-card highlight">
                      <label>Rendimiento %</label>
                      <div className="val">{fmtNum(totals.rend, 1)}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* FASE 2: ANÁLISIS DE CATEGORÍAS */}
              {step === 2 && (
                <div className="mu-step-container" style={{ animation: 'slideInRight 0.3s ease-out' }}>
                  <div className="mu-cat-selector-bar">
                    {['procesable', 'defecto', 'rechazo'].map(type => (
                      <div key={type} className="mu-cat-group-wrap">
                        <button 
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
                          <th style={{ textAlign: 'right' }}>Peso (kg)</th>
                          <th style={{ textAlign: 'right' }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selectedCats].map(id => {
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
                                    <button className="mu-remove" onClick={() => toggleCatSelection(id)}>×</button>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <input 
                                  type="number" 
                                  className="mu-cat-input" 
                                  value={form.cats[id] || ''} 
                                  onChange={e => setForm({...form, cats: {...form.cats, [id]: e.target.value}})}
                                  placeholder="0.00"
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
                      <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.procesable / totals.totalMuestra) * 100 : 0, 1)}%</div>
                    </div>
                    <div className="mu-total-card rechazo">
                      <label>Rechazos %</label>
                      <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.rechazos / totals.totalMuestra) * 100 : 0, 1)}%</div>
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
                      <div className="val">{fmtNum(totals.rend, 2)}%</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Calibre (UxKg)</label>
                      <div className="val">{form.uxkg || 0}</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Muestra Total</label>
                      <div className="val">{fmtNum(totals.totalMuestra, 2)} kg</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Procesable</label>
                      <div className="val success">{fmtNum(totals.totalMuestra > 0 ? (totals.procesable/totals.totalMuestra*100) : 0, 1)}%</div>
                    </div>
                  </div>

                  <div className="mu-confirm-msg am-mt-32">
                    <AlertTriangle size={16} />
                    <span>Este muestreo será registrado por <strong>{form.responsable || 'Usuario Sistema'}</strong> para el proveedor <strong>{form.proveedorNombre}</strong>.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mx-modal-foot" style={{ justifyContent: 'space-between' }}>
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
        .mu-steps-header { display: flex; align-items: center; justify-content: space-between; position: relative; }
        .mu-step-item { display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1; cursor: pointer; flex: 1; }
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

        .mu-totals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .mu-total-card { background: #f1f5f9; padding: 16px; border-radius: 16px; text-align: center; }
        .mu-total-card label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .mu-total-card .val { font-size: 20px; font-weight: 900; margin-top: 4px; }
        .mu-total-card.procesable { background: #dcfce7; color: #16a34a; }
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
