import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import './biomasa.css';
import { 
  Plus, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  Search, 
  Inbox, 
  ShoppingCart, 
  Edit, 
  Trash2, 
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
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';
import { useBiomasaData } from '../../hooks/useBiomasaData';

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const mesLabel = (mk = '', largo = false) => {
  if (!mk) return '—';
  const LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = mk.split('-');
  const idx = parseInt(m, 10) - 1;
  return largo ? `${LARGO[idx]} ${y}` : `${LARGO[idx].slice(0,3)} ${y}`;
};

const fmtTons = (n) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' t';

export default function Biomasa() {
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isStatusView = location.pathname.includes('/status');
  const isProgramView = location.pathname.includes('/programa');

  const [statusSubTab, setStatusSubTab] = useState('disponibilidad');
  const [progSubTab, setProgSubTab] = useState('programa');
  
  const [mes, setMes] = useState(mesActual);
  const { loading, disp, asig, programas, calData, tratosAcordados, reload: load } = useBiomasaData(mes);
  const [calDate, setCalDate] = useState(new Date());

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    tratoId: '',
    vigenciaDesde: '',
    vigenciaHasta: '',
    camionesDefault: 1,
    tonsEstimadas: '',
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
        dias: weekDays.map(d => calData[d]?.items?.find(x => x.programaId === p._id)?.camiones || 0)
      };
    });
    return data;
  }, [programas, calData, weekDays]);

  // Handlers CRUD
  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item._id);
      setFormData({
        tratoId: item.tratoId || '',
        vigenciaDesde: item.vigenciaDesde ? item.vigenciaDesde.split('T')[0] : '',
        vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.split('T')[0] : '',
        camionesDefault: item.camionesDefault || 1,
        tonsEstimadas: item.tonsEstimadas || '',
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
        vigenciaHasta: `${mes}-31`,
        camionesDefault: 1,
        tonsEstimadas: '',
        tipoCamion: 'Normal',
        maxisPorCamion: 12,
        condicionContinuidad: 'Sin Condición',
        notas: '',
        diasSemana: [1,2,3,4,5],
        diasEspeciales: []
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
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
  };

  const handleStatusChange = async (id, nuevoEstado) => {
    try {
      await apiClient.patch(`/programa-cosecha/${id}/estado`, { estado: nuevoEstado });
      addToast({ title: nuevoEstado === 'activo' ? 'Programa Reanudado' : 'Programa Pausado', message: `El estado fue cambiado a ${nuevoEstado}.`, type: 'success' });
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  };

  const handleDelete = async () => {
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
  };

  const handleSaveSeguimiento = async (e) => {
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
  };

  const kpis = useMemo(() => {
    const disponible = disp.reduce((s, i) => s + (i.tons || 0), 0);
    const totalAsignado = asig.reduce((s, i) => s + Number(i.tons || 0), 0);
    const pct = disponible > 0 ? (totalAsignado / disponible) * 100 : 0;
    return { disponible, totalAsignado, saldo: disponible - totalAsignado, pct };
  }, [disp, asig]);

  if (!isStatusView && !isProgramView) return <Navigate to="/biomasa/status" replace />;

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Biomasa · {isStatusView ? 'Status Comercial' : 'Programa de Cosecha'}</p>
          <h1 className="biomasa-title">{isStatusView ? 'Status de Toneladas' : 'Programa de Cosecha'}</h1>
        </div>
        <div className="mx-hero-actions">
          <div className="mx-input-group biomasa-date-picker" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0 12px' }}>
            <CalendarIcon size={18} color="rgba(255,255,255,0.8)" />
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', padding: '8px', outline: 'none' }} />
          </div>
          <button className="mx-btn-icon" onClick={load} style={{ color: 'white', background: 'rgba(255,255,255,0.1)' }}><RotateCcw size={20} /></button>
        </div>
      </header>

      <div className="mx-content-frame">

        <div className="sub-tabs-row biomasa-sub-tabs">
        <div className="mx-toggle-group">
          {isStatusView ? (
            <>
              <button className={`mx-toggle-btn ${statusSubTab === 'disponibilidad' ? 'active' : ''}`} onClick={() => setStatusSubTab('disponibilidad')}><Inbox size={14} /> Disponibilidad</button>
              <button className={`mx-toggle-btn ${statusSubTab === 'compras' ? 'active' : ''}`} onClick={() => setStatusSubTab('compras')}><ShoppingCart size={14} /> Compras</button>
            </>
          ) : (
            <>
              <button className={`mx-toggle-btn ${progSubTab === 'programa' ? 'active' : ''}`} onClick={() => setProgSubTab('programa')}><ListIcon size={14} /> Programa</button>
              <button className={`mx-toggle-btn ${progSubTab === 'calendario' ? 'active' : ''}`} onClick={() => setProgSubTab('calendario')}><LayoutGrid size={14} /> Calendario</button>
              <button className={`mx-toggle-btn ${progSubTab === 'seguimiento' ? 'active' : ''}`} onClick={() => setProgSubTab('seguimiento')}><Activity size={14} /> Seguimiento</button>
            </>
          )}
        </div>
        {(isProgramView && progSubTab === 'programa') && (
          <button className="mx-btn mx-btn-primary" style={{ padding: '8px 20px' }} onClick={() => handleOpenModal()}>
            <Plus size={18} /> Crear Programa
          </button>
        )}
      </div>

      <div className="tab-content-area">
        {isStatusView && (
          <div className="status-view">
             <div className="biomasa-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="biomasa-kpi-card">
                <div className="biomasa-kpi-label">Disponible</div>
                <div className="biomasa-kpi-val" style={{ color: '#0ea5e9' }}>{fmtTons(kpis.disponible)}</div>
              </div>
              <div className="biomasa-kpi-card">
                <div className="biomasa-kpi-label">Asignado</div>
                <div className="biomasa-kpi-val" style={{ color: '#10b981' }}>{fmtTons(kpis.totalAsignado)}</div>
              </div>
              <div className="biomasa-kpi-card">
                <div className="biomasa-kpi-label">Saldo Mensual</div>
                <div className="biomasa-kpi-val" style={{ color: kpis.saldo >= 0 ? '#10b981' : '#ef4444' }}>{fmtTons(kpis.saldo)}</div>
                <div className="mx-progress am-mt-12" style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="mx-progress-fill" style={{ width: `${Math.min(kpis.pct, 100)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                </div>
              </div>
            </div>
            <div className="mx-table-card">
              <table className="mx-table">
                <thead><tr><th>Proveedor</th><th>Mes</th><th style={{ textAlign: 'center' }}>Tons</th>{statusSubTab === 'disponibilidad' ? <th>Centro</th> : <th>Estado</th>}</tr></thead>
                <tbody>
                  {(statusSubTab === 'disponibilidad' ? disp : asig).map(item => (
                    <tr key={item._id}>
                      <td style={{ fontWeight: 700 }}>{item.proveedorNombre}</td>
                      <td>{mesLabel(item.mesKey)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{fmtTons(item.tons)}</td>
                      {statusSubTab === 'disponibilidad' ? <td>{item.centroCodigo || '—'}</td> : <td><span className="mx-badge mx-badge-success">Confirmado</span></td>}
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
              <div className="mx-table-card" style={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                <div className="mx-table-wrap">
                  <table className="mx-table">
                    <thead>
                      <tr>
                        <th style={{ padding: '16px 24px' }}>Proveedor / Centro</th>
                        <th>Vigencia</th>
                        <th style={{ textAlign: 'center' }}>Cam/Día</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'right', paddingRight: '24px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programas.map(p => (
                        <tr key={p._id}>
                          <td style={{ padding: '16px 24px' }}>
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
                          <td style={{ textAlign: 'center' }}>
                            <div className="biomasa-camiones-badge">
                              {p.camionesDefault}
                            </div>
                          </td>
                          <td>
                            <span className={`mx-badge mx-badge-${p.estado === 'activo' ? 'success' : p.estado === 'pausado' ? 'warning' : 'muted'}`} style={{ padding: '6px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}>
                              {(p.estado || 'desconocido').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: '24px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: calView === 'month' ? '1fr 340px' : '1fr', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
                <div className="mx-table-card am-p-24" style={{ borderRadius: '24px' }}>
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
                              const d = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1); // -2 porque es 0-indexed y queremos restar 1
                              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            });
                          } else {
                            setCurrentWeekOffset(o => o-1);
                          }
                        }}><ChevronLeft size={16} /></button>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b', minWidth: '150px', textAlign: 'center', textTransform: 'uppercase' }}>
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
                    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ textAlign: 'left', padding: '16px 24px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 800 }}>PROVEEDOR / CENTRO</th>
                            {weekDays.map(d => (
                              <th key={d} style={{ padding: '16px', borderBottom: '2px solid #f1f5f9', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>{new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()}</div>
                                <div style={{ fontSize: '15px', color: '#1e293b', fontWeight: 900 }}>{d.split('-')[2]}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(weekData).map(([id, data]) => (
                            <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '16px 24px' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{data.nombre}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{data.centro}</div>
                              </td>
                              {data.dias.map((c, i) => (
                                <td key={i} style={{ padding: '16px', textAlign: 'center' }}>
                                  {c > 0 ? (
                                    <div style={{ background: '#f0fdf4', color: '#006666', fontWeight: 900, padding: '8px', borderRadius: '12px', border: '1px solid #ccfbf1', fontSize: '14px' }}>
                                      {c}
                                    </div>
                                  ) : <span style={{ color: '#e2e8f0' }}>—</span>}
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
                  <aside className="mx-table-card am-p-24" style={{ borderRadius: '24px', animation: 'fadeInRight 0.3s ease' }}>
                    <h4 style={{ fontWeight: 900, fontSize: '15px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={18} style={{ color: '#006666' }} /> DETALLE DEL DÍA
                    </h4>
                    {selectedDay ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#64748b', textAlign: 'center', marginBottom: '8px' }}>
                          {new Date(selectedDay.key + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                        </div>
                        {selectedDay.items.map((it, idx) => (
                          <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: 'linear-gradient(to bottom, #006666, #00b3b3)' }}></div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>{it.proveedorNombre}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{it.centroNombre}</span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 900, color: '#006666' }}>{it.camiones}</span>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8' }}>CAM</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedDay.total === 0 && (
                          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>Sin despachos programados.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                        <CalendarIcon size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p style={{ fontSize: '14px', fontWeight: 500 }}>Selecciona un día para ver el desglose operativo.</p>
                      </div>
                    )}
                  </aside>
                )}
              </div>
            )}

            {progSubTab === 'seguimiento' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                {programas.filter(p => p.estado === 'activo').map(p => (
                  <div key={p._id} className="mx-table-card am-p-24" style={{ borderRadius: '24px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', transition: 'transform 0.2s', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px', boxShadow: '0 8px 16px rgba(37,99,235,0.2)' }}>
                          {p.proveedorNombre.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '16px' }}>{p.proveedorNombre}</h4>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{p.centroNombre || 'Sin Centro'}</p>
                        </div>
                      </div>
                      <div style={{ background: '#f0fdf4', color: '#10b981', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>ACTIVO</div>
                    </div>

                    <div className="seg-progress am-mb-20">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: '#475569' }}>
                        <span>Avance de Vigencia</span>
                        <span style={{ color: '#2563eb' }}>65%</span>
                      </div>
                      <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, #2563eb 0%, #0ea5e9 100%)', borderRadius: '5px' }}></div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <MessageSquare size={14} style={{ color: '#2563eb' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Última Novedad</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                        {p.seguimientos?.[0]?.nota || 'Sin novedades registradas recientemente.'}
                      </div>
                      <button 
                        className="mx-btn-icon sm" 
                        title="Registrar novedad"
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', color: '#2563eb' }}
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
      </div>

      {/* MODAL REGISTRO SEGUIMIENTO */}
      {showSegModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '450px' }}>
            <div className="mx-modal-head">
              <div>
                <h2 style={{ fontWeight: 900, fontSize: '20px' }}>Registrar Novedad</h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{segProg?.proveedorNombre}</p>
              </div>
              <button className="mx-btn-icon" onClick={() => setShowSegModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSeguimiento}>
              <div className="mx-modal-body" style={{ padding: '24px' }}>
                <div className="mx-field">
                  <label className="mx-label">Estado de Ejecución</label>
                  <select 
                    className="mx-input" 
                    value={segEstado}
                    onChange={e => setSegEstado(e.target.value)}
                    required
                    style={{ background: '#f8fafc', fontWeight: 600 }}
                  >
                    <option value="">— Seleccionar estado —</option>
                    <option value="en_plan">🟢 En Plan (Operación normal)</option>
                    <option value="con_retrasos">🟡 Con Retrasos (Inconvenientes logísticos menores)</option>
                    <option value="en_riesgo">🔴 En Riesgo (Alerta crítica / Posible cancelación)</option>
                  </select>
                </div>
                <div className="mx-field" style={{ marginTop: '16px' }}>
                  <label className="mx-label">Nota / Observación de Cosecha</label>
                  <textarea 
                    className="mx-input" 
                    value={segNota} 
                    onChange={e => setSegNota(e.target.value)} 
                    placeholder="Describe lo ocurrido (ej: retraso por clima, cambio de logística...)"
                    rows="4"
                    required
                    style={{ resize: 'none', padding: '16px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.5, background: '#f8fafc' }}
                  />
                </div>
              </div>
              <div className="mx-modal-foot" style={{ background: '#f1f5f9', padding: '16px 24px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="mx-btn" style={{ background: 'white', color: '#64748b', border: '1px solid #cbd5e1' }} onClick={() => setShowSegModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary" style={{ padding: '0 24px', background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)', border: 'none', fontWeight: 800 }}>
                  <CheckCircle2 size={18} /> Registrar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROGRAMA (ORIGINAL PORT) */}
      {showModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '600px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">{editingId ? 'Editar Programa' : 'Nuevo Programa de Cosecha'}</h3>
              <button className="mx-btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mx-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="mx-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="mx-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Proveedor / Trato Acordado</label>
                    <select 
                      className="mx-input" 
                      value={formData.tratoId} 
                      onChange={(e) => {
                        const t = tratosAcordados.find(x => x._id === e.target.value);
                        setFormData({
                          ...formData,
                          tratoId: e.target.value,
                          vigenciaDesde: t?.vigenciaDesde?.split('T')[0] || formData.vigenciaDesde,
                          vigenciaHasta: t?.vigenciaHasta?.split('T')[0] || formData.vigenciaHasta,
                          camionesDefault: t?.camionesXDia || formData.camionesDefault,
                          tonsEstimadas: t?.tonsAcordadas || formData.tonsEstimadas
                        });
                      }}
                      required
                    >
                      <option value="">— Seleccionar trato acordado —</option>
                      {tratosAcordados.map(t => (
                        <option key={t._id} value={t._id}>{t.proveedorNombre} — {t.tonsAcordadas}T ({t.estado})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mx-field">
                    <label className="mx-label">Desde</label>
                    <input type="date" className="mx-input" value={formData.vigenciaDesde} onChange={e => setFormData({...formData, vigenciaDesde: e.target.value})} required />
                  </div>
                  <div className="mx-field">
                    <label className="mx-label">Hasta</label>
                    <input type="date" className="mx-input" value={formData.vigenciaHasta} onChange={e => setFormData({...formData, vigenciaHasta: e.target.value})} required />
                  </div>
                  <div className="mx-field">
                    <label className="mx-label">Camiones / día</label>
                    <input type="number" className="mx-input" value={formData.camionesDefault} onChange={e => setFormData({...formData, camionesDefault: e.target.value})} min="0" required />
                  </div>
                  <div className="mx-field">
                    <label className="mx-label">Tons estimadas</label>
                    <input type="number" className="mx-input" value={formData.tonsEstimadas} onChange={e => setFormData({...formData, tonsEstimadas: e.target.value})} />
                  </div>
                  <div className="mx-field" style={{ gridColumn: '1 / -1' }}>
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
                  <div className="mx-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Notas / Observaciones</label>
                    <textarea className="mx-input" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} rows="2" />
                  </div>
                </div>
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINACIÓN */}
      {confirmDelete && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '400px' }}>
            <div className="mx-modal-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
              <div style={{ background: '#fef2f2', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <AlertTriangle size={32} style={{ color: '#ef4444' }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '8px' }}>¿Eliminar Programa?</h3>
              <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>
                Estás a punto de eliminar el programa de cosecha de <strong style={{ color: '#1e293b' }}>{confirmDelete.proveedorNombre}</strong>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="mx-modal-foot" style={{ background: '#f8fafc', gap: '12px' }}>
              <button className="mx-btn mx-btn-outline" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button className="mx-btn" style={{ flex: 1, background: '#ef4444', color: 'white', fontWeight: 700 }} onClick={handleDelete}>
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
