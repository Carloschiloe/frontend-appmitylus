import React, { useMemo, useEffect } from 'react';
import { X } from 'lucide-react';

export default function DistribucionRechazoModal({ isOpen, item, onClose, maestros }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const distribucion = useMemo(() => {
    if (!item || !maestros?.cats) return [];

    const result = [];
    const catsMap = item.cats || {};
    const detailsMap = item.catDetails || {};

    const isRechazo = (catId) => {
      const cat = maestros.cats.find(c => String(c._id) === String(catId));
      if (cat?.tipoCat === 'rechazo') return true;
      if (detailsMap[catId]?.tipo === 'rechazo') return true;
      return false;
    };

    const getNombre = (catId) => {
      if (detailsMap[catId]?.nombre) return detailsMap[catId].nombre;
      const cat = maestros.cats.find(c => String(c._id) === String(catId));
      return cat?.nombre || 'Categoría Desconocida';
    };

    const total = item.total || 1;

    Object.entries(catsMap).forEach(([catId, value]) => {
      if (value > 0 && isRechazo(catId)) {
        result.push({
          nombre: getNombre(catId),
          porcentaje: (value / total) * 100
        });
      }
    });

    // Ordenar de mayor a menor porcentaje
    result.sort((a, b) => b.porcentaje - a.porcentaje);
    
    return result;
  }, [item, maestros]);

  if (!isOpen || !item) return null;

  const rechazoTotal = item.total > 0 ? (item.rechazos / item.total * 100) : 0;
  
  // Suma de componentes para comparar (puede haber diferencia por redondeo, el usuario pide mostrar reales y suma)
  const sumaComponentes = distribucion.reduce((acc, curr) => acc + curr.porcentaje, 0);

  return (
    <div className="mu-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="mu-main-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '450px', borderRadius: '16px', margin: 'auto' }}
      >
        <div className="mu-modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <div className="mu-modal-title-row">
            <h3 className="mu-modal-title" style={{ fontWeight: 600, fontSize: '1.1rem' }}>Distribución del rechazo</h3>
            <button className="mx-btn mx-btn-icon mu-modal-close" onClick={onClose} style={{ marginLeft: 'auto' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mu-modal-body" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '24px', fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Proveedor:</strong> <span>{item.proveedorNombre || item.proveedor}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Centro:</strong> <span>{item.centroCodigo || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Fecha:</strong> <span>{new Date(item.fecha).toLocaleDateString('es-CL')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <strong>Rechazo total:</strong> 
              <span style={{ color: rechazoTotal > 5 ? '#dc2626' : 'inherit', fontWeight: 'bold', fontSize: '1rem' }}>
                {rechazoTotal.toFixed(1)}%
              </span>
            </div>
          </div>

          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>
            Detalle
          </h4>

          {distribucion.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Este muestreo no tiene distribución de rechazo registrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {distribucion.map((dist, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                  <span style={{ color: '#334155' }}>{dist.nombre}</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{dist.porcentaje.toFixed(1)}%</span>
                </div>
              ))}
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '12px', 
                paddingTop: '12px', 
                borderTop: '2px solid #e2e8f0',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: '#0f172a'
              }}>
                <span>TOTAL</span>
                <span>{sumaComponentes.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
