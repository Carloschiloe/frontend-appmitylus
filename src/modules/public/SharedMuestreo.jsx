// src/modules/public/SharedMuestreo.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { 
  Loader, 
  AlertTriangle, 
  MapPin, 
  Image as ImageIcon,
  CheckCircle2,
  Info
} from 'lucide-react';

const SharedMuestreo = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    console.log('[PUBLIC ROUTE LOADED]', token);
    const fetchData = async () => {
      try {
        setLoading(true);
        // Usar la ruta pública que no requiere token de sesión
        const res = await apiClient.get(`/public/reportes/${token}`);
        setData(res);
      } catch (err) {
        console.error('Error fetching public report:', err);
        setError(err.response?.data?.message || 'No se pudo cargar el reporte. El enlace podría haber expirado o ser inválido.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Loader className="am-icon-spin" size={48} style={{ color: 'var(--color-primary)' }} />
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#64748b' }}>Cargando reporte compartido...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', maxWidth: '500px', textAlign: 'center' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Acceso Denegado</h2>
          <p style={{ color: '#64748b', lineHeight: 1.5 }}>{error}</p>
          <a href="https://mitynex.cl" style={{ display: 'inline-block', marginTop: '24px', padding: '10px 20px', background: 'var(--color-primary, #0d9488)', color: 'white', borderRadius: '6px', fontWeight: 600, textDecoration: 'none' }}>Ir a Mitynex</a>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-report-container" style={{ background: '#f1f5f9', minHeight: '100vh', padding: '40px 10px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header Público */}
        <div style={{ background: '#0f766e', color: 'white', padding: '20px 28px', borderRadius: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.025em' }}>Reporte de Muestreo MMPP</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', opacity: 0.85, fontWeight: 500 }}>Compartido vía Mitynex &mdash; Solo lectura</p>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-1px' }}>MITYNEX</div>
        </div>

        {/* Contenido del reporte */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', borderBottom: '2px solid #f8fafc', paddingBottom: '32px', flexWrap: 'wrap', gap: '24px' }}>
             <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Proveedor / Origen</div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f766e', margin: '0 0 8px 0', lineHeight: 1.1 }}>{data.proveedorNombre}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>
                  <MapPin size={18} color="var(--color-primary)" /> {data.centroCodigo} {data.linea && `· Línea ${data.linea}`}
                </div>
             </div>
             <div style={{ textAlign: 'right', minWidth: '200px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Fecha de Análisis</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{new Date(data.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '4px' }}>Responsable: {data.responsable || 'Equipo Calidad'}</div>
             </div>
          </div>

          {/* KPIs Principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '48px' }}>
            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>RENDIMIENTO %</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f766e' }}>{Number(data.rendimiento || 0).toFixed(2)}%</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Relación Carne/Peso Total</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>CALIBRE (U x KG)</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#1e293b' }}>{data.uxkg}</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Unidades por Kilogramo</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bcf0da', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a', marginBottom: '8px' }}>PROCESABLE %</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#16a34a' }}>{Number(data.total > 0 ? (data.procesable/data.total*100) : 0).toFixed(1)}%</div>
              <div style={{ fontSize: '0.85rem', color: '#16a34a', opacity: 0.7, marginTop: '4px' }}>Apto para Planta</div>
            </div>
          </div>

          {/* Evaluación de Calidad */}
          {data.evaluacionCriterios && data.evaluacionCriterios.length > 0 && (
            <div style={{ marginBottom: '48px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} color="#16a34a" /> Evaluación Técnica de Clasificación
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {data.evaluacionCriterios.map((c, idx) => (
                  <div key={idx} style={{ 
                    padding: '14px 18px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700,
                    background: c.cumple ? '#f0fdf4' : '#fef2f2',
                    color: c.cumple ? '#16a34a' : '#ef4444',
                    border: `1px solid ${c.cumple ? '#bcf0da' : '#fee2e2'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{c.cumple ? '✓' : '✕'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase' }}>{c.nombre}</div>
                      <div style={{ lineHeight: 1.2 }}>{c.razon}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidencias */}
          {(data.generalPhotos?.length > 0 || Object.keys(data.catDetails || {}).length > 0) && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ImageIcon size={20} color="#64748b" /> Registro de Evidencias Fotográficas
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                {data.generalPhotos?.map((p, idx) => (
                   <div key={idx} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px 0 rgba(0,0,0,0.05)' }}>
                      <img src={p.url} alt="Evidencia General" style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                      <div style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>VISTA GENERAL</div>
                   </div>
                ))}
                {Object.entries(data.catDetails || {}).map(([catId, detail]) => (
                  detail.photos?.map((p, idx) => (
                    <div key={`${catId}-${idx}`} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px 0 rgba(0,0,0,0.05)' }}>
                      <img src={p.url} alt={detail.name} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                      <div style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 800, color: '#0f766e', background: '#f0fdf4', borderTop: '1px solid #bcf0da', textTransform: 'uppercase' }}>{detail.name}</div>
                    </div>
                  ))
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ marginTop: '48px', textAlign: 'center', paddingBottom: '40px' }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} /> Link público generado por Mitynex para fines de trazabilidad.
            </div>
            <p style={{ margin: 0 }}>© {new Date().getFullYear()} Mitynex &mdash; Inteligencia Operativa MPP</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SharedMuestreo;
