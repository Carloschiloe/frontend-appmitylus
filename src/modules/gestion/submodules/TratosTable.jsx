import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarPlus, ClipboardList, Edit, Handshake, Send, Trash2, X, FileText, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { upsertCondicion } from '../../../api/api-oportunidades';
import {
  ESTADOS_TRATO,
  calcularFechaTerminoEstimadaTrato,
  deriveCamionesXDia,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  formatDateOnlySafe,
  formatInteger,
  formatMoney,
  getUiEstadoFromApi,
  normalizeText,
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
  const isPlanta = /descuento.*planta|planta/.test(normalizeText(c.nombre));
  if (isPlanta) {
    if (c.modoCondicion === 'fijo' || (c.valor != null && c.valor !== '')) {
      return (c.valor != null && c.valor !== '') ? `Fijo ${c.valor}%` : 'Fijo';
    }
    return 'Normal';
  }
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

/** Menú desplegable ⋯ para acciones secundarias */
function ActionsMenu({ item, onShare, onEdit, onDelete, onViewReport, onViewCondiciones, hasCondiciones }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="tratos-menu-wrap" ref={ref} data-tour="tratos-acciones">
      <button
        className="mx-action-btn tratos-menu-trigger"
        title="Más acciones"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="tratos-menu-dropdown">
          <button
            className="tratos-menu-item"
            onClick={() => { onViewReport(item); setOpen(false); }}
          >
            <FileText size={13} /> Ver informe
          </button>
          {hasCondiciones && (
            <button
              className="tratos-menu-item"
              onClick={() => { onViewCondiciones(item); setOpen(false); }}
            >
              <ClipboardList size={13} /> Ver condiciones
            </button>
          )}
          <div className="tratos-menu-separator" />
          <button
            className="tratos-menu-item"
            onClick={() => { onEdit(item); setOpen(false); }}
          >
            <Edit size={13} /> Editar
          </button>
          <button
            className="tratos-menu-item"
            onClick={() => { onShare(item); setOpen(false); }}
          >
            <Send size={13} /> Compartir
          </button>
          <div className="tratos-menu-separator" />
          <button
            className="tratos-menu-item tratos-menu-item-danger"
            onClick={() => { onDelete(item); setOpen(false); }}
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

export default function TratosTable({
  items,
  loading,
  onShare,
  onEdit,
  onDelete,
  onViewReport,
  onCrearPrograma,
}) {
  const [condModal, setCondModal] = useState(null);
  const [savingCondId, setSavingCondId] = useState(null);

  const handleMarcarAcordado = useCallback(async (c) => {
    if (!condModal?._id) return;
    const key = c._id || c.condicionId || c.nombre;
    setSavingCondId(key);
    try {
      const res = await upsertCondicion(condModal._id, {
        ...(c._id ? { _id: c._id } : {}),
        ...(c.condicionId ? { condicionId: c.condicionId } : {}),
        nombre: c.nombre,
        estado: 'acordado',
      });
      if (res?.item) {
        setCondModal(prev => prev ? {
          ...prev,
          condiciones: prev.condiciones.map(x =>
            (x._id && x._id === c._id) || x.nombre === c.nombre
              ? { ...x, estado: 'acordado' }
              : x
          ),
        } : null);
      }
    } catch { /* ignore */ } finally {
      setSavingCondId(null);
    }
  }, [condModal]);

  return (
    <>
      <div className="mx-table-card am-mt-16 tratos-table-card-override" data-tour="tratos-tabla">
        <div className="mx-table-wrap tratos-table-wrap-override">
          <table className="mx-table">
            <thead>
              <tr>
                <th className="tratos-col-provider">Proveedor</th>
                <th className="tratos-col-centro">Centro</th>
                <th className="tratos-col-tons">Tons</th>
                <th className="tratos-col-price">Precio Pactado</th>
                <th>Fechas estimadas</th>
                <th className="tratos-col-status">Estado</th>
                <th>Responsable</th>
                <th className="tratos-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="tratos-skel-row">
                    <td><div className="skel skel-md" /><div className="skel skel-xs" style={{ marginTop: 5 }} /></td>
                    <td><div className="skel skel-sm" /></td>
                    <td><div className="skel skel-sm" /></td>
                    <td><div className="skel skel-sm" /><div className="skel skel-xs" style={{ marginTop: 5 }} /></td>
                    <td><div className="skel skel-md" /><div className="skel skel-xs" style={{ marginTop: 5 }} /></td>
                    <td><div className="skel skel-badge" /></td>
                    <td><div className="skel skel-md" /></td>
                    <td><div className="skel skel-icon" style={{ marginLeft: 'auto' }} /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="mx-empty-state">
                      <Handshake size={36} />
                      <p className="mx-empty-state__title">Sin tratos para mostrar</p>
                      <p className="mx-empty-state__text">No hay negociaciones que coincidan con los filtros seleccionados. Cambia el mes o usa <strong>Todos</strong> para ver todas.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const uiEstado = getUiEstadoFromApi(item.estado);
                  const displayPrecio = item.precioAcordado ?? derivePrecioDesdeCondiciones(item.condiciones) ?? 0;
                  const displayTons = item.tonsAcordadas || deriveVolumenDesdeCondiciones(item.condiciones) || 0;
                  const displayCamiones = item.camionesXDia || deriveCamionesXDia(item.condiciones);
                  const isAcordado = uiEstado === 'acordado' || uiEstado === 'cerrado_ok';
                  const hasProgramaActivo = item.meta?.programaCosecha?.estado === 'activo' || item.meta?.programaCosecha?.estado === 'pausado';
                  const canCreatePrograma = isAcordado && !hasProgramaActivo && displayTons > 0 && !!item.proveedorNombre && !!onCrearPrograma;
                  const displayInicioCosecha = item.vigenciaDesde || item.fechaCierre;
                  const displayTerminoCosecha = item.fechaTerminoCosecha || calcularFechaTerminoEstimadaTrato({
                    vigenciaDesde: displayInicioCosecha,
                    tonsAcordadas: displayTons,
                    camionesXDia: displayCamiones,
                    condiciones: item.condiciones,
                    transporte: item.transportes?.[0],
                  });
                  const condiciones = item.condiciones || [];

                  return (
                    <tr key={item._id} className="tratos-row">
                      <td data-label="Proveedor">
                        <div className="tratos-provider-name">{item.proveedorNombre}</div>
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
                      <td className="tratos-col-centro" data-label="Centro">
                        {item.centroCodigo
                          ? <code className="tratos-centro-code">{item.centroCodigo}</code>
                          : <span className="tratos-centro-empty">—</span>}
                      </td>
                      <td className="tratos-metric-cell" data-label="Tons">
                        <div className="tratos-metric-primary">{formatInteger(displayTons)} t</div>
                      </td>
                      <td className="tratos-metric-cell" data-label="Precio">
                        <div className="tratos-metric-strong">{formatMoney(displayPrecio)}</div>
                        <div className="tratos-metric-label">x kg</div>
                      </td>
                      <td className="tratos-date-cell" data-label="Fechas">
                        <div className="tratos-date-range">
                          {formatDateOnlySafe(displayInicioCosecha) || '—'}
                          <span className="tratos-date-arrow">→</span>
                          {formatDateOnlySafe(displayTerminoCosecha) || '—'}
                        </div>
                        <div className="tratos-date-label">Inicio → Término est.</div>
                      </td>
                      <td data-label="Estado">
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
                      <td className="tratos-date-cell" data-label="Responsable" style={{ fontSize: '0.85rem' }}>
                        {item.responsableNombre || 'Sin responsable registrado'}
                      </td>
                      <td className="tratos-actions-cell" data-label="Acciones">
                        <div className="mx-table-actions-cell tratos-actions">
                          {canCreatePrograma && (
                            <button
                              type="button"
                              className="mx-btn sm tratos-btn-crear-programa"
                              onClick={() => onCrearPrograma(null, item._id)}
                            >
                              <CalendarPlus size={13} /> Crear programa
                            </button>
                          )}
                          {hasProgramaActivo && (
                            <Link
                              to="/biomasa/programa"
                              className="mx-btn sm tratos-btn-ver-programa"
                            >
                              <CalendarCheck size={13} /> Ver programa
                            </Link>
                          )}
                          <ActionsMenu
                            item={item}
                            onShare={onShare}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onViewReport={onViewReport}
                            onViewCondiciones={setCondModal}
                            hasCondiciones={condiciones.length > 0}
                          />
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
                const isCamionesDia = c.nombre.toLowerCase().includes('camiones') && c.nombre.toLowerCase().includes('dia');
                const transporteTrato = isCamionesDia && condModal.transportes?.[0] ? condModal.transportes[0] : null;

                return (
                  <div key={i} className="tratos-cond-modal-row">
                    <div className="tratos-cond-modal-left">
                      <span className="tratos-cond-modal-name">{c.nombre}</span>
                      <span className="tratos-cond-modal-val">
                        {isCamionesDia && transporteTrato ? `${formatCondVal(c) || 0} ${transporteTrato.nombre || 'Camion Simple'}` : formatCondVal(c) || 'ACORDADO'}
                      </span>
                      {isCamionesDia && transporteTrato && transporteTrato.maxisPorUnidad > 0 && transporteTrato.kgPorMaxiRef > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                          Capacidad: {formatInteger((transporteTrato.maxisPorUnidad * transporteTrato.kgPorMaxiRef) / 1000)} t/camión
                        </div>
                      )}
                    </div>
                    <div className="tratos-cond-modal-right">
                      <span className={`mx-badge ${meta.cls}`}>{meta.label}</span>
                      {c.estado !== 'acordado' && (
                        <button
                          className="tratos-cond-mark-btn"
                          title="Marcar como acordado"
                          disabled={savingCondId === (c._id || c.condicionId || c.nombre)}
                          onClick={() => handleMarcarAcordado(c)}
                        >
                          <CheckCircle2 size={13} />
                          Acordar
                        </button>
                      )}
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
