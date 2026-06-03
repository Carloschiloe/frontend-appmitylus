import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Edit, Send, Trash2, X } from 'lucide-react';
import {
  ESTADOS_TRATO,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  formatDateOnlySafe,
  formatInteger,
  formatMoney,
  getUiEstadoFromApi,
} from './tratos.helpers';


function deduplicarCondiciones(condiciones = []) {
  const seen = new Map();
  for (const c of condiciones) {
    const key = String(c.condicionId || c.nombre || '').toLowerCase();
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}

function formatCondVal(c) {
  if (c.modoCondicion === 'normal') return 'Normal';
  if (c.modoCondicion === 'fijo') {
    return c.valor != null && c.valor !== '' ? `Fijo ${c.valor}%` : 'Fijo';
  }
  if (c.valor != null && c.valor !== '') return String(c.valor);
  return null;
}

const COND_BADGE = {
  acordado:  { label: 'Acordado',  cls: 'mx-badge-success' },
  rechazado: { label: 'Rechazado', cls: 'mx-badge-danger'  },
  pendiente: { label: 'Pendiente', cls: 'mx-badge-info'    },
};

export default function TratosTable({
  items,
  loading,
  onShare,
  onEdit,
  onDelete,
}) {
  const [condModal, setCondModal] = useState(null);

  return (
    <>
      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th className="tratos-col-provider">Proveedor</th>
                <th className="tratos-col-tons">Tons</th>
                <th className="tratos-col-price">Precio Est.</th>
                <th>Inicio Estimado</th>
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
                    <div className="mx-state-placeholder">
                      No hay negociaciones para los filtros seleccionados.
                      <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>Cambia el mes o usa <strong>Todos</strong> para ver todas.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const uiEstado = getUiEstadoFromApi(item.estado);
                  const displayPrecio = item.precioAcordado ?? derivePrecioDesdeCondiciones(item.condiciones) ?? 0;
                  const displayTons = item.tonsAcordadas || deriveVolumenDesdeCondiciones(item.condiciones) || 0;
                  const displayInicioCosecha = item.vigenciaDesde || item.fechaCierre;
                  const condiciones = item.condiciones || [];

                  return (
                    <tr key={item._id} className="tratos-row">
                      <td>
                        <div className="tratos-provider-name">{item.proveedorNombre}</div>
                        {item.centroCodigo && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginBottom: 4 }}>
                            {item.centroCodigo}
                          </div>
                        )}
                        {(item.contactoNombre || item.contactoTelefono) && (
                          <div className="tratos-chip-row">
                            {item.contactoNombre && (
                              <span className="tratos-chip">{item.contactoNombre}</span>
                            )}
                            {item.contactoTelefono && (
                              <span className="tratos-chip">{item.contactoTelefono}</span>
                            )}
                          </div>
                        )}
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
                        <div className="tratos-date-main">{formatDateOnlySafe(displayInicioCosecha) || '—'}</div>
                        <div className="tratos-date-label">Inicio probable</div>
                      </td>
                      <td>
                        <span className={`mx-badge mx-badge-${uiEstado === 'acordado' || uiEstado === 'cerrado_ok' ? 'success' : uiEstado === 'rechazado' ? 'danger' : 'info'}`}>
                          {ESTADOS_TRATO.find(e => e.val === uiEstado)?.label || item.estado}
                        </span>
                        {uiEstado === 'acordado' && deduplicarCondiciones(condiciones).some(c => c.estado !== 'acordado') && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                            ⚠ cond. incompleta
                          </div>
                        )}
                        {item.meta?.programaCosecha?.estado && (
                          <Link
                            to="/biomasa/programa"
                            title="Ver programa de cosecha"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginTop: 5,
                              fontSize: '0.78rem',
                              textDecoration: 'none',
                              color: item.meta.programaCosecha.estado === 'activo'
                                ? 'var(--color-success)'
                                : item.meta.programaCosecha.estado === 'pausado'
                                ? '#d97706'
                                : 'var(--color-text-subtle)',
                            }}
                          >
                            <CalendarCheck size={11} />
                            Programa {item.meta.programaCosecha.estado}
                          </Link>
                        )}
                      </td>
                      <td className="tratos-date-cell" style={{ fontSize: '0.85rem' }}>
                        {item.responsableNombre || '-'}
                      </td>
                      <td className="tratos-actions-cell">
                        <div className="mx-table-actions-cell tratos-actions">
                          {condiciones.length > 0 && (
                            <button
                              className="mx-action-btn"
                              title="Ver condiciones"
                              onClick={() => setCondModal(item)}
                            >
                              <ClipboardList size={14} />
                            </button>
                          )}
                          {uiEstado === 'acordado' && !item.meta?.programaCosecha?.estado && displayTons > 0 && !!item.proveedorNombre && (
                            <Link
                              to="/biomasa/programa"
                              className="mx-action-btn"
                              title="Programar cosecha"
                            >
                              <CalendarCheck size={14} />
                            </Link>
                          )}
                          <button
                            className="mx-action-btn tratos-action-primary"
                            title="Compartir Trato"
                            onClick={() => onShare(item)}
                          >
                            <Send size={14} />
                          </button>
                          <button className="mx-action-btn edit" title="Editar Trato" onClick={() => onEdit(item)}>
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

      {condModal && (
        <div className="tratos-cond-overlay" onClick={() => setCondModal(null)}>
          <div className="tratos-cond-modal" onClick={e => e.stopPropagation()}>
            <div className="tratos-cond-modal-header">
              <span className="tratos-cond-modal-title">{condModal.proveedorNombre}</span>
              <button className="tratos-cond-modal-close" onClick={() => setCondModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="tratos-cond-modal-body">
              {deduplicarCondiciones(condModal.condiciones).map((c, i) => {
                const meta = COND_BADGE[c.estado] || COND_BADGE.pendiente;
                return (
                  <div key={i} className="tratos-cond-modal-row">
                    <span className="tratos-cond-modal-name">{c.nombre}</span>
                    <div className="tratos-cond-modal-right">
                      {formatCondVal(c) && (
                        <span className="tratos-cond-modal-val">{formatCondVal(c)}</span>
                      )}
                      <span className={`mx-badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
