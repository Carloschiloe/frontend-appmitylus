import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  User, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink,
  Edit,
  Trash2,
  MoreVertical,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

export default function Directorio() {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [tab, setTab] = useState('proveedores'); // 'proveedores' | 'contactos'
  const [data, setData] = useState({ proveedores: [], contactos: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  // Update query string when search term changes, or viceversa
  useEffect(() => {
    if (searchTerm !== initialQuery) {
      if (searchTerm) {
        setSearchParams({ q: searchTerm }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchTerm, setSearchParams]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  async function loadData(signal) {
    setLoading(true);
    try {
      const [centrosRes, contactosRes] = await Promise.all([
        apiClient.get('/centros', { signal }),
        apiClient.get('/contactos', { signal })
      ]);

      // Extraer proveedores únicos de los centros
      const centrosList = Array.isArray(centrosRes) ? centrosRes : (centrosRes.items || []);
      const provMap = new Map();
      centrosList.forEach(c => {
        const name = c.proveedor || 'Sin nombre';
        const key = (c.proveedorKey || name).toLowerCase();
        if (!provMap.has(key)) {
          provMap.set(key, {
            nombre: name,
            key: c.proveedorKey || '',
            centros: 0,
            comuna: c.comuna || '—'
          });
        }
        provMap.get(key).centros++;
      });

      setData({
        proveedores: Array.from(provMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        contactos: Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || [])
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudo cargar el directorio.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const list = tab === 'proveedores' ? data.proveedores : data.contactos;
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(i => 
      (i.nombre || i.proveedorNombre || '').toLowerCase().includes(q) || 
      (i.email || '').toLowerCase().includes(q) ||
      (i.proveedorKey || '').toLowerCase().includes(q)
    );
  }, [tab, data, searchTerm]);

  return (
    <div className="directorio-container">

      <div className="centros-filters am-mt-16">
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${tab === 'proveedores' ? 'active' : ''}`} onClick={() => setTab('proveedores')}>
            <Building2 size={14} /> Empresas
          </button>
          <button className={`mx-toggle-btn ${tab === 'contactos' ? 'active' : ''}`} onClick={() => setTab('contactos')}>
            <User size={14} /> Contactos
          </button>
        </div>
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder={`Buscar ${tab}...`} 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn mx-btn-primary sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> {tab === 'proveedores' ? 'Empresa' : 'Contacto'}
        </button>
      </div>

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              {tab === 'proveedores' ? (
                <tr>
                  <th>Empresa / Razón Social</th>
                  <th>Key</th>
                  <th style={{ textAlign: 'center' }}>Centros</th>
                  <th>Ubicación Principal</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th>Nombre Contacto</th>
                  <th>Empresa</th>
                  <th>Correo / Teléfono</th>
                  <th>Cargo / Rol</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}><div className="mx-spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}>No se encontraron resultados.</td></tr>
              ) : tab === 'proveedores' ? (
                filteredItems.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-info-bg)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Building2 size={16} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                      </div>
                    </td>
                    <td><code style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{p.key}</code></td>
                    <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-info">{p.centros} centros</span></td>
                    <td style={{ color: 'var(--color-text-muted)' }}><MapPin size={12} style={{ marginRight: '4px' }} /> {p.comuna}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
                        <button className="mx-action-btn edit" title="Editar"><Edit size={14} /></button>
                        <button className="mx-action-btn" title="Ver Centros"><ExternalLink size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredItems.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.nombre || c.contactoNombre}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>ID: {c._id?.slice(-6)}</div>
                    </td>
                    <td>{c.proveedorNombre || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px' }}><Mail size={10} /> {c.email || '—'}</span>
                        <span style={{ fontSize: '12px' }}><Phone size={10} /> {c.telefono || '—'}</span>
                      </div>
                    </td>
                    <td><span className="mx-badge mx-badge-muted">{c.cargo || 'Contacto'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
                        <button className="mx-action-btn edit" title="Editar"><Edit size={14} /></button>
                        <button className="mx-action-btn delete" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">{tab === 'proveedores' ? 'Nueva Empresa' : 'Nuevo Contacto'}</h3>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const payload = Object.fromEntries(formData.entries());
              try {
                const endpoint = tab === 'proveedores' ? '/centros/proveedores' : '/contactos';
                await apiClient.post(endpoint, payload);
                setIsModalOpen(false);
                loadData();
              } catch (err) {
                console.error('Error al guardar:', err);
                addToast({ title: 'Error', message: 'No se pudo guardar. Intenta de nuevo.', type: 'error' });
              }
            }}>
              <div className="mx-modal-body">
                {tab === 'proveedores' ? (
                  <>
                    <div className="mx-field">
                      <label className="mx-label">Razón Social / Nombre Empresa</label>
                      <input name="nombre" className="mx-input" required placeholder="Ej: Pesquera Los Lagos S.A." />
                    </div>
                    <div className="mx-field">
                      <label className="mx-label">Código Interno (Key)</label>
                      <input name="proveedorKey" className="mx-input" required placeholder="Ej: LOSLAGOS" />
                    </div>
                    <div className="mx-field">
                      <label className="mx-label">Comuna / Ubicación Principal</label>
                      <input name="comuna" className="mx-input" placeholder="Ej: Puerto Montt" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-field">
                      <label className="mx-label">Nombre Completo</label>
                      <input name="nombre" className="mx-input" required placeholder="Ej: Juan Pérez" />
                    </div>
                    <div className="mx-field">
                      <label className="mx-label">Empresa Asociada</label>
                      <select name="proveedorId" className="mx-input">
                        <option value="">Seleccionar empresa...</option>
                        {data.proveedores.map(p => <option key={p.key} value={p.key}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div className="mx-field-row" style={{ display: 'flex', gap: '16px' }}>
                      <div className="mx-field" style={{ flex: 1 }}>
                        <label className="mx-label">Correo Electrónico</label>
                        <input name="email" type="email" className="mx-input" placeholder="juan@empresa.cl" />
                      </div>
                      <div className="mx-field" style={{ flex: 1 }}>
                        <label className="mx-label">Teléfono</label>
                        <input name="telefono" className="mx-input" placeholder="+56 9..." />
                      </div>
                    </div>
                    <div className="mx-field">
                      <label className="mx-label">Cargo / Función</label>
                      <input name="cargo" className="mx-input" placeholder="Ej: Jefe de Centro" />
                    </div>
                  </>
                )}
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar {tab === 'proveedores' ? 'Empresa' : 'Contacto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
