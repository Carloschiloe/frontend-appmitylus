import React from 'react';
import { Trash2 } from 'lucide-react';
import { getTipoLabel } from './interacciones.helpers';

export default function InteraccionesTable({
  items,
  loading,
  onDelete,
}) {
  return (
    <div className="mx-table-card am-mt-16">
      <div className="mx-table-wrap">
        <table className="mx-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Tipo</th>
              <th>Resumen de Gestion</th>
              <th className="interacciones-actions-head">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="interacciones-table-state">
                  <div className="mx-spinner interacciones-spinner"></div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="5" className="interacciones-table-state">No hay registros.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td className="interacciones-date-cell">{new Date(item.fecha).toLocaleDateString()}</td>
                  <td className="interacciones-provider-cell">{item.proveedorNombre}</td>
                  <td>
                    <span className={`mx-badge interacciones-type-badge is-${item.tipo || 'interaccion'}`}>
                      {getTipoLabel(item.tipo)}
                    </span>
                  </td>
                  <td>{item.resumen}</td>
                  <td className="interacciones-actions-cell">
                    <div className="mx-table-actions-cell interacciones-actions">
                      <button
                        type="button"
                        className="mx-action-btn delete"
                        onClick={() => onDelete(item)}
                        aria-label="Eliminar interaccion"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
