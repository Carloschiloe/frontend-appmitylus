import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import './biomasa.css';
import { 
  Plus, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  Inbox, 
  ShoppingCart, 
  Edit, 
  X, 
  Activity, 
  Truck, 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  MessageSquare,
  List as ListIcon,
  Pause,
  Play,
  CheckCircle2,
  Trash,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';
import { useBiomasaData } from '../../hooks/useBiomasaData';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import Muestreos from '../gestion/submodules/Muestreos';

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const finMes = (mk) => {
  const [y, m] = String(mk || '').split('-').map(Number);
  if (!y || !m) return '';
  const day = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const mesLabel = (mk = '', largo = false) => {
  if (!mk) return '—';
  const LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = mk.split('-');
  const idx = parseInt(m, 10) - 1;
  return largo ? `${LARGO[idx]} ${y}` : `${LARGO[idx].slice(0,3)} ${y}`;
};

const fmtTons = (n) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' t';

const PRODUCT_TYPE_LABELS = {
  entero: 'Entero',
  carne: 'Carne',
  mc: 'MC',
  sin_definir: 'Sin definir',
};

const getTipoProductoLabel = (value) => (
  PRODUCT_TYPE_LABELS[String(value || '').toLowerCase()] || PRODUCT_TYPE_LABELS.sin_definir
);

const asText = (value, fallback = '') => {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean).join(', ') || fallback;
  }
  if (typeof value === 'object') {
    if ('label' in value) return asText(value.label, fallback);
    if ('nombre' in value) return asText(value.nombre, fallback);
    if ('name' in value) return asText(value.name, fallback);
    if ('value' in value) return asText(value.value, fallback);
    return fallback;
  }
  return fallback;
};

