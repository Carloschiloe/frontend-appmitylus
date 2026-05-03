import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  MessageSquare, 
  MoreVertical, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronDown,
  Inbox,
  RotateCcw
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';

const LANES = [
  { id: 'overdue', label: 'Vencidos', color: '#ef4444' },
  { id: 'today',   label: 'Hoy',      color: 'var(--color-primary)' },
  { id: 'next',    label: 'Próximos', color: '#64748b' },
  { id: 'nodate',  label: 'Sin fecha', color: '#94a3b8' }
];

export default function Bandeja() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadBandeja();
  }, []);

  async function loadBandeja() {
    setLoading(true);
    try {
      const [interacciones, visitas] = await Promise.all([
        apiClient.get('/interacciones?limit=100'),
        apiClient.get('/visitas?limit=100')
      ]);

      const merged = [
        ...(interacciones.items || []).map(i => ({ ...i, type: 'interaccion' })),
        ...(visitas.items || []).map(v => ({ ...v, type: 'visita' }))
      ];

      setItems(merged);
    } catch (err) {
      console.error('Error cargando bandeja:', err);
    } finally {
      setLoading(false);
    }
  }

  const groupedItems = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const groups = { overdue: [], today: [], next: [], nodate: [] };

    items.forEach(item => {
      const dateStr = item.fechaProxima || item.fecha;
      if (!dateStr) {
        groups.nodate.push(item);
        return;
      }

      const itemDate = new Date(dateStr);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate < now) groups.overdue.push(item);
      else if (itemDate.getTime() === now.getTime()) groups.today.push(item);
      else groups.next.push(item);
    });

    return groups;
  }, [items]);

  return (
    <div className="bandeja-container">
      <div className="mx-table-head">
        <div className="mx-table-title">
          <div className="mx-header-icon"><Inbox size={20} /></div>
          <div>
            <h2>Bandeja de Operaciones</h2>
            <p>Seguimiento de compromisos, visitas y muestras en tiempo real.</p>
          </div>
        </div>
        
        <div className="mx-table-actions">
          <div className="mx-toggle-group">
            <button className={`mx-toggle-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>Todo</button>
            <button className={`mx-toggle-btn ${activeFilter === 'urgent' ? 'active' : ''}`} onClick={() => setActiveFilter('urgent')}>Urgente</button>
          </div>
          <button className="mx-btn mx-btn-outline" onClick={loadBandeja}><RotateCcw size={18} /></button>
        </div>
      </div>

      <div className="centros-filters am-mt-16">
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar en bandeja..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="mx-lanes am-mt-24">
        {LANES.map(lane => (
          <article key={lane.id} className="mx-lane">
            <h6 className="mx-lane-title" style={{ color: lane.color }}>
              {lane.label}
              <span className="mx-badge-sm" style={{ background: lane.color, color: '#fff' }}>
                {groupedItems[lane.id].length}
              </span>
            </h6>
            
            <ul className="mx-lane-list">
              {loading ? (
                <li style={{ textAlign: 'center', padding: '40px' }}><div className="mx-spinner" style={{ margin: '0 auto' }}></div></li>
              ) : groupedItems[lane.id].length === 0 ? (
                <li style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin pendientes</li>
              ) : (
                groupedItems[lane.id].map(item => (
                  <li key={item._id} className="mx-card" style={{ borderLeft: `4px solid ${lane.color}` }}>
                    <div className="mx-card-head">
                      <span className="mx-card-title">{item.proveedorNombre || item.contacto}</span>
                      <button className="mx-btn-icon"><MoreVertical size={14} /></button>
                    </div>
                    <div className="mx-card-sub" style={{ minHeight: '32px' }}>
                      {item.descripcion || item.motivo || 'Sin descripción'}
                    </div>
                    <div className="mx-card-meta">
                      <span className="mx-badge" style={{ fontSize: '10px', padding: '2px 8px' }}>
                        {item.type === 'visita' ? <Calendar size={10} style={{ marginRight: '4px' }} /> : <MessageSquare size={10} style={{ marginRight: '4px' }} />}
                        {item.type.toUpperCase()}
                      </span>
                      {item.fechaProxima && (
                        <span className="mx-badge" style={{ fontSize: '10px', padding: '2px 8px' }}>
                          <Clock size={10} style={{ marginRight: '4px' }} />
                          {new Date(item.fechaProxima).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
