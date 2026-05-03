import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  Download,
  MapPin,
  Building2,
  Ruler,
  ChevronDown
} from 'lucide-react';
import { getCentros } from '../../../api/api-centros';

export default function CentrosTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [comunaFilter, setComunaFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const result = await getCentros();
      setData(Array.isArray(result) ? result : (result.items || []));
    } catch (err) {
      console.error('Error cargando centros:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = useMemo(() => {
    return data.filter(c => {
      const matchSearch = searchTerm === '' || 
        c.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchComuna = comunaFilter === '' || c.comuna === comunaFilter;
      return matchSearch && matchComuna;
    });
  }, [data, searchTerm, comunaFilter]);

  const stats = useMemo(() => {
    const totalHect = filteredData.reduce((acc, curr) => acc + (Number(curr.hectareas) || 0), 0);
    const uniqueComunas = new Set(filteredData.map(c => c.comuna).filter(Boolean)).size;
    const totalTons = filteredData.reduce((acc, curr) => acc + (Number(curr.tonsMax) || 0), 0);
    return {
      count: filteredData.length,
      hectareas: totalHect.toLocaleString('es-CL', { minimumFractionDigits: 2 }),
      comunas: uniqueComunas,
      tonsMax: totalTons.toLocaleString('es-CL')
    };
  }, [filteredData]);

  const comunas = useMemo(() => {
    return [...new Set(data.map(c => c.comuna).filter(Boolean))].sort();
  }, [data]);

  return (
    <div className="centros-table-container">
      {/* KPIs */}
      <div className="centros-kpis">
        <article className="centros-kpi">
          <header className="centros-kpi-label"><Building2 size={16} /> Centros</header>
          <div className="centros-kpi-value">{stats.count}</div>
        </article>
        <article className="centros-kpi">
          <header className="centros-kpi-label"><Ruler size={16} /> Hectáreas</header>
          <div className="centros-kpi-value">{stats.hectareas} <small>ha</small></div>
        </article>
        <article className="centros-kpi">
          <header className="centros-kpi-label"><MapPin size={16} /> Comunas</header>
          <div className="centros-kpi-value">{stats.comunas}</div>
        </article>
      </div>

      {/* Filters */}
      <div className="centros-filters">
        <div className="centros-search-wrap">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor o código..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="mx-input" 
          style={{ width: 'auto' }}
          value={comunaFilter}
          onChange={(e) => setComunaFilter(e.target.value)}
        >
          <option value="">Todas las comunas</option>
          {comunas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button className="mx-btn mx-btn-outline" onClick={() => { setSearchTerm(''); setComunaFilter(''); }}>
          Limpiar
        </button>
        
        <div style={{ flex: 1 }}></div>
        
        <button className="mx-btn mx-btn-flat">
          <Download size={18} /> Exportar
        </button>
      </div>

      {/* Table */}
      <div className="centros-table-card">
        <div className="centros-table-wrap">
          <table className="centros-tbl">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Código Centro</th>
                <th>Área PSMB</th>
                <th>Estado Área</th>
                <th>Hectáreas</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="mx-spinner" style={{ margin: '0 auto 12px' }}></div>
                    <p>Cargando centros...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No se encontraron centros que coincidan con la búsqueda.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map(centro => (
                  <tr key={centro._id}>
                    <td>
                      <div className="centros-cell-main">
                        <span style={{ fontWeight: 600 }}>{centro.proveedor}</span>
                        <span className="centros-cell-sub">{centro.comuna}</span>
                      </div>
                    </td>
                    <td><code>{centro.code}</code></td>
                    <td>{centro.areaPSMB || '—'}</td>
                    <td>
                      <span className={`centros-badge-area ${centro.estadoAreaSernapesca === 'Abierta' ? 'verde' : 'gris'}`}>
                        {centro.estadoAreaSernapesca || 'Desconocido'}
                      </span>
                    </td>
                    <td>{Number(centro.hectareas || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver detalles"><Eye size={16} /></button>
                        <button className="mx-btn-icon" title="Editar"><Edit size={16} /></button>
                        <button className="mx-btn-icon" title="Eliminar"><Trash2 size={16} /></button>
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
