import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Download, 
  Table, 
  ClipboardList, 
  Users, 
  CheckSquare,
  X,
  Award,
  MinusCircle,
  AlertTriangle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maestrosApi } from '../../api/api-maestros';
import { useToast } from '../../context/ToastContext';
import './maestros.css';

const TIPO_COLORES = {
  'Entero':       '#0d9488',
  'Media Concha': '#2563eb',
  'Carne':        '#d97706',
};

const PARAMS_FIJOS = [
  { campo: 'uxkg',        nombre: 'Calibre',      unidad: 'un/kg' },
  { campo: 'rendimiento', nombre: 'Rendimiento',  unidad: '%' },
  { campo: 'procesable',  nombre: '% Procesable', unidad: '%' },
  { campo: 'rechazos',    nombre: '% Rechazos',   unidad: '%' },
  { campo: 'defectos',    nombre: '% Defectos',   unidad: '%' },
];

export default function Maestros() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [tipo, setTipo] = useState('categoria-muestreo');
  
  // React Query: Data Fetching
  const { data: maestros = [], isLoading: loading } = useQuery({
    queryKey: ['maestros', tipo],
    queryFn: () => maestrosApi.getMaestros(tipo),
  });

  const { data: catMuestreo = [] } = useQuery({
    queryKey: ['maestros', 'categoria-muestreo', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('categoria-muestreo'),
    enabled: tipo === 'clasificacion_producto', // Solo cargar cuando sea necesario
  });

  // React Query: Mutaciones
  const saveMutation = useMutation({
    mutationFn: (body) => editingItem 
      ? maestrosApi.actualizarMaestro(editingItem._id, body)
      : maestrosApi.crearMaestro(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maestros'] });
      setIsModalOpen(false);
    },
    onError: (err) => { console.error('Error guardando maestro:', err); addToast({ title: 'Error', message: 'No se pudo guardar el maestro.', type: 'error' }); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => maestrosApi.eliminarMaestro(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maestros'] });
      setIsConfirmDeleteOpen(false);
    },
    onError: (err) => { console.error('Error eliminando maestro:', err); addToast({ title: 'Error', message: 'No se pudo eliminar el maestro.', type: 'error' }); }
  });
  
  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [modalParams, setModalParams] = useState([]);

  const TIPOS = [
    { id: 'categoria-muestreo', label: 'Clasificación Producto', icon: Table },
    { id: 'clasificacion_producto', label: 'Tipos de Producto', icon: Award },
    { id: 'proximo-paso',       label: 'Próximos Pasos',        icon: CheckSquare },
    { id: 'condicion_negociacion', label: 'Acuerdo de Tratos',   icon: ClipboardList },
    { id: 'responsable',        label: 'Responsables',          icon: Users }
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
    
    if (tipo === 'clasificacion_producto') {
      body.parametros = modalParams;
      body.prioridad = { 'Entero': 1, 'Media Concha': 2, 'Carne': 3 }[body.tipoPrincipal] || 99;
    }

    if (body.opcionesRaw) {
      body.opciones = body.opcionesRaw.split('\n').map(s => s.trim()).filter(Boolean);
      delete body.opcionesRaw;
    }

    saveMutation.mutate(body);
  };

  const paramOptions = [
    ...PARAMS_FIJOS,
    ...catMuestreo.map(c => ({ campo: 'cats', campoId: c._id, nombre: c.nombre, unidad: '%' }))
  ];

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Configuración · Parámetros</p>
          <h1>Maestros del Sistema</h1>
          <p>Administración dinámica de categorías y parámetros operativos.</p>
        </div>
        <div className="mx-hero-actions">
          <button className="mx-btn mx-btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}><Download size={18} /> Exportar</button>
          <button className="mx-btn mx-btn-primary" onClick={handleNuevo}>
            <Plus size={18} /> Nuevo Registro
          </button>
        </div>
      </header>

      <div className="mx-content-frame">

        <div className="centros-filters maestros-toolbar">
          <div className="mx-toggle-group maestros-toggle-wrap">
            {TIPOS.map(t => (
              <button 
                key={t.id}
                className={`mx-toggle-btn maestros-toggle-btn ${tipo === t.id ? 'active' : ''}`}
                onClick={() => setTipo(t.id)}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <div className="centros-search-wrap maestros-search-box">
            <Search size={18} />
            <input type="text" className="centros-search" placeholder="Filtrar registros..." />
          </div>
        </div>

        <div className="mx-table-card am-mt-16">
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  <th className="maestros-table-head-nombre">Nombre / Valor</th>
                  {tipo === 'categoria-muestreo' && <th>Tipo Categoría</th>}
                  {tipo === 'clasificacion_producto' && <th>Configuración Mín/Máx</th>}
                  {tipo === 'condicion_negociacion' && <th>Tipo Valor</th>}
                  {tipo !== 'responsable' && <th className="maestros-table-head-orden">Orden</th>}
                  <th className="maestros-table-head-estado">Estado</th>
                  <th className="maestros-table-head-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="10" className="maestros-spinner-state"><div className="mx-spinner maestros-spinner-center"></div></td></tr>
                ) : maestros.length === 0 ? (
                  <tr><td colSpan="10" className="maestros-empty-state">No hay registros.</td></tr>
                ) : (
                  maestros.map(item => (
                    <tr key={item._id}>
                      <td><span className="maestros-item-nombre">{item.nombre}</span></td>
                      {tipo === 'categoria-muestreo' && (
                        <td>
                          <span className={`mx-badge ${
                            item.tipoCat === 'procesable' ? 'mx-badge-success' : 
                            item.tipoCat === 'rechazo' ? 'mx-badge-error' : 
                            item.tipoCat === 'defecto' ? 'mx-badge-info' : 'mx-badge-muted'
                          }`}>
                            {item.tipoCat?.toUpperCase()}
                          </span>
                        </td>
                      )}
                      {tipo === 'clasificacion_producto' && (
                        <td>
                          <div className="maestros-params-container">
                            {item.parametros?.map((p, i) => (
                              <span key={i} className="maestros-param-tag">
                                <strong>{p.nombre}</strong>: {p.min ?? '∞'}–{p.max ?? '∞'}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      {tipo === 'condicion_negociacion' && <td><code>{item.tipoValor}</code></td>}
                      {tipo !== 'responsable' && <td className="maestros-item-orden">{item.orden ?? 0}</td>}
                      <td><span className={`mx-badge ${item.activo ? 'mx-badge-success' : 'mx-badge-muted'}`}>{item.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
                      <td className="maestros-item-acciones">
                        <div className="mx-table-actions-cell maestros-actions-wrapper">
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

      {/* Modal Edición Dinámico */}
      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: tipo === 'clasificacion_producto' ? '650px' : '500px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">{editingItem ? 'Editar' : 'Nuevo'} Registro</h3>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} key={editingItem?._id || 'nuevo'}>
              <div className="mx-modal-body">
                <div className="mx-field">
                  <label className="mx-label">Nombre / Etiqueta</label>
                  <input name="nombre" className="mx-input" defaultValue={editingItem?.nombre} required />
                </div>

                {tipo === 'categoria-muestreo' && (
                  <div className="mx-field">
                    <label className="mx-label">Tipo Categoría</label>
                    <select name="tipoCat" className="mx-input" defaultValue={editingItem?.tipoCat || 'procesable'}>
                      <option value="procesable">Procesable</option>
                      <option value="rechazo">Rechazo</option>
                      <option value="defecto">Defecto</option>
                    </select>
                  </div>
                )}

                {tipo === 'clasificacion_producto' && (
                  <>
                    <div className="mx-field">
                      <label className="mx-label">Tipo Principal</label>
                      <select name="tipoPrincipal" className="mx-input" defaultValue={editingItem?.tipoPrincipal || 'Entero'}>
                        <option value="Entero">Entero</option>
                        <option value="Media Concha">Media Concha</option>
                        <option value="Carne">Carne</option>
                      </select>
                    </div>
                    <div className="mx-field">
                      <label className="mx-label maestros-modal-param-header">
                        Rangos de Calidad
                        <select 
                          className="mx-input maestros-modal-param-select" 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const p = paramOptions.find(o => (o.campoId || o.campo) === val);
                            if (p) {
                              if (!modalParams.some(mp => mp.campo === p.campo && mp.campoId === p.campoId)) {
                                setModalParams([...modalParams, { ...p, min: '', max: '' }]);
                              }
                            }
                            e.target.value = '';
                          }}
                        >
                          <option value="">+ Añadir Parámetro</option>
                          {paramOptions.map(o => (
                            <option key={o.campoId || o.campo} value={o.campoId || o.campo}>{o.nombre}</option>
                          ))}
                        </select>
                      </label>
                      <div className="maestros-modal-params-list">
                        {modalParams.map((p, idx) => (
                          <div key={idx} className="maestros-modal-param-row">
                            <span className="maestros-modal-param-name">{p.nombre}</span>
                            <input type="number" step="0.1" placeholder="Mín" className="mx-input maestros-modal-param-input" value={p.min ?? ''} 
                              onChange={(e) => { const next = [...modalParams]; next[idx].min = e.target.value === '' ? null : Number(e.target.value); setModalParams(next); }} />
                            <input type="number" step="0.1" placeholder="Máx" className="mx-input maestros-modal-param-input" value={p.max ?? ''}
                              onChange={(e) => { const next = [...modalParams]; next[idx].max = e.target.value === '' ? null : Number(e.target.value); setModalParams(next); }} />
                            <button type="button" className="mx-btn-icon" onClick={() => setModalParams(modalParams.filter((_, i) => i !== idx))}><MinusCircle size={14} className="maestros-modal-param-delete" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tipo === 'condicion_negociacion' && (
                  <>
                    <div className="mx-field">
                      <label className="mx-label">Tipo Valor</label>
                      <select name="tipoValor" className="mx-input" defaultValue={editingItem?.tipoValor || 'texto'}>
                        <option value="moneda">Moneda ($)</option>
                        <option value="porcentaje">Porcentaje (%)</option>
                        <option value="dias">Días</option>
                        <option value="numero">Número</option>
                        <option value="opciones">Lista de Opciones</option>
                        <option value="texto">Texto</option>
                      </select>
                    </div>
                    <div className="mx-field maestros-modal-checkbox-row">
                      <input type="checkbox" name="requerido" defaultChecked={editingItem?.requerido} />
                      <label className="mx-label maestros-modal-label-mb0">Campo Requerido</label>
                    </div>
                  </>
                )}

                {tipo !== 'responsable' && (
                  <div className="mx-field">
                    <label className="mx-label">Orden</label>
                    <input name="orden" type="number" className="mx-input" defaultValue={editingItem?.orden || 0} />
                  </div>
                )}

                <div className="mx-field maestros-modal-checkbox-row maestros-modal-checkbox-margin">
                  <input type="checkbox" name="activo" defaultChecked={editingItem ? editingItem.activo : true} />
                  <label className="mx-label maestros-modal-label-mb0">Registro Activo</label>
                </div>
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {isConfirmDeleteOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '400px' }}>
            <div className="maestros-delete-modal-body">
              <AlertTriangle size={48} className="maestros-delete-modal-icon" />
              <h3 className="maestros-delete-modal-title">¿Eliminar registro?</h3>
              <p className="maestros-delete-modal-desc">Estás a punto de borrar &quot;{itemToDelete?.nombre}&quot;. Esta acción es irreversible.</p>
            </div>
            <div className="mx-modal-foot">
              <button className="mx-btn mx-btn-outline maestros-delete-modal-btn" onClick={() => setIsConfirmDeleteOpen(false)}>Cancelar</button>
              <button className="mx-btn maestros-delete-modal-btn-confirm" onClick={handleDelete}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
