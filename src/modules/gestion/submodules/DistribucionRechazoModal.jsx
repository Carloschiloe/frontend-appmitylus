import React, { useMemo, useEffect } from 'react';
import { X } from 'lucide-react';

export default function DistribucionRechazoModal({ isOpen, item, onClose, maestros }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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

    result.sort((a, b) => b.porcentaje - a.porcentaje);
    return result;
  }, [item, maestros]);

  if (!isOpen || !item) return null;

  const rechazoTotal = item.total > 0 ? (item.rechazos / item.total * 100) : 0;
  const sumaComponentes = distribucion.reduce((acc, curr) => acc + curr.porcentaje, 0);

  return (
    <>
      {/* Estilos en línea para el modal responsive */}
      <style>{`
        .drm-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }
        .drm-card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 20px 60px -10px rgba(0,0,0,0.3);
          width: 100%;
          max-width: 400px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: drm-in 0.18s ease-out;
        }
        @keyframes drm-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .drm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px 12px;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }
        .drm-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .drm-close {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
          padding: 0;
        }
        .drm-close:hover {
          background: #fee2e2;
          color: #dc2626;
        }
        .drm-body {
          padding: 16px 18px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .drm-meta {
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 0.82rem;
          color: #475569;
          background: #f8fafc;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .drm-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .drm-meta-label {
          font-weight: 500;
          color: #94a3b8;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          flex-shrink: 0;
        }
        .drm-meta-value {
          font-weight: 600;
          color: #0f172a;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
          font-size: 0.82rem;
        }
        .drm-meta-value.danger {
          color: #dc2626;
        }
        .drm-section-label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }
        .drm-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .drm-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 0.85rem;
        }
        .drm-item-name {
          color: #334155;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .drm-item-bar-wrap {
          flex: 0 0 80px;
          height: 4px;
          background: #f1f5f9;
          border-radius: 4px;
          overflow: hidden;
        }
        .drm-item-bar {
          height: 100%;
          background: #ef4444;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .drm-item-pct {
          font-weight: 600;
          color: #0f172a;
          flex-shrink: 0;
          min-width: 38px;
          text-align: right;
          font-size: 0.85rem;
        }
        .drm-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 2px solid #e2e8f0;
          padding-top: 10px;
          margin-top: 2px;
          font-weight: 700;
          font-size: 0.9rem;
          color: #0f172a;
        }
        .drm-empty {
          text-align: center;
          padding: 16px 0 8px;
          color: #94a3b8;
          font-size: 0.85rem;
          font-style: italic;
        }
        @media (max-width: 480px) {
          .drm-overlay {
            padding: 12px;
            align-items: flex-end;
          }
          .drm-card {
            max-height: 75vh;
            border-radius: 20px 20px 12px 12px;
          }
        }
      `}</style>

      <div className="drm-overlay" onClick={onClose}>
        <div className="drm-card" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="drm-header">
            <h3 className="drm-title">Distribución del rechazo</h3>
            <button className="drm-close" onClick={onClose} title="Cerrar">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="drm-body">

            {/* Contexto */}
            <div className="drm-meta">
              <div className="drm-meta-row">
                <span className="drm-meta-label">Proveedor</span>
                <span className="drm-meta-value" title={item.proveedorNombre || item.proveedor}>
                  {item.proveedorNombre || item.proveedor || '-'}
                </span>
              </div>
              <div className="drm-meta-row">
                <span className="drm-meta-label">Centro</span>
                <span className="drm-meta-value">{item.centroCodigo || '-'}</span>
              </div>
              <div className="drm-meta-row">
                <span className="drm-meta-label">Fecha</span>
                <span className="drm-meta-value">{new Date(item.fecha).toLocaleDateString('es-CL')}</span>
              </div>
              <div className="drm-meta-row" style={{ marginTop: 2 }}>
                <span className="drm-meta-label">Rechazo total</span>
                <span className={`drm-meta-value ${rechazoTotal > 5 ? 'danger' : ''}`} style={{ fontSize: '0.95rem' }}>
                  {rechazoTotal.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Detalle */}
            <div>
              <p className="drm-section-label">Detalle</p>
              {distribucion.length === 0 ? (
                <p className="drm-empty">Este muestreo no tiene distribución de rechazo registrada.</p>
              ) : (
                <>
                  <div className="drm-list" style={{ marginTop: 10 }}>
                    {distribucion.map((dist, idx) => (
                      <div key={idx} className="drm-item">
                        <span className="drm-item-name" title={dist.nombre}>{dist.nombre}</span>
                        <div className="drm-item-bar-wrap">
                          <div
                            className="drm-item-bar"
                            style={{ width: `${Math.min((dist.porcentaje / rechazoTotal) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="drm-item-pct">{dist.porcentaje.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="drm-total">
                    <span>TOTAL</span>
                    <span>{sumaComponentes.toFixed(1)}%</span>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
