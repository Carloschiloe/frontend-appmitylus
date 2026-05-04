import React, { useState, useEffect, useMemo } from 'react';
import { 
  Handshake, Search, Plus, Filter, 
  ChevronRight, ChevronLeft, Edit, Trash2, TrendingUp, X, RotateCcw
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { maestrosApi } from '../../../api/api-maestros';

const ESTADOS_TRATO = [
  { val: 'pendiente',     label: 'Pendiente' },
  { val: 'acordado',      label: 'Acordado' },
  { val: 'rechazado',     label: 'Rechazado' },
  { val: 'cerrado_ok',    label: 'Cerrado OK' }
];

export default function Tratos() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: maestrosCondiciones = [] } = useQuery({
    queryKey: ['maestros', 'condicion_negociacion', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('condicion_negociacion'),
  });

  const [form, setForm] = useState({
    proveedorNombre: '',
    tonsAcordadas: '',
    precioBase: '',
    fechaCierre: '',
    estado: 'pendiente',
    notas: '',
    condiciones: []
  });

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isModalOpen && !editingId && maestrosCondiciones.length > 0) {
      const initialCond = maestrosCondiciones.map(m => ({
        condicionId: m._id,
        nombre: m.nombre,
        tipoValor: m.tipoValor,
        estado: 'pendiente',
        valor: null
      }));
      setForm(prev => ({ ...prev, condiciones: initialCond }));
    }
  }, [isModalOpen, editingId, maestrosCondiciones]);

  async function loadData(signal) {
    setLoading(true);
    try {
      const res = await apiClient.get('/oportunidades?limit=200', { signal });
      setItems(res.items || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar los tratos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.put(`/oportunidades/${editingId}`, form);
        addToast({ title: 'Actualizado', message: 'Trato actualizado con éxito', type: 'success' });
      } else {
        await apiClient.post('/oportunidades', form);
        addToast({ title: 'Creado', message: 'Nuevo trato registrado', type: 'success' });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ title: 'Error', message: 'No se pudo guardar el trato', type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este trato?')) return;
    try {
      await apiClient.delete(`/oportunidades/${id}`);
      addToast({ title: 'Eliminado', message: 'Trato eliminado', type: 'success' });
      loadData();
    } catch (err) {
      addToast({ title: 'Error', message: 'No se pudo eliminar', type: 'error' });
    }
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      proveedorNombre: item.proveedorNombre || '',
      tonsAcordadas: item.tonsAcordadas || '',
      precioBase: item.precioBase || '',
      fechaCierre: item.fechaCierre ? item.fechaCierre.slice(0, 10) : '',
      estado: item.estado || 'pendiente',
      notas: item.notas || '',
      condiciones: item.condiciones || []
    });
    setIsModalOpen(true);
  };

  const toggleCondicionStatus = (idx, status) => {
    const nextCond = [...form.condiciones];
    nextCond[idx].estado = status;
    setForm({ ...form, condiciones: nextCond });
  };

  const filteredItems = items.filter(i => 
    (i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="tratos-container">

      <div className="centros-filters am-mt-16">
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn mx-btn-outline" onClick={loadData}><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary sm" onClick={() => { setEditingId(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Nueva Negociación
        </button>
      </div>

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th style={{ textAlign: 'center' }}>Tons</th>
                <th style={{ textAlign: 'center' }}>Precio Est.</th>
                <th>Cierre Previsto</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}><div className="mx-spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}>No hay negociaciones activas.</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 700 }}>{item.proveedorNombre}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{item.tonsAcordadas} t</td>
                    <td style={{ textAlign: 'center' }}>${Number(item.precioBase).toLocaleString()}</td>
                    <td>{item.fechaCierre ? new Date(item.fechaCierre).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`mx-badge mx-badge-${item.estado === 'acordado' ? 'success' : item.estado === 'rechazado' ? 'error' : 'info'}`}>
                        {ESTADOS_TRATO.find(e => e.val === item.estado)?.label || item.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
                        <button className="mx-action-btn edit" onClick={() => openEdit(item)}><Edit size={14} /></button>
                        <button className="mx-action-btn delete" onClick={() => handleDelete(item._id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '600px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">{editingId ? 'Editar Trato' : 'Nuevo Trato'}</h3>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mx-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="mx-field">
                  <label className="mx-label">Proveedor</label>
                  <input className="mx-input" value={form.proveedorNombre} onChange={e => setForm({...form, proveedorNombre: e.target.value})} required />
                </div>
                <div className="mx-field-row" style={{ display: 'flex', gap: '16px' }}>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Tons Acordadas</label>
                    <input type="number" className="mx-input" value={form.tonsAcordadas} onChange={e => setForm({...form, tonsAcordadas: e.target.value})} required />
                  </div>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Precio Est.</label>
                    <input type="number" className="mx-input" value={form.precioBase} onChange={e => setForm({...form, precioBase: e.target.value})} />
                  </div>
                </div>
                
                <div className="am-mt-16">
                  <label className="mx-label am-mb-8" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                    Condiciones de Negociación (Maestros)
                  </label>
                  <div className="mx-conditions-checklist" style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    {form.condiciones.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px' }}>No hay condiciones configuradas en maestros.</p>
                    ) : (
                      form.condiciones.map((c, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: idx < form.condiciones.length - 1 ? '1px solid #e2e8f0' : 'none', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, flex: '1 1 120px' }}>{c.nombre}</span>
                          
                          {/* Modo (Normal/Fijo) para porcentajes como Descuento Planta */}
                          {c.tipoValor === 'porcentaje' && (
                            <select 
                              className="mx-input" 
                              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              value={c.modoCondicion || 'normal'}
                              onChange={(e) => {
                                const nextCond = [...form.condiciones];
                                nextCond[idx].modoCondicion = e.target.value;
                                if (e.target.value === 'normal') nextCond[idx].valor = '';
                                setForm({ ...form, condiciones: nextCond });
                              }}
                            >
                              <option value="normal">Normal</option>
                              <option value="fijo">Fijo</option>
                            </select>
                          )}

                          {/* Campo de Valor */}
                          {!(c.tipoValor === 'porcentaje' && (!c.modoCondicion || c.modoCondicion === 'normal')) && (
                            <input 
                              type={['numero', 'moneda', 'porcentaje', 'dias'].includes(c.tipoValor) ? 'number' : 'text'}
                              className="mx-input"
                              style={{ width: '100px', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              placeholder={c.tipoValor === 'moneda' ? '$ Valor' : c.tipoValor === 'porcentaje' ? '% Valor' : 'Valor'}
                              value={c.valor || ''}
                              onChange={(e) => {
                                const nextCond = [...form.condiciones];
                                nextCond[idx].valor = e.target.value;
                                setForm({ ...form, condiciones: nextCond });
                              }}
                            />
                          )}

                          {/* Selector de Estado */}
                          <select 
                            className="mx-input" 
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                            value={c.estado}
                            onChange={(e) => toggleCondicionStatus(idx, e.target.value)}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="acordado">Acordado</option>
                            <option value="rechazado">Rechazado</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mx-field-row am-mt-16" style={{ display: 'flex', gap: '16px' }}>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Fecha Cierre</label>
                    <input type="date" className="mx-input" value={form.fechaCierre} onChange={e => setForm({...form, fechaCierre: e.target.value})} />
                  </div>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Estado General</label>
                    <select className="mx-input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                      {ESTADOS_TRATO.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mx-field">
                  <label className="mx-label">Notas</label>
                  <textarea className="mx-input" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows="3" />
                </div>
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Negociación</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
