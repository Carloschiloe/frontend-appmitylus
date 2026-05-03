import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  MapPin, 
  Phone, 
  Handshake, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  ArrowLeft,
  Clock,
  LayoutGrid,
  List,
  FileText,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

const TYPE_ICONS = {
  registro:    { icon: User,         color: '#6366f1', label: 'Contacto' },
  visita:      { icon: MapPin,       color: '#f59e0b', label: 'Visita' },
  interaccion: { icon: Phone,        color: '#06b6d4', label: 'Interacción' },
  trato:       { icon: Handshake,    color: '#8b5cf6', label: 'Trato' },
  acordado:    { icon: CheckCircle2, color: '#10b981', label: 'Acuerdo' },
  compra:      { icon: CheckCircle2, color: '#059669', label: 'Compra' },
  perdido:     { icon: XCircle,      color: '#ef4444', label: 'Perdido' },
  muestreo:    { icon: FileText,     color: '#ec4899', label: 'Muestreo' }
};

export default function Historial() {
  const [data, setData] = useState({ contactos: [], visitas: [], interacciones: [], oportunidades: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const endpoints = ['/contactos', '/visitas', '/interacciones', '/oportunidades'];
      const results = await Promise.all(endpoints.map(url => apiClient.get(url)));
      
      setData({
        contactos: results[0].items || results[0].data || results[0] || [],
        visitas: results[1].items || results[1].data || results[1] || [],
        interacciones: results[2].items || results[2].data || results[2] || [],
        oportunidades: results[3].items || results[3].data || results[3] || []
      });
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  }

  // Agrupar datos por proveedor
  const providers = useMemo(() => {
    const map = new Map();

    const process = (items, type) => {
      items.forEach(item => {
        const name = item.proveedorNombre || item.proveedor || 'Sin Proveedor';
        const key = name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { name, events: [], lastActivity: null });
        }
        const p = map.get(key);
        const date = new Date(item.fecha || item.createdAt || item.updatedAt);
        p.events.push({ ...item, type, date });
        if (!p.lastActivity || date > p.lastActivity) p.lastActivity = date;
      });
    };

    process(data.contactos, 'registro');
    process(data.visitas, 'visita');
    process(data.interacciones, 'interaccion');
    process(data.oportunidades, 'trato');

    return Array.from(map.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [data]);

  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date) => {
    if (!date) return '—';
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  const getRelativeTime = (date) => {
    if (!date) return '';
    const diff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 30) return `Hace ${diff} días`;
    return `Hace ${Math.floor(diff / 30)} meses`;
  };

  if (selectedProvider) {
    const sortedEvents = [...selectedProvider.events].sort((a, b) => b.date - a.date);
    
    return (
      <div className="historial-expediente am-p-24">
        <button className="mx-btn mx-btn-outline am-mb-20" onClick={() => setSelectedProvider(null)}>
          <ArrowLeft size={18} /> Volver al listado
        </button>

        <header className="mx-hero" style={{ padding: '32px' }}>
          <div className="mx-hero-content">
            <p className="mx-eyebrow">Expediente de Proveedor</p>
            <h1>{selectedProvider.name}</h1>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <span className="mx-badge mx-badge-info">
                <History size={14} style={{ marginRight: '6px' }} /> {selectedProvider.events.length} Gestiones
              </span>
              <span className="mx-badge mx-badge-muted">
                <Clock size={14} style={{ marginRight: '6px' }} /> Última actividad: {formatDate(selectedProvider.lastActivity)}
              </span>
            </div>
          </div>
        </header>

        <div className="timeline-container am-mt-24" style={{ maxWidth: '900px', margin: '24px auto' }}>
          {sortedEvents.map((ev, i) => {
            const config = TYPE_ICONS[ev.type] || TYPE_ICONS.interaccion;
            return (
              <div key={i} className="timeline-item" style={{ 
                display: 'flex', gap: '20px', marginBottom: '32px', position: 'relative' 
              }}>
                {/* Linea vertical */}
                {i < sortedEvents.length - 1 && (
                  <div style={{ 
                    position: 'absolute', left: '20px', top: '40px', bottom: '-32px', 
                    width: '2px', background: '#e2e8f0' 
                  }}></div>
                )}

                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', background: config.color, 
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  flexShrink: 0, zIndex: 1, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                  <config.icon size={20} />
                </div>

                <div className="mx-table-card" style={{ flex: 1, padding: '20px', margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: config.color, textTransform: 'uppercase' }}>
                      {config.label}
                    </span>
                    <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                      {formatDate(ev.date)} ({getRelativeTime(ev.date)})
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>{ev.titulo || ev.tipo || 'Sin título'}</h4>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    {ev.notas || ev.observaciones || ev.resumen || 'Sin observaciones registradas.'}
                  </p>
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--color-text-subtle)' }}>
                    <User size={14} /> <span>Responsable: {ev.responsable || ev.contactoResponsable || '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="historial-page am-p-24">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Operaciones · Registro</p>
          <h1>Historial de Gestiones</h1>
          <p>Trazabilidad completa de auditorías y eventos del sistema por proveedor.</p>
        </div>
      </header>

      <div className="centros-filters" style={{ marginTop: '24px' }}>
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar historial por proveedor..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
            <LayoutGrid size={16} /> Grid
          </button>
          <button className={`mx-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
            <List size={16} /> Lista
          </button>
        </div>
      </div>

      <div className="am-mt-24">
        {loading ? (
          <div className="mx-state-placeholder">
            <div className="mx-spinner"></div>
            <p>Sincronizando historial operativo...</p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="mx-state-placeholder">
            <AlertCircle size={48} />
            <h3>No hay resultados</h3>
            <p>Prueba con otros términos de búsqueda.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredProviders.map((p, i) => (
              <div key={i} className="mx-table-card" style={{ 
                padding: '24px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--color-border)' 
              }} onClick={() => setSelectedProvider(p)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <History size={24} />
                  </div>
                  <span className={`mx-badge ${p.lastActivity && (new Date() - p.lastActivity < 30 * 86400000) ? 'mx-badge-success' : 'mx-badge-muted'}`}>
                    {getRelativeTime(p.lastActivity)}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>{p.name}</h3>
                <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {p.events.length} eventos registrados en el historial
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ver expediente completo</span>
                  <ChevronRight size={18} style={{ color: 'var(--color-primary)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-table-card">
            <div className="mx-table-wrap">
              <table className="mx-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th style={{ textAlign: 'center' }}>Gestiones</th>
                    <th>Última Actividad</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.map((p, i) => (
                    <tr key={i} onClick={() => setSelectedProvider(p)} style={{ cursor: 'pointer' }}>
                      <td><span style={{ fontWeight: 600 }}>{p.name}</span></td>
                      <td style={{ textAlign: 'center' }}>{p.events.length}</td>
                      <td>{formatDate(p.lastActivity)} ({getRelativeTime(p.lastActivity)})</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="mx-btn mx-btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Ver Detalle</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
