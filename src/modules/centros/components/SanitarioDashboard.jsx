import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';

export default function SanitarioDashboard() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [resAreas, resResumen] = await Promise.all([
        apiClient.get('/sanitario/areas'),
        apiClient.get('/sanitario/resumen')
      ]);
      setAreas(resAreas.items || []);
      setResumen(resResumen);
    } catch (err) {
      console.error('Error cargando datos sanitarios:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredAreas = useMemo(() => {
    return areas.filter(a => 
      a.areaPSMB?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.codigoArea?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [areas, searchTerm]);

  return (
    <div className="sanitario-dashboard">
      {/* Resumen Semáforo */}
      <div className="centros-kpis">
        <article className="centros-kpi" style={{ borderLeft: '4px solid #ef4444' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#ef4444" /> Bloqueadas (Rojo)</header>
          <div className="centros-kpi-value">{resumen?.rojo || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #f97316' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#f97316" /> Alerta (Naranja)</header>
          <div className="centros-kpi-value">{resumen?.naranja || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #22c55e' }}>
          <header className="centros-kpi-label"><CheckCircle2 size={16} color="#22c55e" /> OK (Verde)</header>
          <div className="centros-kpi-value">{resumen?.verde || 0}</div>
        </article>
      </div>

      <div className="centros-filters">
        <div className="centros-search-wrap" style={{ maxWidth: '400px' }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar área PSMB o código..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="mx-sync-badge">
          <Clock size={14} />
          <span>Sincronizado: {resumen?.ultimaSync ? new Date(resumen.ultimaSync).toLocaleString() : 'Nunca'}</span>
        </div>
        <button className="mx-btn mx-btn-outline" onClick={loadData}>
          <RefreshCw size={18} /> Actualizar mrSAT
        </button>
      </div>

      <div className="centros-table-card">
        <div className="centros-table-wrap">
          <table className="centros-tbl">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Código</th>
                <th>Área PSMB</th>
                <th>Estado Sernapesca</th>
                <th>Centros</th>
                <th>Última Sync</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="mx-spinner" style={{ margin: '0 auto 12px' }}></div>
                    <p>Sincronizando estados sanitarios...</p>
                  </td>
                </tr>
              ) : (
                filteredAreas.map(area => (
                  <tr key={area._id}>
                    <td>
                      <div className={`centros-badge-sanitario ${area.estado || 'gris'}`}>
                        <ShieldCheck size={14} />
                        {(area.estado || 'gris').toUpperCase()}
                      </div>
                    </td>
                    <td><code>{area.codigoArea || '—'}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{area.areaPSMB}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Región: {area.region}</div>
                    </td>
                    <td>{area.estadoSernapesca || 'Abierta'}</td>
                    <td>{area.centrosCount || 0}</td>
                    <td>{area.ultimaSyncMrsat ? new Date(area.ultimaSyncMrsat).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver historial"><Clock size={16} /></button>
                        <button className="mx-btn-icon" title="Ver en SISCOMEX"><ExternalLink size={16} /></button>
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
  );
}
