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
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maestrosApi } from '../../api/api-maestros';
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

export default function Maestros() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipo, setTipo] = useState('categoria-muestreo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [modalParams, setModalParams] = useState([]);

  // Prefetch de todas las categorías para carga instantánea
  React.useEffect(() => {
    const tiposArr = [
      'categoria-muestreo',
      'regla_calidad',
      'proximo-paso',
      'condicion_negociacion',
      'responsable',
      'tipo_transporte',
    ];
    tiposArr.forEach(t => {
      queryClient.prefetchQuery({
        queryKey: ['maestros', t],
        queryFn: () => maestrosApi.getMaestros(t),
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [queryClient]);

  const { data: maestros = [], isLoading: loading } = useQuery({
    queryKey: ['maestros', tipo],
    queryFn: () => maestrosApi.getMaestros(tipo),
    staleTime: 5 * 60 * 1000,
  });

  // Filtro de búsqueda local (ultra rápido)
  const maestrosList = React.useMemo(() => {
    const list = Array.isArray(maestros) ? maestros : (maestros?.items || []);
    if (!searchTerm) return list;
    const s = searchTerm.toLowerCase();
    return list.filter(m => m.nombre?.toLowerCase().includes(s));
  }, [maestros, searchTerm]);

  const { data: catMuestreo = [] } = useQuery({
    queryKey: ['maestros', 'categoria-muestreo', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('categoria-muestreo'),
    enabled: tipo === 'regla_calidad',
    staleTime: 5 * 60 * 1000,
  });

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

  const TIPOS = [
    { id: 'categoria-muestreo', label: 'Categorías de Muestreo', icon: Table },
    { id: 'regla_calidad', label: 'Reglas de Calidad', icon: Award },
    { id: 'proximo-paso', label: 'Próximos Pasos', icon: CheckSquare },
    { id: 'condicion_negociacion', label: 'Acuerdo de Tratos', icon: ClipboardList },
    { id: 'responsable', label: 'Responsables', icon: Users },
    { id: 'tipo_transporte', label: 'Tipos de Transporte', icon: Truck },
  ];

  const handleNuevo = () => {
    setEditingItem(null);
    setModalParams([]);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setModalParams(item.parametros || []);
    setIsModalOpen(true);
  };

  const askDelete = (item) => {
    setItemToDelete(item);
    setIsConfirmDeleteOpen(true);
  };

  const handleDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete._id);
    }
  };

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

  const activeTenant = localStorage.getItem('selected_tenant_db');

  if (!activeTenant) {
    return (
      <div className="mx-page">
        <header className="mx-hero">
          <div className="mx-hero-content">
            <p className="mx-eyebrow">Administración - Parámetros</p>
            <h1>Maestros del Sistema</h1>
          </div>
        </header>
        <div className="mx-content-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', background: 'white', borderRadius: '12px', marginTop: '24px' }}>
          <div className="am-text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <div style={{ background: '#f1f5f9', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Settings2 size={32} style={{ color: '#64748b' }} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Empresa no seleccionada</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Para configurar categorías, reglas de calidad y otros maestros, primero debes seleccionar una empresa en el panel superior.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Administración - Parámetros</p>
          <h1>Maestros del Sistema</h1>
          <p>Administración dinámica de categorías y parámetros operativos.</p>
        </div>
        <div className="mx-hero-actions">
          <button className="mx-btn mx-btn-primary" onClick={handleNuevo}>
            <Plus size={18} /> Nuevo Registro
          </button>
        </div>
      </header>

      <div className="mx-content-frame maestros-content-frame">
        <div className="mx-toolbar maestros-toolbar">
          <div className="mx-toggle-group">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                className={`mx-toggle-btn ${tipo === t.id ? 'active' : ''}`}
                onClick={() => setTipo(t.id)}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <div className="mx-search-box maestros-search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Filtrar registros..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="mx-table-card maestros-table-card">
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Nombre / Valor</th>
                  {tipo === 'categoria-muestreo' && <th>Tipo Categoría</th>}
                  {tipo === 'regla_calidad' && <th>Configuración</th>}
                  {tipo === 'condicion_negociacion' && <th>Tipo Valor</th>}
                  {tipo === 'tipo_transporte' && <th>Modo</th>}
                  {tipo === 'tipo_transporte' && <th style={{ textAlign: 'center' }}>Maxis/Un.</th>}
                  {tipo === 'tipo_transporte' && <th style={{ textAlign: 'center' }}>Kg/Maxi ref.</th>}
                  {tipo !== 'responsable' && <th style={{ width: '80px', textAlign: 'center' }}>Orden</th>}
                  <th style={{ width: '120px' }}>Estado</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10">
                      <div className="mx-state-placeholder">
                        <div className="mx-spinner"></div>
                      </div>
                    </td>
                  </tr>
                ) : maestrosList.length === 0 ? (
                  <tr>
                    <td colSpan="10">
                      <div className="mx-state-placeholder">No hay registros.</div>
                    </td>
                  </tr>
                ) : (
                  maestrosList.map((item) => (
                    <tr key={item._id}>
                      <td><span style={{ fontWeight: 'var(--weight-bold)' }}>{item.nombre}</span></td>
                      {tipo === 'categoria-muestreo' && (
                        <td>
                          <span
                            className={`mx-badge mx-badge-${
                              item.tipoCat === 'procesable'
                                ? 'success'
                                : item.tipoCat === 'rechazo'
                                  ? 'danger'
                                  : item.tipoCat === 'defecto'
                                    ? 'info'
                                    : 'muted'
                            }`}
                          >
                            {item.tipoCat?.toUpperCase()}
                          </span>
                        </td>
                      )}
                      {tipo === 'regla_calidad' && (
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {item.parametros?.map((p, i) => (
                              <span key={i} className="mx-badge" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                <strong>{p.nombre}</strong>: {p.min ?? '∞'}–{p.max ?? '∞'}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      {tipo === 'condicion_negociacion' && <td><code>{item.tipoValor}</code></td>}
                      {tipo === 'tipo_transporte' && (
                        <td>
                          <span className={`mx-badge mx-badge-${item.modo === 'maritimo' ? 'info' : 'muted'}`}>
                            {item.modo === 'maritimo' ? 'Marítimo' : item.modo === 'terrestre' ? 'Terrestre' : '—'}
                          </span>
                        </td>
                      )}
                      {tipo === 'tipo_transporte' && <td style={{ textAlign: 'center' }}>{item.maxisPorUnidad ?? '—'}</td>}
                      {tipo === 'tipo_transporte' && <td style={{ textAlign: 'center' }}>{item.kgPorMaxiRef ? `${item.kgPorMaxiRef} kg` : '—'}</td>}
                      {tipo !== 'responsable' && <td style={{ textAlign: 'center' }}>{item.orden ?? 0}</td>}
                      <td>
                        <span className={`mx-badge mx-badge-${item.activo ? 'success' : 'muted'}`}>
                          {item.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="mx-table-actions-cell" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
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
        </div>
      </div>

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
                            <option key={o.campoId || o.campo} value={o.campoId || o.campo}>
                              {o.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="maestros-modal-params-list">
                        {modalParams.map((p, idx) => (
                          <div key={idx} className="maestros-modal-param-row">
                            <span className="maestros-modal-param-name">{p.nombre}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="Mín"
                                className="mx-input maestros-modal-param-input"
                                value={p.min ?? ''}
                                onChange={(e) => {
                                  const next = [...modalParams];
                                  next[idx].min = e.target.value === '' ? null : Number(e.target.value);
                                  setModalParams(next);
                                }}
                              />
                              <input
                                type="number"
                                step="0.1"
                                placeholder="Máx"
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
                      <input
                        name="maxisPorUnidad"
                        type="number"
                        min="1"
                        step="1"
                        className="mx-input"
                        defaultValue={editingItem?.maxisPorUnidad ?? ''}
                        placeholder="Ej: 20"
                      />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Kg por maxi (referencia)</label>
                      <input
                        name="kgPorMaxiRef"
                        type="number"
                        min="1"
                        step="1"
                        className="mx-input"
                        defaultValue={editingItem?.kgPorMaxiRef ?? ''}
                        placeholder="Ej: 1100"
                      />
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

                {tipo !== 'responsable' && (
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
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        itemName={itemToDelete?.nombre}
      />

    </div>
  );
}
