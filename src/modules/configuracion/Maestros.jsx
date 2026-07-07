import React, { useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Table,
  ClipboardList,
  Users,
  CheckSquare,
  X,
  Award,
  MinusCircle,
  Settings2,
  Truck,
  GripVertical,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maestrosApi } from '../../api/api-maestros';
import { apiClient } from '../../api/apiClient';
import { downloadXlsx } from '../../utils/downloadXlsx';
import { tonsPorCamionDeTipo, kgRefDeTipo } from '../biomasa/utils/programaCalculos';
import { useToast } from '../../context/ToastContext';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import './maestros.css';

const PARAMS_FIJOS = [
  { campo: 'uxkg', nombre: 'Calibre', unidad: 'un/kg' },
  { campo: 'rendimiento', nombre: 'Rendimiento', unidad: '%' },
  { campo: 'procesable', nombre: '% Procesable', unidad: '%' },
  { campo: 'rechazos', nombre: '% Rechazos', unidad: '%' },
  { campo: 'defectos', nombre: '% Defectos', unidad: '%' },
];

const TIPOS = [
  { id: 'categoria-muestreo',  label: 'Categorías de Muestreo', short: 'Categorías',   icon: Table },
  { id: 'regla_calidad',       label: 'Reglas de Calidad',       short: 'Productos',    icon: Award },
  { id: 'proximo-paso',        label: 'Próximos Pasos',          short: 'Próx. Pasos',  icon: CheckSquare },
  { id: 'condicion_negociacion', label: 'Acuerdo de Tratos',     short: 'Tratos',       icon: ClipboardList },
  { id: 'responsable',         label: 'Responsables',            short: 'Responsables', icon: Users },
  { id: 'tipo_transporte',     label: 'Tipos de Transporte',     short: 'Transporte',   icon: Truck },
  { id: 'transportista',       label: 'Transportistas',          short: 'Transportistas', icon: Truck },
];

const TIPO_CAMION_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'con_carro', label: 'Con carro' },
  { value: 'con_rampa', label: 'Con rampa' },
  { value: 'tolva_simple', label: 'Tolva simple' },
  { value: 'tolva_doble', label: 'Tolva doble' },
];

const TIPO_CAMION_LABELS = TIPO_CAMION_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const EMPTY_LIST = [];

const formatCLP = (value) => {
  const number = Number(value || 0);
  return number
    ? number.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
    : '—';
};

