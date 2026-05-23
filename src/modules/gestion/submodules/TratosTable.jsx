import React from 'react';
import { CalendarCheck, Edit, Send, Trash2 } from 'lucide-react';
import {
  ESTADOS_TRATO,
  deriveCamionesXDia,
  derivePlazoDesdeCondiciones,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  formatDateOnlySafe,
  formatInteger,
  formatMoney,
  getUiEstadoFromApi,
} from './tratos.helpers';

export default function TratosTable({
  items,
  loading,
  onShare,
  onEdit,
  onDelete,
}) {
  return (
    <div className="mx-table-card am-mt-16">
      <div className="mx-table-wrap">
        <table className="mx-table">
          <thead>
            <tr>
              <th className="tratos-col-provider">Proveedor</th>
              <th className="tratos-col-tons">Tons</th>
              <th className="tratos-col-price">Precio Est.</th>
              <th>Inicio Cosecha</th>
              <th className="tratos-col-status">Estado</th>
              <th>Responsable</th>
              <th className="tratos-col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7">
                  <div className="mx-state-placeholder">
                    <div className="mx-spinner"></div>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="7">
                  <div className="mx-state-placeholder">No hay negociaciones activas.</div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const uiEstado = getUiEstadoFromApi(item.estado);
                const displayPrecio = item.precioAcordado ?? derivePrecioDesdeCondiciones(item.condiciones) ?? 0;
                const displayTons = item.tonsAcordadas || deriveVolumenDesdeCondiciones(item.condiciones) || 0;
                const displayPlazo = derivePlazoDesdeCondiciones(item.condiciones);
                const displayCamiones = item.camionesXDia || deriveCamionesXDia(item.condiciones);
                const displayInicioCosecha = item.vigenciaDesde || item.fechaCierre;

                return (
                  <tr key={item._id} className="tratos-row">
                    <td>
                      <div className="tratos-provider-name">{item.proveedorNombre}</div>
                      <div className="tratos-chip-row">
                        {displayPlazo && (
                          <span className="tratos-chip">Pago {formatInteger(displayPlazo)} dias</span>
                        )}
                        {displayCamiones && (
                          <span className="tratos-chip">Carga {formatInteger(displayCamiones)} cam/dia</span>
                        )}
                      </div>
                    </td>
                    <td className="tratos-metric-cell">
                      <div className="tratos-metric-primary">{formatInteger(displayTons)} t</div>
                      <div className="tratos-metric-label">Volumen</div>
                    </td>
                    <td className="tratos-metric-cell">
                      <div className="tratos-metric-strong">{formatMoney(displayPrecio)}</div>
                      <div className="tratos-metric-label">x kg</div>
                    </td>
                    <td className="tratos-date-cell">
                      <div className="tratos-date-main">{formatDateOnlySafe(displayInicioCosecha)}</div>
                      <div className="tratos-date-label">Probable</div>
                    </td>
                    <td>
                      <span className={`mx-badge mx-badge-${uiEstado === 'acordado' || uiEstado === 'cerrado_ok' ? 'success' : uiEstado === 'rechazado' ? 'danger' : 'info'}`}>
                        {ESTADOS_TRATO.find(e => e.val === uiEstado)?.label || item.estado}
                      </span>
                      {item.meta?.programaCosecha?.estado && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: '0.78rem', color: item.meta.programaCosecha.estado === 'activo' ? 'var(--color-success)' : item.meta.programaCosecha.estado === 'pausado' ? '#d97706' : 'var(--color-text-subtle)' }}>
                          <CalendarCheck size={11} />
                          Prog. {item.meta.programaCosecha.estado}
                        </div>
                      )}
                    </td>
                    <td className="tratos-date-cell" style={{ fontSize: '0.85rem' }}>
                      {item.responsableNombre || '-'}
                    </td>
                    <td className="tratos-actions-cell">
                      <div className="mx-table-actions-cell tratos-actions">
                        <button
                          className="mx-action-btn tratos-action-primary"
                          title="Compartir Trato"
                          onClick={() => onShare(item)}
                        >
                          <Send size={14} />
                        </button>
                        <button className="mx-action-btn edit" title="Editar Negociacion" onClick={() => onEdit(item)}>
                          <Edit size={14} />
                        </button>
                        <button className="mx-action-btn delete" title="Eliminar" onClick={() => onDelete(item)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