export default function Biomasa() {
  const { addToast } = useToast();
  const location = useLocation();
  const isStatusView = location.pathname.includes('/status');
  const isProgramView = location.pathname.includes('/programa');
  const isMuestreosView = location.pathname.includes('/muestreos');

  const [statusSubTab, setStatusSubTab] = useState('disponibilidad');
  const [progSubTab, setProgSubTab] = useState('programa');
  
  const [mes, setMes] = useState(mesActual);
  const { disp, asig, programas, calData, tratosAcordados, tratosBiomasa, perdidasBiomasa, reload: load } = useBiomasaData(mes, {
    isStatusView,
    isProgramView,
    isMuestreosView,
    statusSubTab,
    progSubTab
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    tratoId: '',
    vigenciaDesde: '',
    vigenciaHasta: '',
    camionesDefault: 1,
    tonsEstimadas: '',
    tipoProducto: 'sin_definir',
    tipoCamion: '',
    maxisPorCamion: '',
    condicionContinuidad: '',
    notas: '',
    diasSemana: [1,2,3,4,5],
    diasEspeciales: []
  });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSegModal, setShowSegModal] = useState(false);
  const [segProg, setSegProg] = useState(null);
  const [segNota, setSegNota] = useState('');
  const [segEstado, setSegEstado] = useState('');
  
  // Estados para Calendario Avanzado
  const [calView, setCalView] = useState('month'); // 'month' | 'week'
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Lógica Matemática de Mes
  const monthData = useMemo(() => {
    if (!mes) return { days: [], padding: 0 };
    const [y, m] = mes.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1; // 0-indexed
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // último día
    
    // Ajustar Lunes = 0, Domingo = 6
    const dayOfWeek = firstDay.getDay();
    const padding = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 

    return {
      days: Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
      padding
    };
  }, [mes]);

  // Lógica de Semanas
  const weekDays = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1 + (currentWeekOffset * 7)); // Lunes
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [currentWeekOffset]);

  const weekData = useMemo(() => {
    const data = {};
    programas.filter(p => p.estado === 'activo').forEach(p => {
      data[p._id] = { 
        nombre: p.proveedorNombre, 
        centro: p.centroNombre,
        tipoProducto: p.tipoProducto || p.tipoProductoSugerido || 'sin_definir',
        dias: weekDays.map((d) => {
          const item = calData[d]?.items?.find(x => x.programaId === p._id);
          return {
            camiones: item?.camiones || 0,
            tipoProducto: item?.tipoProducto || p.tipoProducto || p.tipoProductoSugerido || 'sin_definir',
          };
        })
      };
    });
    return data;
  }, [programas, calData, weekDays]);

  useEffect(() => {
    if (selectedDay && !String(selectedDay.key || '').startsWith(mes)) {
      setSelectedDay(null);
    }
  }, [mes, selectedDay]);

  // Handlers CRUD
  const handleOpenModal = useCallback((item = null) => {
    if (item) {
      setEditingId(item._id);
      setFormData({
        tratoId: item.tratoId || '',
        vigenciaDesde: item.vigenciaDesde ? item.vigenciaDesde.split('T')[0] : '',
        vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.split('T')[0] : '',
        camionesDefault: item.camionesDefault || 1,
        tonsEstimadas: item.tonsEstimadas || '',
        tipoProducto: item.tipoProducto || item.tipoProductoSugerido || 'sin_definir',
        tipoCamion: item.tipoCamion || '',
        maxisPorCamion: item.maxisPorCamion || '',
        condicionContinuidad: item.condicionContinuidad || '',
        notas: item.notas || '',
        diasSemana: item.diasSemana || [1,2,3,4,5],
        diasEspeciales: item.diasEspeciales || []
      });
    } else {
      setEditingId(null);
      setFormData({
        tratoId: tratosAcordados.length > 0 ? tratosAcordados[0]._id : '',
        vigenciaDesde: `${mes}-01`,
        vigenciaHasta: finMes(mes),
        camionesDefault: 1,
        tonsEstimadas: '',
        tipoProducto: tratosAcordados[0]?.tipoProducto || tratosAcordados[0]?.tipoProductoSugerido || 'sin_definir',
        tipoCamion: 'Normal',
        maxisPorCamion: 12,
        condicionContinuidad: 'Sin Condición',
        notas: '',
        diasSemana: [1,2,3,4,5],
        diasEspeciales: []
      });
    }
    setShowModal(true);
  }, [tratosAcordados, mes]);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    const selectedTrato = tratosAcordados.find(t => t._id === formData.tratoId);
    const payload = {
      ...formData,
      proveedorNombre: selectedTrato?.proveedorNombre || programas.find(p => p._id === editingId)?.proveedorNombre,
      centroNombre: selectedTrato?.centroNombre || selectedTrato?.centroCodigo || programas.find(p => p._id === editingId)?.centroNombre || ''
    };

    try {
      const endpoint = editingId ? `/programa-cosecha/${editingId}` : '/programa-cosecha';
      const method = editingId ? 'put' : 'post';
      await apiClient[method](endpoint, payload);
      
      addToast({ title: editingId ? 'Programa Actualizado' : 'Programa Creado', message: editingId ? 'Los cambios fueron guardados.' : 'El programa de cosecha fue creado.', type: 'success' });
      setShowModal(false);
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [formData, tratosAcordados, programas, editingId, addToast, load]);

  const handleStatusChange = useCallback(async (id, nuevoEstado) => {
    try {
      await apiClient.patch(`/programa-cosecha/${id}/estado`, { estado: nuevoEstado });
      addToast({ title: nuevoEstado === 'activo' ? 'Programa Reanudado' : 'Programa Pausado', message: `El estado fue cambiado a ${nuevoEstado}.`, type: 'success' });
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const nombre = confirmDelete.proveedorNombre;
    try {
      await apiClient.delete(`/programa-cosecha/${confirmDelete._id}`);
      addToast({ title: 'Programa Eliminado', message: `El programa de ${nombre} fue eliminado.`, type: 'success' });
      setConfirmDelete(null);
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [confirmDelete, addToast, load]);

  const handleSegSave = useCallback(async (e) => {
    e.preventDefault();
    if (!segNota.trim() || !segEstado) return;
    try {
      await apiClient.post(`/programa-cosecha/${segProg._id}/seguimiento`, { estado: segEstado, nota: segNota });
      addToast({ title: 'Éxito', message: 'Novedad registrada con éxito', type: 'success' });
      setShowSegModal(false);
      setSegNota('');
      setSegEstado('');
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' }); 
    }
  }, [segNota, segEstado, segProg, addToast, load]);

  const kpis = useMemo(() => {
    const disponible = disp.reduce((s, i) => s + (i.tons || 0), 0);
    const totalAsignado = asig.reduce((s, i) => s + Number(i.tons || 0), 0);
    const pct = disponible > 0 ? (totalAsignado / disponible) * 100 : 0;
    return { disponible, totalAsignado, saldo: disponible - totalAsignado, pct };
  }, [disp, asig]);

  const getSituacionBiomasaLabel = (item) => {
    const raw = asText(item?.situacionBiomasa || item?.estado, '').toLowerCase();
    if (raw === 'en_conversacion' || raw === 'negociando') return 'En conversación';
    if (raw === 'reservada' || raw === 'semi_acordado' || raw === 'semi_cerrado') return 'Reservada';
    if (raw === 'acordada' || raw === 'acordado' || raw === 'cerrado' || raw === 'compra_efectuada') return 'Acordada';
    return asText(item?.situacionBiomasa || item?.estado, 'Sin definir');
  };

  const getProgramaLabel = (item) => {
    const raw = asText(item?.programaEstado, '').toLowerCase();
    if (raw === 'activo') return 'Programada';
    if (raw === 'pausado') return 'Programada pausada';
    if (raw === 'finalizado') return 'Ejecutada';
    return 'Sin programa';
  };

  const biomasaPendiente = useMemo(
    () => tratosBiomasa.filter((item) => !asText(item?.programaEstado, '').trim()),
    [tratosBiomasa]
  );

  const biomasaVinculada = useMemo(
    () => tratosBiomasa.filter((item) => asText(item?.programaEstado, '').trim()),
    [tratosBiomasa]
  );

  const negociacionKpis = useMemo(() => {
    const sumTons = (items) => items.reduce((acc, item) => acc + (Number(item?.tonsAcordadas || item?.tons || item?.biomasaEstimacion || 0)), 0);
    const enConversacion = biomasaPendiente.filter((item) => getSituacionBiomasaLabel(item) === 'En conversación');
    const acordadas = tratosBiomasa.filter((item) => getSituacionBiomasaLabel(item) === 'Acordada');
    return {
      enConversacionTons: sumTons(enConversacion),
      acordadasTons: sumTons(acordadas),
      perdidasTons: sumTons(perdidasBiomasa),
    };
  }, [biomasaPendiente, perdidasBiomasa, tratosBiomasa]);

  if (!isStatusView && !isProgramView && !isMuestreosView) return <Navigate to="/biomasa/status" replace />;

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Biomasa · {isStatusView ? 'Disponibilidad y negociación' : isProgramView ? 'Programa de cosecha' : 'Muestreos Técnicos'}</p>
          <h1 className="biomasa-title">{isStatusView ? 'Disponibilidad de biomasa' : isProgramView ? 'Programa de Cosecha' : 'Muestreos Técnicos'}</h1>
        </div>
        <div className="mx-hero-actions">
          {!isMuestreosView && (
            <div className="mx-search-box" style={{ minWidth: 'auto' }}>
              <CalendarIcon size={18} />
              <input 
                type="month" 
                value={mes} 
                onChange={(e) => setMes(e.target.value)} 
                style={{ paddingLeft: '42px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }} 
              />
            </div>
          )}
          <button className="mx-btn-icon" onClick={load} style={{ color: 'white', background: 'rgba(255,255,255,0.1)' }}>
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      <div className="mx-content-frame">
        <div className="mx-toolbar">
          <div className="mx-toggle-group">
            {isStatusView ? (
              <>
                <button className={`mx-toggle-btn ${statusSubTab === 'disponibilidad' ? 'active' : ''}`} onClick={() => setStatusSubTab('disponibilidad')}><Inbox size={14} /> Disponibilidad</button>
                <button className={`mx-toggle-btn ${statusSubTab === 'negociacion' ? 'active' : ''}`} onClick={() => setStatusSubTab('negociacion')}><ShoppingCart size={14} /> Negociación</button>
              </>
            ) : isProgramView ? (
              <>
                <button className={`mx-toggle-btn ${progSubTab === 'programa' ? 'active' : ''}`} onClick={() => setProgSubTab('programa')}><ListIcon size={14} /> Programa</button>
                <button className={`mx-toggle-btn ${progSubTab === 'calendario' ? 'active' : ''}`} onClick={() => setProgSubTab('calendario')}><LayoutGrid size={14} /> Calendario cosechas</button>
                <button className={`mx-toggle-btn ${progSubTab === 'seguimiento' ? 'active' : ''}`} onClick={() => setProgSubTab('seguimiento')}><Activity size={14} /> Seguimiento</button>
              </>
            ) : null}
          </div>
          {(isProgramView && progSubTab === 'programa') && (
            <button className="mx-btn mx-btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> Crear Programa
            </button>
          )}
        </div>

        <div className="tab-content-area">
          {isStatusView && (
            <div className="status-view">
              {statusSubTab === 'disponibilidad' ? (
                <div className="mx-kpi-grid">
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Disponible</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-info)' }}>{fmtTons(kpis.disponible)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Asignado</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-success)' }}>{fmtTons(kpis.totalAsignado)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Saldo Mensual</div>
                    <div className="mx-kpi-value" style={{ color: kpis.saldo >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtTons(kpis.saldo)}</div>
                    <div className="mx-progress am-mt-12">
                      <div className="mx-progress-fill" style={{ width: `${Math.min(kpis.pct, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-kpi-grid">
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">En conversación</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-info)' }}>{fmtTons(negociacionKpis.enConversacionTons)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Acordadas</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-success)' }}>{fmtTons(negociacionKpis.acordadasTons)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Pérdidas del mes</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-error)' }}>{fmtTons(negociacionKpis.perdidasTons)}</div>
                  </div>
                </div>
              )}
              <div className="mx-table-card">
                <table className="mx-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>{statusSubTab === 'disponibilidad' ? 'Mes' : 'Situación biomasa'}</th>
                      <th style={{ textAlign: 'center' }}>Tons</th>
                      {statusSubTab === 'disponibilidad' ? <th>Centro</th> : <th>Programa</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(statusSubTab === 'disponibilidad' ? disp : [...biomasaPendiente, ...biomasaVinculada]).map(item => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: 'var(--weight-bold)' }}>{item.proveedorNombre}</td>
                        <td>{statusSubTab === 'disponibilidad' ? mesLabel(item.mesKey) : getSituacionBiomasaLabel(item)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>{fmtTons(statusSubTab === 'disponibilidad' ? item.tons : (item.tonsAcordadas || item.tons || item.biomasaEstimacion || 0))}</td>
                        {statusSubTab === 'disponibilidad' ? <td>{item.centroCodigo || '—'}</td> : <td>{getProgramaLabel(item)}</td>}
                      </tr>
                    ))}
                    {statusSubTab !== 'disponibilidad' && perdidasBiomasa.map((item) => (
                      <tr key={`perdida-${item._id}`}>
                        <td style={{ fontWeight: 'var(--weight-bold)' }}>{item.proveedorNombre}</td>
                        <td>{item.motivoCierre || 'Pérdida'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)', color: 'var(--color-error)' }}>
                          {fmtTons(item.tonsAcordadas || item.tons || item.biomasaEstimacion || 0)}
                        </td>
                        <td>Pérdida real</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isProgramView && (
            <div className="program-view">
              {progSubTab === 'programa' && (
                <div className="mx-table-card">
                  <div className="mx-table-wrap">
                    <table className="mx-table">
                      <thead>
                        <tr>
                          <th>Proveedor / Centro</th>
                          <th>Vigencia</th>
                          <th>Producto</th>
                          <th style={{ textAlign: 'center' }}>Cam/Día</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programas.map(p => (
                          <tr key={p._id}>
                            <td>
                              <div className="biomasa-prov-cell">
                                <div className="biomasa-avatar">
                                  {p.proveedorNombre ? p.proveedorNombre.substring(0, 2).toUpperCase() : 'NA'}
                                </div>
                                <div>
                                  <div className="biomasa-prov-name">{p.proveedorNombre || 'Proveedor Desconocido'}</div>
                                  <div className="biomasa-centro-name">{p.centroNombre || 'Sin Centro Definido'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="biomasa-date-range">
                                <CalendarIcon size={14} />
                                {p.vigenciaDesde ? new Date(p.vigenciaDesde).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'} - {p.vigenciaHasta ? new Date(p.vigenciaHasta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                              </div>
                            </td>
                            <td>
                              <span className="mx-badge mx-badge-muted">
                                {getTipoProductoLabel(p.tipoProducto)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="biomasa-camiones-badge">
                                {p.camionesDefault}
                              </div>
                            </td>
                            <td>
                              <span className={`mx-badge mx-badge-${p.estado === 'activo' ? 'success' : p.estado === 'pausado' ? 'warning' : 'muted'}`}>
                                {(p.estado || 'desconocido').toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="biomasa-action-bar">
                                {p.estado === 'activo' ? (
                                  <button className="mx-btn-icon sm pause" onClick={() => handleStatusChange(p._id, 'pausado')}><Pause size={14} /></button>
                                ) : p.estado === 'pausado' ? (
                                  <button className="mx-btn-icon sm play" onClick={() => handleStatusChange(p._id, 'activo')}><Play size={14} /></button>
                                ) : null}
                                <button className="mx-btn-icon sm edit" onClick={() => handleOpenModal(p)}><Edit size={14} /></button>
                                <button className="mx-btn-icon sm delete" onClick={() => setConfirmDelete(p)}><Trash size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {progSubTab === 'calendario' && (
                <div style={{ display: 'grid', gridTemplateColumns: calView === 'month' ? '1fr 340px' : '1fr', gap: '24px' }}>
                  <div className="mx-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="mx-toggle-group">
                          <button className={`mx-toggle-btn ${calView === 'month' ? 'active' : ''}`} onClick={() => setCalView('month')}>Vista Mes</button>
                          <button className={`mx-toggle-btn ${calView === 'week' ? 'active' : ''}`} onClick={() => setCalView('week')}>Vista Semana</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button className="mx-btn-icon sm" onClick={() => {
                            if (calView === 'month') {
                              setMes(prev => {
                                const [y, m] = prev.split('-');
                                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              });
                            } else {
                              setCurrentWeekOffset(o => o-1);
                            }
                          }}><ChevronLeft size={16} /></button>
                          <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '15px', color: 'var(--color-text)', minWidth: '150px', textAlign: 'center', textTransform: 'uppercase' }}>
                            {calView === 'month' ? mesLabel(mes, true) : `Semana ${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`}
                          </span>
                          <button className="mx-btn-icon sm" onClick={() => {
                            if (calView === 'month') {
                              setMes(prev => {
                                const [y, m] = prev.split('-');
                                const d = new Date(parseInt(y, 10), parseInt(m, 10), 1);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              });
                            } else {
                              setCurrentWeekOffset(o => o+1);
                            }
                          }}><ChevronRight size={16} /></button>
                        </div>
                      </div>
                      {calView === 'week' && <button className="mx-btn mx-btn-outline sm" onClick={() => setCurrentWeekOffset(0)}>Volver a Hoy</button>}
                    </div>

                    {calView === 'month' ? (
                      <div className="cal-month-grid">
                        {['LUN','MAR','MIE','JUE','VIE','SAB','DOM'].map(d => (
                          <div key={d} className="cal-header-day">{d}</div>
                        ))}
                        {Array.from({ length: monthData.padding }).map((_, i) => (
                          <div key={`pad-${i}`} className="cal-pad-day" />
                        ))}
                        {monthData.days.map((dayNum) => {
                          const dateKey = `${mes}-${String(dayNum).padStart(2, '0')}`;
                          const dayDataObj = calData[dateKey] || { total: 0, items: [] };
                          const dayItems = dayDataObj.items || [];
                          const total = dayDataObj.total || 0;
                          const isSelected = selectedDay?.key === dateKey;

                          return (
                            <div 
                              key={dayNum} 
                              onClick={() => setSelectedDay({ key: dateKey, items: dayItems, total })}
                              className={`cal-day-cell ${isSelected ? 'selected' : ''}`}
                            >
                              <span className="cal-day-num">{dayNum}</span>
                              {total > 0 && (
                                <div className="cal-day-badge">
                                  {total}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mx-table-wrap">
                        <table className="mx-table">
                          <thead>
                            <tr>
                              <th>PROVEEDOR / CENTRO</th>
                              {weekDays.map(d => (
                                <th key={d} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 'var(--weight-bold)' }}>{new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()}</div>
                                  <div style={{ fontSize: '15px', color: 'var(--color-text)', fontWeight: 'var(--weight-bold)' }}>{d.split('-')[2]}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(weekData).map(([id, data]) => (
                              <tr key={id}>
                                <td>
                                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '14px' }}>{data.nombre}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{data.centro}</div>
                                </td>
                                {data.dias.map((cell, i) => (
                                  <td key={i} style={{ textAlign: 'center' }}>
                                    {cell.camiones > 0 ? (
                                      <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', fontWeight: 'var(--weight-bold)', padding: '8px', borderRadius: '12px', border: '1px solid var(--color-success)', fontSize: '14px' }}>
                                        <div>{cell.camiones}</div>
                                        <div style={{ fontSize: '10px', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                          {getTipoProductoLabel(cell.tipoProducto)}
                                        </div>
                                      </div>
                                    ) : <span style={{ color: 'var(--color-border)' }}>—</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {calView === 'month' && (
                    <aside className="mx-card">
                      <header className="mx-card-header">
                        <h4 className="mx-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Truck size={18} /> DETALLE DEL DÍA
                        </h4>
                      </header>
                      {selectedDay ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ padding: '8px 12px', background: 'var(--color-bg)', borderRadius: '8px', fontSize: '12px', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '8px' }}>
                            {new Date(selectedDay.key + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                          </div>
                          {selectedDay.items.map((it, idx) => (
                            <div key={idx} className="mx-card" style={{ padding: '16px', boxShadow: 'none', border: '1px solid var(--color-border)' }}>
                              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '13px', marginBottom: '4px' }}>{it.proveedorNombre}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{it.centroNombre || it.centroCodigo || 'Sin centro definido'}</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontSize: '20px', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>{it.camiones}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>CAM</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                <span>{getTipoProductoLabel(it.tipoProducto)}</span>
                                {it.tonsEstimadas ? <span>{fmtTons(it.tonsEstimadas)}</span> : null}
                                {it.tipoCamion ? <span>{it.tipoCamion}</span> : null}
                                {it.maxisPorCamion ? <span>{it.maxisPorCamion} maxis/camion</span> : null}
                                {it.motivo ? <span>{it.motivo}</span> : null}
                              </div>
                            </div>
                          ))}
                          {selectedDay.total === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                              <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                              <p>Sin despachos programados.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                          <CalendarIcon size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                          <p>Selecciona un día para ver el desglose operativo.</p>
                        </div>
                      )}
                    </aside>
                  )}
                </div>
              )}

              {progSubTab === 'seguimiento' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                  {programas.filter(p => p.estado === 'activo').map(p => (
                    <div key={p._id} className="mx-card">
                      <header className="mx-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div className="biomasa-avatar">
                            {p.proveedorNombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="mx-card-title">{p.proveedorNombre}</h4>
                            <p className="mx-card-description">{p.centroNombre || 'Sin Centro'}</p>
                          </div>
                        </div>
                        <span className="mx-badge mx-badge-success">ACTIVO</span>
                      </header>

                      <div className="mx-progress-section am-mb-20">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'var(--weight-bold)', marginBottom: '8px' }}>
                          <span>Avance de Vigencia</span>
                          <span style={{ color: 'var(--color-primary)' }}>65%</span>
                        </div>
                        <div className="mx-progress">
                          <div className="mx-progress-fill" style={{ width: '65%' }}></div>
                        </div>
                      </div>

                      <div className="mx-card" style={{ padding: '16px', background: 'var(--color-bg)', border: 'none', boxShadow: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <MessageSquare size={14} style={{ color: 'var(--color-primary)' }} />
                          <span style={{ fontSize: '11px', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Última Novedad</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6 }}>
                          {p.seguimientos?.[0]?.nota || 'Sin novedades registradas recientemente.'}
                        </div>
                        <button 
                          className="mx-btn-icon sm" 
                          title="Registrar novedad"
                          style={{ position: 'absolute', top: '12px', right: '12px' }}
                          onClick={() => { setSegProg(p); setShowSegModal(true); }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isMuestreosView && <Muestreos />}
        </div>
      </div>

      {/* MODAL SEGUIMIENTO / NOVEDAD (Stage 3 Refactor) */}
      {showSegModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-header">
              <h2>Registrar Novedad</h2>
              <button className="mx-btn-icon" onClick={() => setShowSegModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSegSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Estado de Cosecha</label>
                  <select 
                    className="mx-select" 
                    value={segEstado} 
                    onChange={e => setSegEstado(e.target.value)} 
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="en_plan">En plan</option>
                    <option value="con_retrasos">Con retrasos</option>
                    <option value="detenido">Detenido</option>
                  </select>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Nota / Observación de Cosecha</label>
                  <textarea 
                    className="mx-textarea" 
                    value={segNota} 
                    onChange={e => setSegNota(e.target.value)} 
                    placeholder="Describe lo ocurrido (ej: retraso por clima, cambio de logística...)"
                    required
                  />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowSegModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> Registrar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROGRAMA (Stage 3 Refactor) */}
      {showModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '600px' }}>
            <div className="mx-modal-header">
              <h2>{editingId ? 'Editar Programa' : 'Nuevo Programa de Cosecha'}</h2>
              <button className="mx-btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Proveedor / Trato Acordado</label>
                    <select 
                      className="mx-select" 
                      value={formData.tratoId} 
                      onChange={(e) => {
                        const t = tratosAcordados.find(x => x._id === e.target.value);
                        setFormData({
                          ...formData,
                          tratoId: e.target.value,
                          vigenciaDesde: t?.vigenciaDesde?.split('T')[0] || formData.vigenciaDesde,
                          vigenciaHasta: t?.vigenciaHasta?.split('T')[0] || formData.vigenciaHasta,
                          camionesDefault: t?.camionesXDia || formData.camionesDefault,
                          tonsEstimadas: t?.tonsAcordadas || formData.tonsEstimadas,
                          tipoProducto: t?.tipoProducto || t?.tipoProductoSugerido || formData.tipoProducto || 'sin_definir'
                        });
                      }}
                      required
                    >
                      <option value="">— Seleccionar trato acordado —</option>
                      {tratosAcordados.map(t => (
                        <option key={t._id} value={t._id}>{t.proveedorNombre} — {t.tonsAcordadas}T ({t.centroCodigo || t.centroNombre || 'Sin centro'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Desde</label>
                    <input type="date" className="mx-input" value={formData.vigenciaDesde} onChange={e => setFormData({...formData, vigenciaDesde: e.target.value})} required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Hasta</label>
                    <input type="date" className="mx-input" value={formData.vigenciaHasta} onChange={e => setFormData({...formData, vigenciaHasta: e.target.value})} required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Camiones / día</label>
                    <input type="number" className="mx-input" value={formData.camionesDefault} onChange={e => setFormData({...formData, camionesDefault: e.target.value})} min="0" required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Tons estimadas</label>
                    <input type="number" className="mx-input" value={formData.tonsEstimadas} onChange={e => setFormData({...formData, tonsEstimadas: e.target.value})} />
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Tipo de producto</label>
                    <select
                      className="mx-select"
                      value={formData.tipoProducto}
                      onChange={e => setFormData({...formData, tipoProducto: e.target.value})}
                    >
                      <option value="sin_definir">Sin definir</option>
                      <option value="entero">Entero</option>
                      <option value="carne">Carne</option>
                      <option value="mc">MC</option>
                    </select>
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Días de Cosecha</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: formData.diasSemana.includes(i) ? 'var(--color-primary-light, #f0fdfa)' : 'white', borderColor: formData.diasSemana.includes(i) ? 'var(--color-primary)' : 'var(--color-border)' }}>
                          <input 
                            type="checkbox" 
                            style={{ display: 'none' }}
                            checked={formData.diasSemana.includes(i)}
                            onChange={() => {
                              const next = formData.diasSemana.includes(i) 
                                ? formData.diasSemana.filter(x => x !== i)
                                : [...formData.diasSemana, i];
                              setFormData({...formData, diasSemana: next});
                            }}
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Notas / Observaciones</label>
                    <textarea className="mx-textarea" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} rows="2" />
                  </div>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar programa?"
        description={confirmDelete ? `Estás a punto de borrar el programa de cosecha de "${confirmDelete.proveedorNombre}". Esta acción es irreversible.` : ''}
      />
    </div>
  );
}
