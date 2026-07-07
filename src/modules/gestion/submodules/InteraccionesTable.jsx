import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { getTipoLabel } from './interacciones.helpers';

export default function InteraccionesTable({
  items,
  loading,
  onEdit,
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
                  <td className="interacciones-date-cell" data-label="Fecha">{new Date(item.fecha).toLocaleDateString()}</td>
                  <td className="interacciones-provider-cell" data-label="Proveedor">{item.proveedorNombre}</td>
                  <td data-label="Tipo">
                    <span className={`mx-badge interacciones-type-badge is-${item.tipo || 'interaccion'}`}>
                      {getTipoLabel(item.tipo)}
                    </span>
                  </td>
                  <td data-label="Resumen de Gestion">{item.resumen}</td>
                  <td className="interacciones-actions-cell" data-label="Acciones">
                    <div className="mx-table-actions-cell interacciones-actions">
                      <button
                        type="button"
                        className="mx-action-btn edit"
                        onClick={() => onEdit(item)}
                        aria-label="Editar gestión"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="mx-action-btn delete"
                        onClick={() => onDelete(item)}
                        aria-label="Eliminar gestión"
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
