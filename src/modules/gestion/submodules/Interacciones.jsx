import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, Search, Filter, Calendar, 
  CheckCircle2, AlertCircle, X, FileText, RotateCcw, Edit, Trash2
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';

const TIPOS = [
  { val: 'interaccion', label: 'Nota', color: '#64748b' },
  { val: 'llamada',     label: 'Llamada', color: '#8b5cf6' },
  { val: 'reunion',     label: 'Reunión', color: '#f59e0b' },
  { val: 'muestreo',    label: 'Muestreo', color: '#2dd4bf' },
  { val: 'visita',      label: 'Visita', color: '#0d9488' },
  { val: 'compromiso',  label: 'Compromiso', color: '#10b981' }
];

export default function Interacciones() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    proveedorNombre: '',
    tipo: 'interaccion',
    fecha: new Date().toISOString().slice(0, 10),
    resumen: '',
    notas: '',
    proximaAccion: '',
    fechaProxima: ''
  });

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadData(signal) {
    setLoading(true);
    try {
      const res = await apiClient.get('/interacciones?limit=200', { signal });
      setItems(res.items || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar las interacciones.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/interacciones', form);
      addToast({ title: 'Éxito', message: 'Interacción registrada', type: 'success' });
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ title: 'Error', message: 'No se pudo guardar', type: 'error' });
    }
  };

  const filteredItems = items.filter(i => 
    (i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.resumen || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="interacciones-container">

      <div className="centros-filters am-mt-16">
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor o contenido..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn mx-btn-outline" onClick={loadData}><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Nueva Gestión
        </button>
      </div>

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Tipo</th>
                <th>Resumen de Gestión</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}><div className="mx-spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}>No hay registros.</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 600 }}>{new Date(item.fecha).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700 }}>{item.proveedorNombre}</td>
                    <td>
                      <span className="mx-badge" style={{ 
                        background: `${TIPOS.find(t => t.val === item.tipo)?.color}15`,
                        color: TIPOS.find(t => t.val === item.tipo)?.color,
                        fontWeight: 700
                      }}>
                        {TIPOS.find(t => t.val === item.tipo)?.label || 'Nota'}
                      </span>
                    </td>
                    <td>{item.resumen}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
                        <button className="mx-action-btn edit"><Edit size={14} /></button>
                        <button className="mx-action-btn delete"><Trash2 size={14} /></button>
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
          <div className="mx-modal" style={{ maxWidth: '550px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">Registrar Nueva Gestión</h3>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mx-modal-body">
                <div className="mx-field">
                  <label className="mx-label">Proveedor / Empresa</label>
                  <input className="mx-input" value={form.proveedorNombre} onChange={e => setForm({...form, proveedorNombre: e.target.value})} required />
                </div>
                <div className="mx-field-row" style={{ display: 'flex', gap: '16px' }}>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Tipo de Gestión</label>
                    <select className="mx-input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                      {TIPOS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Fecha</label>
                    <input type="date" className="mx-input" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                  </div>
                </div>
                <div className="mx-field">
                  <label className="mx-label">Resumen Ejecutivo</label>
                  <input className="mx-input" value={form.resumen} onChange={e => setForm({...form, resumen: e.target.value})} placeholder="Ej: Llamada de seguimiento de precio" required />
                </div>
                <div className="mx-field">
                  <label className="mx-label">Detalle y Compromisos</label>
                  <textarea className="mx-input" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows="4" />
                </div>
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Gestión</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
