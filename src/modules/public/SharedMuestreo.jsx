import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { generarHTMLReporte } from '../reportes/renderMuestreoReport';
import { Loader, AlertTriangle } from 'lucide-react';

const SharedMuestreo = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [html, setHtml] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get(`/public/reportes/${token}`);
        
        const reportHtml = generarHTMLReporte(data, {
          logoUrl: data.branding?.logo || '',
          empresaNom: data.branding?.nombre || 'Mitynex',
          isPublic: true, 
          maestros: { cats: [] } 
        });

        setHtml(reportHtml);
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
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#f1f5f9' }}>
      <iframe
        title="Reporte de Muestreo MMPP"
        srcDoc={html}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
      />
    </div>
  );
};

export default SharedMuestreo;