export default function Maestros({ noPage = false }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [tipo, setTipo] = useState('categoria-muestreo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [modalParams, setModalParams] = useState([]);
  const [orderedItems, setOrderedItems] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [transportistasImport, setTransportistasImport] = useState({
    open: false,
    preview: null,
    loadingPreview: false,
    loadingConfirm: false,
  });

  // Prefetch de todas las categorías para carga instantánea
  React.useEffect(() => {
    TIPOS.forEach((t) => {
      queryClient.prefetchQuery({
        queryKey: ['maestros', t.id],
        queryFn: () => maestrosApi.getMaestros(t.id),
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [queryClient]);

  const { data: maestros = EMPTY_LIST, isLoading: loading } = useQuery({
    queryKey: ['maestros', tipo],
    queryFn: () => maestrosApi.getMaestros(tipo),
    staleTime: 5 * 60 * 1000,
  });

  const { data: catMuestreo = EMPTY_LIST } = useQuery({
    queryKey: ['maestros', 'categoria-muestreo', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('categoria-muestreo'),
    enabled: tipo === 'regla_calidad',
    staleTime: 5 * 60 * 1000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editingItem
        ? maestrosApi.actualizarMaestro(editingItem._id, body)
        : maestrosApi.crearMaestro(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maestros'] });
      setIsModalOpen(false);
      addToast({ title: 'Éxito', message: 'Maestro guardado correctamente.', type: 'success' });
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo guardar el maestro.', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => maestrosApi.eliminarMaestro(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maestros'] });
      setIsConfirmDeleteOpen(false);
      setItemToDelete(null);
      addToast({ title: 'Éxito', message: 'Registro eliminado correctamente.', type: 'success' });
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo eliminar el maestro.', type: 'error' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }) => maestrosApi.actualizarMaestro(id, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maestros'] }),
    onError: () =>
      addToast({ title: 'Error', message: 'No se pudo cambiar el estado.', type: 'error' }),
  });

  const reorderMutation = useMutation({
    mutationFn: (items) =>
      Promise.all(items.map((item) => maestrosApi.actualizarMaestro(item._id, { orden: item.orden }))),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['maestros', 'categoria-muestreo'] }),
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo guardar el orden.', type: 'error' });
      queryClient.invalidateQueries({ queryKey: ['maestros', 'categoria-muestreo'] });
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const rawList = React.useMemo(
    () => (Array.isArray(maestros) ? maestros : (maestros?.items || [])),
    [maestros],
  );

  const maestrosList = React.useMemo(() => {
    let filtered = rawList;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter((m) => (
        [
          m.nombre,
          m.rut,
          m.comunaOrigen,
          TIPO_CAMION_LABELS[m.tipoCamion],
          m.tipoCamion,
        ].filter(Boolean).join(' ').toLowerCase().includes(s)
      ));
    }
    if (tipoFilter && tipo === 'categoria-muestreo') {
      filtered = filtered.filter((m) => m.tipoCat === tipoFilter);
    }
    return filtered;
  }, [rawList, searchTerm, tipoFilter, tipo]);

  // Conteo por tab — se actualiza cada vez que cambiamos de tab (nuevo dato en cache)
  const tabCounts = React.useMemo(() => {
    const result = {};
    TIPOS.forEach((t) => {
      const cached = queryClient.getQueryData(['maestros', t.id]);
      const list = Array.isArray(cached) ? cached : (cached?.items || []);
      result[t.id] = list.length;
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, maestros]);

  // Drag mode: solo para categoria-muestreo sin filtros activos
  const isDragMode = tipo === 'categoria-muestreo' && !searchTerm && !tipoFilter;

  // Sync orderedItems cuando cambia el dato raw
  React.useEffect(() => {
    if (tipo === 'categoria-muestreo') setOrderedItems(rawList);
  }, [rawList, tipo]);

  const displayList = isDragMode ? orderedItems : maestrosList;

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnter = (idx) => setDragOverIdx(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const handleDrop = (toIdx) => {
    const fromIdx = dragIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    if (fromIdx === null || fromIdx === toIdx) return;

    const next = [...orderedItems];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const withOrder = next.map((item, i) => ({ ...item, orden: i }));
    setOrderedItems(withOrder);

    const prevMap = new Map(orderedItems.map((item) => [String(item._id), item.orden ?? 0]));
    const changed = withOrder.filter((item) => item.orden !== prevMap.get(String(item._id)));
    reorderMutation.mutate(changed);
  };

  // ── Form handlers ──────────────────────────────────────────────────────────

  const handleNuevo = () => { setEditingItem(null); setModalParams([]); setIsModalOpen(true); };
  const handleEdit = (item) => { setEditingItem(item); setModalParams(item.parametros || []); setIsModalOpen(true); };
  const askDelete = (item) => { setItemToDelete(item); setIsConfirmDeleteOpen(true); };
  const handleDelete = () => { if (itemToDelete) deleteMutation.mutate(itemToDelete._id); };

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());
    body.tipo = tipo;
    body.activo = formData.get('activo') === 'on';
    if (body.orden !== undefined) body.orden = Number(body.orden);
    if (body.requerido !== undefined) body.requerido = formData.get('requerido') === 'on';
    if (tipo === 'regla_calidad') {
      body.parametros = modalParams;
      body.prioridad = { Entero: 1, 'Media Concha': 2, Carne: 3 }[body.tipoPrincipal] || 99;
    }
    if (tipo === 'tipo_transporte') {
      body.maxisPorUnidad = body.maxisPorUnidad !== '' ? Number(body.maxisPorUnidad) : null;
      body.kgPorMaxiRef   = body.kgPorMaxiRef   !== '' ? Number(body.kgPorMaxiRef)   : null;
    }
    if (tipo === 'transportista') {
      body.precio = body.precio !== '' ? Number(body.precio) : null;
      body.toneladas = body.toneladas !== '' ? Number(body.toneladas) : null;
      body.maxisPorCamion = body.maxisPorCamion !== '' ? Number(body.maxisPorCamion) : null;
    }
    if (body.opcionesRaw) {
      body.opciones = body.opcionesRaw.split('\n').map((s) => s.trim()).filter(Boolean);
      delete body.opcionesRaw;
    }
    saveMutation.mutate(body);
  };

  const paramOptions = [
    ...PARAMS_FIJOS,
    ...catMuestreo.map((c) => ({ campo: 'cats', campoId: c._id, nombre: c.nombre, unidad: '%' })),
  ];

  const handleDownloadTransportistas = async () => {
    try {
      await downloadXlsx('/exportar/transportistas', `transportistas-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      addToast({ title: 'Error', message: err.message || 'No se pudo descargar el Excel.', type: 'error' });
    }
  };

  const handleTemplateTransportistas = async () => {
    try {
      await downloadXlsx('/importar/plantilla/transportistas', 'plantilla-transportistas.xlsx');
    } catch (err) {
      addToast({ title: 'Error', message: err.message || 'No se pudo descargar la plantilla.', type: 'error' });
    }
  };

  const handlePreviewTransportistas = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append('archivo', file);
    setTransportistasImport((prev) => ({ ...prev, loadingPreview: true }));
    try {
      const preview = await apiClient.post('/importar/transportistas/preview', form);
      setTransportistasImport((prev) => ({ ...prev, preview, loadingPreview: false }));
    } catch (err) {
      setTransportistasImport((prev) => ({ ...prev, loadingPreview: false }));
      addToast({ title: 'Error', message: err.message || 'No se pudo leer el Excel.', type: 'error' });
    }
  };

  const handleConfirmTransportistas = async () => {
    const preview = transportistasImport.preview;
    if (!preview?.filas?.length) return;
    setTransportistasImport((prev) => ({ ...prev, loadingConfirm: true }));
    try {
      const result = await apiClient.post('/importar/transportistas/confirmar', { filas: preview.filas });
      queryClient.invalidateQueries({ queryKey: ['maestros', 'transportista'] });
      setTransportistasImport({ open: false, preview: null, loadingPreview: false, loadingConfirm: false });
      addToast({
        title: 'Éxito',
        message: `Se procesaron ${result.insertados || 0} transportistas.`,
        type: 'success',
      });
    } catch (err) {
      setTransportistasImport((prev) => ({ ...prev, loadingConfirm: false }));
      addToast({ title: 'Error', message: err.message || 'No se pudo confirmar la importación.', type: 'error' });
    }
  };

  // ── Guard: sin tenant ──────────────────────────────────────────────────────

  const activeTenant = localStorage.getItem('selected_tenant_db');
  if (!activeTenant) {
    const noTenantContent = (
      <div className="mx-content-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', background: 'white', borderRadius: '12px', marginTop: '24px' }}>
        <div style={{ maxWidth: '400px', padding: '40px', textAlign: 'center' }}>
          <div style={{ background: '#f1f5f9', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Settings2 size={32} style={{ color: '#64748b' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Empresa no seleccionada</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Para configurar categorías, reglas de calidad y otros maestros, primero debes seleccionar una empresa en el panel superior.
          </p>
        </div>
      </div>
    );
    if (noPage) return noTenantContent;
    return (
      <div className="mx-page">
        <header className="mx-hero">
          <div className="mx-hero-content">
            <p className="mx-eyebrow">Administración - Parámetros</p>
            <h1>Maestros del Sistema</h1>
          </div>
        </header>
        {noTenantContent}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const contentFrame = (<>
    <div className="mx-content-frame maestros-content-frame">
        <div className="mx-table-card maestros-layout">

          {/* ── Nav lateral de categorías ── */}
          <nav className="maestros-sidenav">
            <p className="maestros-sidenav-label">Categorías</p>
            {TIPOS.map((t) => (
              <button
                key={t.id}
                className={`maestros-sidenav-btn ${tipo === t.id ? 'active' : ''}`}
                onClick={() => { setTipo(t.id); setTipoFilter(''); setSearchTerm(''); }}
              >
                <t.icon size={14} />
                <span>{t.short}</span>
                {tabCounts[t.id] > 0 && (
                  <span className="maestros-sidenav-count">{tabCounts[t.id]}</span>
                )}
              </button>
            ))}
          </nav>

          {/* ── Contenido principal ── */}
          <div className="maestros-main">
            <div className="maestros-topbar">
              <div className="maestros-topbar-title">
                {(() => { const t = TIPOS.find((t) => t.id === tipo); return t ? <><t.icon size={16} />{t.label}</> : null; })()}
              </div>
              <div className="maestros-topbar-actions">
                {tipo === 'categoria-muestreo' && (
                  <select
                    className="mx-select maestros-tipo-filter"
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value)}
                  >
                    <option value="">Todos los tipos</option>
                    <option value="procesable">Procesable</option>
                    <option value="rechazo">Rechazo</option>
                    <option value="defecto">Defecto</option>
                  </select>
                )}
                <div className="mx-search-box maestros-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {tipo === 'transportista' && (
                  <>
                    <button className="mx-btn mx-btn-outline" onClick={handleDownloadTransportistas}>
                      <Download size={16} /> Descargar Excel
                    </button>
                    <button className="mx-btn mx-btn-outline" onClick={() => setTransportistasImport({ open: true, preview: null, loadingPreview: false, loadingConfirm: false })}>
                      <Upload size={16} /> Subir Excel
                    </button>
                  </>
                )}
                <button className="mx-btn mx-btn-primary" onClick={handleNuevo}>
                  <Plus size={16} /> Nuevo
                </button>
              </div>
            </div>

        <div className="maestros-table-inner">
          {isDragMode && (
            <div className="maestros-drag-hint">
              <GripVertical size={13} /> Arrastra las filas para reordenar
              {reorderMutation.isPending && <span className="maestros-drag-saving">Guardando...</span>}
            </div>
          )}
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  {isDragMode && <th className="maestros-drag-th" />}
                  <th style={{ width: tipo === 'transportista' ? '22%' : '30%' }}>
                    {tipo === 'transportista' ? 'Transportista' : 'Nombre / Valor'}
                  </th>
                  {tipo === 'categoria-muestreo' && <th>Tipo Categoría</th>}
                  {tipo === 'regla_calidad' && <th>Configuración</th>}
                  {tipo === 'condicion_negociacion' && <th>Tipo Valor</th>}
                  {tipo === 'tipo_transporte' && <th>Modo</th>}
                  {tipo === 'tipo_transporte' && <th style={{ textAlign: 'center' }}>Maxis/Un.</th>}
                  {tipo === 'tipo_transporte' && <th style={{ textAlign: 'center' }}>Kg/Maxi ref.</th>}
                  {tipo === 'tipo_transporte' && <th style={{ textAlign: 'center' }}>Total ref.</th>}
                  {tipo === 'transportista' && <th>Comuna Origen</th>}
                  {tipo === 'transportista' && <th>Tipo Camión</th>}
                  {tipo === 'transportista' && <th style={{ textAlign: 'right' }}>Precio</th>}
                  {tipo === 'transportista' && <th style={{ textAlign: 'center' }}>Toneladas</th>}
                  {tipo === 'transportista' && <th style={{ textAlign: 'center' }}>Maxis/Camión</th>}
                  {tipo === 'categoria-muestreo' && !isDragMode && <th style={{ width: '80px', textAlign: 'center' }}>Orden</th>}
                  <th style={{ width: '130px' }}>Estado</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10">
                      <div className="mx-state-placeholder"><div className="mx-spinner" /></div>
                    </td>
                  </tr>
                ) : displayList.length === 0 ? (
                  <tr>
                    <td colSpan="10">
                      <div className="mx-state-placeholder">No hay registros.</div>
                    </td>
                  </tr>
                ) : (
                  displayList.map((item, idx) => (
                    <tr
                      key={item._id}
                      draggable={isDragMode}
                      onDragStart={isDragMode ? (e) => handleDragStart(e, idx) : undefined}
                      onDragEnter={isDragMode ? () => handleDragEnter(idx) : undefined}
                      onDragOver={isDragMode ? handleDragOver : undefined}
                      onDrop={isDragMode ? () => handleDrop(idx) : undefined}
                      onDragEnd={isDragMode ? handleDragEnd : undefined}
                      className={
                        isDragMode && dragIdx === idx
                          ? 'maestros-row-dragging'
                          : isDragMode && dragOverIdx === idx && dragIdx !== idx
                            ? 'maestros-row-dragover'
                            : ''
                      }
                    >
                      {isDragMode && (
                        <td className="maestros-drag-cell">
                          <GripVertical size={16} />
                        </td>
                      )}
                      <td data-label={tipo === 'transportista' ? 'Transportista' : 'Nombre / Valor'}>
                        <span style={{ fontWeight: 500 }}>{item.nombre}</span>
                        {tipo === 'transportista' && item.rut && (
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>RUT: {item.rut}</div>
                        )}
                      </td>
                      {tipo === 'categoria-muestreo' && (
                        <td data-label="Tipo Categoría">
                          <span className={`mx-badge mx-badge-${
                            item.tipoCat === 'procesable' ? 'success'
                              : item.tipoCat === 'rechazo' ? 'danger'
                                : item.tipoCat === 'defecto' ? 'info'
                                  : 'muted'
                          }`}>
                            {item.tipoCat?.toUpperCase()}
                          </span>
                        </td>
                      )}
                      {tipo === 'regla_calidad' && (
                        <td data-label="Configuración">
                          <div className="maestros-params-grid">
                            {item.parametros?.map((p, i) => (
                              <div key={i} className="maestros-param-chip">
                                <span className="maestros-param-chip-name">{p.nombre}</span>
                                <span className="maestros-param-chip-range">{p.min ?? '∞'} – {p.max ?? '∞'}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      )}
                      {tipo === 'condicion_negociacion' && <td data-label="Tipo Valor"><code>{item.tipoValor}</code></td>}
                      {tipo === 'tipo_transporte' && (
                        <td data-label="Modo">
                          <span className={`mx-badge mx-badge-${item.modo === 'maritimo' ? 'info' : 'muted'}`}>
                            {item.modo === 'maritimo' ? 'Marítimo' : item.modo === 'terrestre' ? 'Terrestre' : '—'}
                          </span>
                        </td>
                      )}
                      {tipo === 'tipo_transporte' && <td data-label="Maxis/Un." style={{ textAlign: 'center' }}>{item.maxisPorUnidad ?? '—'}</td>}
                      {tipo === 'tipo_transporte' && <td data-label="Kg/Maxi ref." style={{ textAlign: 'center' }}>{item.kgPorMaxiRef ? `${item.kgPorMaxiRef} kg` : '—'}</td>}
                      {tipo === 'tipo_transporte' && (() => {
                        const tons = tonsPorCamionDeTipo(item);
                        const kg = kgRefDeTipo(item);
                        return (
                          <td data-label="Total ref." style={{ textAlign: 'center' }} title={tons != null ? `${item.maxisPorUnidad} × ${item.kgPorMaxiRef} kg = ${kg.toLocaleString('es-CL')} kg` : 'Faltan datos para calcular'}>
                            {tons != null ? <strong>{tons.toLocaleString('es-CL', { maximumFractionDigits: 1 })} t</strong> : '—'}
                          </td>
                        );
                      })()}
                      {tipo === 'transportista' && <td data-label="Comuna Origen">{item.comunaOrigen || '—'}</td>}
                      {tipo === 'transportista' && (
                        <td data-label="Tipo Camión">
                          <span className="mx-badge mx-badge-info">
                            {TIPO_CAMION_LABELS[item.tipoCamion] || item.tipoCamion || '—'}
                          </span>
                        </td>
                      )}
                      {tipo === 'transportista' && <td data-label="Precio" style={{ textAlign: 'right' }}>{formatCLP(item.precio)}</td>}
                      {tipo === 'transportista' && <td data-label="Toneladas" style={{ textAlign: 'center' }}>{item.toneladas != null ? `${item.toneladas} t` : '—'}</td>}
                      {tipo === 'transportista' && <td data-label="Maxis/Camión" style={{ textAlign: 'center' }}>{item.maxisPorCamion ?? '—'}</td>}
                      {tipo === 'categoria-muestreo' && !isDragMode && (
                        <td data-label="Orden" style={{ textAlign: 'center' }}>{item.orden ?? 0}</td>
                      )}
                      <td data-label="Estado">
                        <button
                          type="button"
                          className="maestros-toggle"
                          onClick={() => toggleMutation.mutate({ id: item._id, activo: !item.activo })}
                          disabled={toggleMutation.isPending}
                          title={item.activo ? 'Desactivar' : 'Activar'}
                        >
                          <span className={`maestros-toggle-pill ${item.activo ? 'on' : ''}`} />
                          <span className={`maestros-toggle-label ${item.activo ? 'on' : ''}`}>
                            {item.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </button>
                      </td>
                      <td data-label="Acciones" style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="mx-action-btn edit" onClick={() => handleEdit(item)}><Edit size={14} /></button>
                          <button className="mx-action-btn delete" onClick={() => askDelete(item)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>      {/* fin maestros-table-inner */}
          </div>    {/* fin maestros-main */}
        </div>      {/* fin maestros-layout */}
      </div>        {/* fin maestros-content-frame */}

      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: tipo === 'regla_calidad' ? '650px' : '500px' }}>
            <div className="mx-modal-header">
              <h2>{editingItem ? 'Editar' : 'Nuevo'} Registro</h2>
              <button type="button" className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} key={editingItem?._id || 'nuevo'} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Nombre / Etiqueta</label>
                  <input name="nombre" className="mx-input" defaultValue={editingItem?.nombre} required />
                </div>

                {tipo === 'categoria-muestreo' && (
                  <div className="mx-form-group">
                    <label className="mx-label">Tipo Categoría</label>
                    <select name="tipoCat" className="mx-select" defaultValue={editingItem?.tipoCat || 'procesable'}>
                      <option value="procesable">Procesable</option>
                      <option value="rechazo">Rechazo</option>
                      <option value="defecto">Defecto</option>
                    </select>
                  </div>
                )}

                {tipo === 'regla_calidad' && (
                  <>
                    <div className="mx-form-group">
                      <label className="mx-label">Tipo Principal</label>
                      <select name="tipoPrincipal" className="mx-select" defaultValue={editingItem?.tipoPrincipal || 'Entero'}>
                        <option value="Entero">Entero</option>
                        <option value="Media Concha">Media Concha</option>
                        <option value="Carne">Carne</option>
                      </select>
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label maestros-modal-param-header">
                        Rangos de Calidad
                        <select
                          className="mx-select maestros-modal-param-select"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const p = paramOptions.find((o) => (o.campoId || o.campo) === val);
                            if (p && !modalParams.some((mp) => mp.campo === p.campo && mp.campoId === p.campoId)) {
                              setModalParams([...modalParams, { ...p, min: '', max: '' }]);
                            }
                            e.target.value = '';
                          }}
                        >
                          <option value="">+ Añadir Parámetro</option>
                          {paramOptions.map((o) => (
                            <option key={o.campoId || o.campo} value={o.campoId || o.campo}>{o.nombre}</option>
                          ))}
                        </select>
                      </label>
                      <div className="maestros-modal-params-list">
                        {modalParams.map((p, idx) => (
                          <div key={idx} className="maestros-modal-param-row">
                            <span className="maestros-modal-param-name">{p.nombre}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number" step="0.1" placeholder="Mín"
                                className="mx-input maestros-modal-param-input"
                                value={p.min ?? ''}
                                onChange={(e) => {
                                  const next = [...modalParams];
                                  next[idx].min = e.target.value === '' ? null : Number(e.target.value);
                                  setModalParams(next);
                                }}
                              />
                              <input
                                type="number" step="0.1" placeholder="Máx"
                                className="mx-input maestros-modal-param-input"
                                value={p.max ?? ''}
                                onChange={(e) => {
                                  const next = [...modalParams];
                                  next[idx].max = e.target.value === '' ? null : Number(e.target.value);
                                  setModalParams(next);
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', minWidth: '35px' }}>
                                {p.unidad || (p.campo === 'uxkg' ? 'un/kg' : '%')}
                              </span>
                            </div>
                            <button type="button" className="mx-btn-icon" onClick={() => setModalParams(modalParams.filter((_, i) => i !== idx))}>
                              <MinusCircle size={14} className="maestros-modal-param-delete" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tipo === 'tipo_transporte' && (
                  <>
                    <div className="mx-form-group">
                      <label className="mx-label">Modo</label>
                      <select name="modo" className="mx-select" defaultValue={editingItem?.modo || 'terrestre'}>
                        <option value="maritimo">Marítimo</option>
                        <option value="terrestre">Terrestre</option>
                      </select>
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Maxis por unidad</label>
                      <input name="maxisPorUnidad" type="number" min="1" step="1" className="mx-input" defaultValue={editingItem?.maxisPorUnidad ?? ''} placeholder="Ej: 20" />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Kg por maxi (referencia)</label>
                      <input name="kgPorMaxiRef" type="number" min="1" step="1" className="mx-input" defaultValue={editingItem?.kgPorMaxiRef ?? ''} placeholder="Ej: 1100" />
                    </div>
                  </>
                )}

                {tipo === 'transportista' && (
                  <>
                    <div className="mx-form-group">
                      <label className="mx-label">RUT</label>
                      <input name="rut" className="mx-input" defaultValue={editingItem?.rut || ''} placeholder="Ej: 76.123.456-7" />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Comuna de origen</label>
                      <input name="comunaOrigen" className="mx-input" defaultValue={editingItem?.comunaOrigen || ''} required placeholder="Ej: Quellón" />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Tipo de camión</label>
                      <select name="tipoCamion" className="mx-select" defaultValue={editingItem?.tipoCamion || 'simple'}>
                        {TIPO_CAMION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Precio</label>
                      <input name="precio" type="number" min="0" step="1" className="mx-input" defaultValue={editingItem?.precio ?? ''} placeholder="Ej: 180000" />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Toneladas</label>
                      <input name="toneladas" type="number" min="0" step="0.1" className="mx-input" defaultValue={editingItem?.toneladas ?? ''} placeholder="Ej: 25" />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Maxis por camión</label>
                      <input name="maxisPorCamion" type="number" min="0" step="1" className="mx-input" defaultValue={editingItem?.maxisPorCamion ?? ''} placeholder="Ej: 20" />
                    </div>
                  </>
                )}

                {tipo === 'condicion_negociacion' && (
                  <>
                    <div className="mx-form-group">
                      <label className="mx-label">Tipo Valor</label>
                      <select name="tipoValor" className="mx-select" defaultValue={editingItem?.tipoValor || 'texto'}>
                        <option value="moneda">Moneda ($)</option>
                        <option value="porcentaje">Porcentaje (%)</option>
                        <option value="dias">Días</option>
                        <option value="numero">Número</option>
                        <option value="opciones">Lista de Opciones</option>
                        <option value="texto">Texto</option>
                      </select>
                    </div>
                    <div className="mx-form-group maestros-modal-checkbox-row">
                      <label className="mx-label maestros-modal-label-mb0" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" name="requerido" defaultChecked={editingItem?.requerido} />
                        Campo Requerido
                      </label>
                    </div>
                  </>
                )}

                {tipo === 'categoria-muestreo' && (
                  <div className="mx-form-group">
                    <label className="mx-label">Orden</label>
                    <input name="orden" type="number" className="mx-input" defaultValue={editingItem?.orden || 0} />
                  </div>
                )}

                <div className="mx-form-group maestros-modal-checkbox-row maestros-modal-checkbox-margin">
                  <label className="mx-label maestros-modal-label-mb0" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" name="activo" defaultChecked={editingItem ? editingItem.activo : true} />
                    Registro Activo
                  </label>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transportistasImport.open && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '860px' }}>
            <div className="mx-modal-header">
              <div>
                <h2>Subir Transportistas</h2>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                  Importa tramos por transportista hacia la planta del tenant actual.
                </p>
              </div>
              <button
                type="button"
                className="mx-btn-icon"
                onClick={() => setTransportistasImport({ open: false, preview: null, loadingPreview: false, loadingConfirm: false })}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mx-modal-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <button type="button" className="mx-btn mx-btn-outline" onClick={handleTemplateTransportistas}>
                  <Download size={16} /> Descargar plantilla
                </button>
                <label className="mx-btn mx-btn-primary" style={{ cursor: 'pointer' }}>
                  <Upload size={16} />
                  {transportistasImport.loadingPreview ? 'Procesando...' : 'Seleccionar Excel'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    hidden
                    onChange={(event) => handlePreviewTransportistas(event.target.files?.[0])}
                  />
                </label>
              </div>

              {transportistasImport.preview && (
                <>
                  <div className="maestros-import-summary">
                    <span><strong>{transportistasImport.preview.resumen?.total || 0}</strong> filas</span>
                    <span className="ok"><strong>{transportistasImport.preview.resumen?.ok || 0}</strong> ok</span>
                    <span className="error"><strong>{transportistasImport.preview.resumen?.errores || 0}</strong> errores</span>
                  </div>

                  {(transportistasImport.preview.resumen?.errores || 0) > 0 && (
                    <div className="maestros-import-warning">
                      <AlertTriangle size={16} />
                      Hay filas con error. Solo se confirmarán las filas válidas.
                    </div>
                  )}

                  <div className="maestros-import-preview">
                    <table className="mx-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Estado</th>
                          <th>Transportista</th>
                          <th>RUT</th>
                          <th>Comuna Origen</th>
                          <th>Tipo Camión</th>
                          <th>Precio</th>
                          <th>Toneladas</th>
                          <th>Maxis</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transportistasImport.preview.filas?.map((fila) => (
                          <tr key={fila._fila}>
                            <td data-label="#">{fila._fila}</td>
                            <td data-label="Estado" style={{ color: fila._ok ? '#059669' : '#dc2626' }}>
                              {fila._ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                            </td>
                            <td data-label="Transportista">{fila.nombre}</td>
                            <td data-label="RUT">{fila.rut || '—'}</td>
                            <td data-label="Comuna Origen">{fila.comunaOrigen || '—'}</td>
                            <td data-label="Tipo Camión">{TIPO_CAMION_LABELS[fila.tipoCamion] || fila.tipoCamion || '—'}</td>
                            <td data-label="Precio">{formatCLP(fila.precio)}</td>
                            <td data-label="Toneladas">{fila.toneladas ?? '—'}</td>
                            <td data-label="Maxis">{fila.maxisPorCamion ?? '—'}</td>
                            <td data-label="Detalle" style={{ color: fila._ok ? '#64748b' : '#dc2626', fontSize: 12 }}>
                              {fila._errores?.join(', ') || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="mx-modal-footer">
              <button
                type="button"
                className="mx-btn mx-btn-outline"
                onClick={() => setTransportistasImport({ open: false, preview: null, loadingPreview: false, loadingConfirm: false })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mx-btn mx-btn-primary"
                onClick={handleConfirmTransportistas}
                disabled={!transportistasImport.preview || transportistasImport.loadingConfirm || (transportistasImport.preview.resumen?.ok || 0) === 0}
              >
                {transportistasImport.loadingConfirm ? 'Importando...' : 'Confirmar importación'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        itemName={itemToDelete?.nombre}
      />
    </>
  );
  if (noPage) return contentFrame;
  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Administración - Parámetros</p>
          <h1>Maestros del Sistema</h1>
          <p>Administración dinámica de categorías y parámetros operativos.</p>
        </div>
      </header>
      {contentFrame}
    </div>
  );
}
