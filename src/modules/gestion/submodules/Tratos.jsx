import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, RotateCcw, Send, CheckCircle2, Copy
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTratos } from '../hooks/useGestionQueries';
import { maestrosApi } from '../../../api/api-maestros';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import './tratos.css';

const ESTADOS_TRATO = [
  { val: 'pendiente',     label: 'Pendiente' },
  { val: 'acordado',      label: 'Acordado' },
  { val: 'rechazado',     label: 'Rechazado' },
  { val: 'cerrado_ok',    label: 'Cerrado OK' }
];

const UI_TO_API_ESTADO = {
  pendiente: 'negociando',
  acordado: 'acordado',
  rechazado: 'caido',
  cerrado_ok: 'compra_efectuada',
};

const API_TO_UI_ESTADO = {
  prospecto: 'pendiente',
  negociando: 'pendiente',
  semi_acordado: 'pendiente',
  acordado: 'acordado',
  compra_efectuada: 'cerrado_ok',
  cerrado: 'cerrado_ok',
  caido: 'rechazado',
  perdido: 'rechazado',
  descartado: 'rechazado',
};

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function getUiEstadoFromApi(estado) {
  return API_TO_UI_ESTADO[String(estado || '').toLowerCase()] || 'pendiente';
}

function getApiEstadoFromUi(estado) {
  return UI_TO_API_ESTADO[String(estado || '').toLowerCase()] || 'negociando';
}

function parseNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '-';
  return number.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '-';
  return `$${number.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}

function getDateOnlyParts(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatDateOnlySafe(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return '—';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${day}-${month}-${parts.year}`;
}

function normalizeDateOnlyForUiSafe(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return value;
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}T12:00:00.000Z`;
}

function deriveCamionesXDia(condiciones = []) {
  const match = (condiciones || []).find((item) => /camiones?\s*dia/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

function derivePrecioDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /precio/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

function deriveVolumenDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /volumen|total/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

function derivePlazoDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /plazo|pago/.test(normalizeText(item?.nombre)));
  return match?.valor || '';
}

function isEquivalentEstado(actualApi, nextUi) {
  const current = String(actualApi || '').toLowerCase();
  if (nextUi === 'cerrado_ok') return ['compra_efectuada', 'cerrado'].includes(current);
  if (nextUi === 'acordado') return current === 'acordado';
  if (nextUi === 'rechazado') return ['caido', 'perdido', 'descartado'].includes(current);
  if (nextUi === 'pendiente') return ['prospecto', 'negociando', 'semi_acordado'].includes(current);
  return false;
}

export default function Tratos() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingEstadoApi, setEditingEstadoApi] = useState('');
  const [confirmDeleteTrato, setConfirmDeleteTrato] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, url: '', item: null });

  // 1. Carga de datos con React Query
  const { data: tratosRes, isLoading: loadingTratos } = useTratos();
  
  const items = useMemo(() => {
    const raw = toList(tratosRes);
    return raw.map((item) => ({
      ...item,
      fechaCierre: normalizeDateOnlyForUiSafe(item.fechaCierre),
    }));
  }, [tratosRes]);

  const loading = loadingTratos;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tratos'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, [handleRefresh]);

  const { data: maestrosCondiciones = [] } = useQuery({
    queryKey: ['maestros', 'condicion_negociacion', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('condicion_negociacion'),
    staleTime: 10 * 60 * 1000,
  });

  const [form, setForm] = useState({
    proveedorNombre: '',
    tonsAcordadas: '',
    precioBase: '',
    fechaCierre: '',
    estado: 'pendiente',
    notas: '',
    condiciones: []
  });

  useEffect(() => {
    if (isModalOpen && !editingId && maestrosCondiciones.length > 0) {
      const initialCond = maestrosCondiciones.map(m => ({
        condicionId: m._id,
        nombre: m.nombre,
        tipoValor: m.tipoValor,
        estado: 'pendiente',
        valor: null
      }));
      setForm(prev => ({ ...prev, condiciones: initialCond }));
    }
  }, [isModalOpen, editingId, maestrosCondiciones]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const volumenDesdeCondiciones = deriveVolumenDesdeCondiciones(form.condiciones);
        const tratoPayload = {
          tonsAcordadas: parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones,
          precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
          notasTrato: form.notas || '',
          camionesXDia: deriveCamionesXDia(form.condiciones),
          fechaCierre: form.fechaCierre || null,
        };

        await apiClient.patch(`/oportunidades/${editingId}/trato`, tratoPayload);

        await Promise.all(
          (form.condiciones || []).map((condicion) =>
            apiClient.post(`/oportunidades/${editingId}/condiciones`, {
              ...condicion,
              valor: condicion.valor === '' ? null : condicion.valor,
            })
          )
        );

        if (!isEquivalentEstado(editingEstadoApi, form.estado)) {
          await apiClient.patch(`/oportunidades/${editingId}/estado`, {
            estado: getApiEstadoFromUi(form.estado),
            observacion: form.notas || '',
          });
        }
        addToast({ title: 'Actualizado', message: 'Trato actualizado con éxito', type: 'success' });
      } else {
        await apiClient.post('/oportunidades', form);
        addToast({ title: 'Creado', message: 'Nuevo trato registrado', type: 'success' });
      }
      setIsModalOpen(false);
      handleRefresh();
    } catch {
      addToast({ title: 'Error', message: 'No se pudo guardar el trato', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteTrato?._id) return;
    try {
      await apiClient.delete(`/oportunidades/${confirmDeleteTrato._id}`);
      addToast({ title: 'Eliminado', message: 'Trato eliminado', type: 'success' });
      setConfirmDeleteTrato(null);
      handleRefresh();
    } catch {
      addToast({ title: 'Error', message: 'No se pudo eliminar', type: 'error' });
    }
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setEditingEstadoApi(item.estado || '');
    setForm({
      proveedorNombre: item.proveedorNombre || '',
      tonsAcordadas: item.tonsAcordadas || '',
      precioBase: '',
      fechaCierre: item.fechaCierre ? item.fechaCierre.slice(0, 10) : '',
      estado: getUiEstadoFromApi(item.estado),
      notas: item.notasTrato || item.notas || '',
      condiciones: item.condiciones || []
    });
    setIsModalOpen(true);
  };

  const toggleCondicionStatus = (idx, status) => {
    const nextCond = [...form.condiciones];
    nextCond[idx].estado = status;
    setForm({ ...form, condiciones: nextCond });
  };

  const compartirTrato = async (item) => {
    try {
      const res = await apiClient.post(`/oportunidades/${item._id}/share`);
      setShareModal({ open: true, url: res.url, item });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo generar el link para compartir', type: 'error' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast({ title: 'Copiado', message: 'Link copiado al portapapeles', type: 'success' });
  };

  const filteredItems = items.filter(i => 
    (i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-page am-p-0">
      <div className="mx-toolbar am-mt-16">
        <div className="mx-search-box" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn-icon sm" onClick={handleRefresh} title="Actualizar"><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary" onClick={() => { setEditingId(null); setEditingEstadoApi(''); setIsModalOpen(true); }}>
          <Plus size={18} /> Nueva Negociación
        </button>
      </div>

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Proveedor</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Tons</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Precio Est.</th>
                <th>Cierre Previsto</th>
                <th style={{ width: '140px' }}>Estado</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6">
                    <div className="mx-state-placeholder">
                      <div className="mx-spinner"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="mx-state-placeholder">No hay negociaciones activas.</div>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const uiEstado = getUiEstadoFromApi(item.estado);
                  const displayPrecio = item.precioAcordado ?? derivePrecioDesdeCondiciones(item.condiciones) ?? 0;
                  const displayTons = item.tonsAcordadas || deriveVolumenDesdeCondiciones(item.condiciones) || 0;
                  const displayPlazo = derivePlazoDesdeCondiciones(item.condiciones);
                  const displayCamiones = item.camionesXDia || deriveCamionesXDia(item.condiciones);

                  return (
                    <tr key={item._id} className="tratos-row">
                      <td>
                        <div className="tratos-provider-name">{item.proveedorNombre}</div>
                        <div className="tratos-chip-row">
                          <span className="tratos-chip">Precio {formatMoney(displayPrecio)}</span>
                          {displayPlazo && (
                            <span className="tratos-chip">Pago {formatInteger(displayPlazo)} dias</span>
                          )}
                          {displayCamiones && (
                            <span className="tratos-chip">Carga {formatInteger(displayCamiones)} cam/dia</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="tratos-metric-primary">{formatInteger(displayTons)} t</div>
                        <div className="tratos-metric-label">Volumen</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="tratos-metric-strong">{formatMoney(displayPrecio)}</div>
                        <div className="tratos-metric-label">x kg</div>
                      </td>
                      <td style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{formatDateOnlySafe(item.fechaCierre)}</div>
                        <div style={{ fontSize: '10px' }}>Fecha estimada</div>
                      </td>
                      <td>
                        <span className={`mx-badge mx-badge-${uiEstado === 'acordado' || uiEstado === 'cerrado_ok' ? 'success' : uiEstado === 'rechazado' ? 'danger' : 'info'}`}>
                          {ESTADOS_TRATO.find(e => e.val === uiEstado)?.label || item.estado}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="mx-table-actions-cell" style={{ justifyContent: 'flex-end' }}>
                           <button 
                             className="mx-action-btn" 
                             style={{ color: 'var(--color-primary)' }} 
                             title="Compartir Trato" 
                             onClick={() => compartirTrato(item)}
                           >
                             <Send size={14} />
                           </button>
                           <button className="mx-action-btn edit" title="Editar Negociación" onClick={() => openEdit(item)}><Edit size={14} /></button>
                           <button className="mx-action-btn delete" title="Eliminar" onClick={() => setConfirmDeleteTrato(item)}><Trash2 size={14} /></button>
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

      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '600px' }}>
            <div className="mx-modal-header">
              <h2>{editingId ? 'Editar Trato' : 'Nuevo Trato'}</h2>
              <button type="button" className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Proveedor</label>
                  <input className="mx-input" value={form.proveedorNombre} onChange={e => setForm({...form, proveedorNombre: e.target.value})} required />
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Tons Acordadas</label>
                  <input type="number" step="1" className="mx-input" value={form.tonsAcordadas} onChange={e => setForm({...form, tonsAcordadas: e.target.value})} />
                </div>
                
                <div className="am-mt-16">
                  <label className="mx-label am-mb-8" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                    Condiciones de Negociación (Maestros)
                  </label>
                  <div className="mx-conditions-checklist" style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    {form.condiciones.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px' }}>No hay condiciones configuradas en maestros.</p>
                    ) : (
                      form.condiciones.map((c, idx) => (
                        <div key={idx} className="tratos-condition-row">
                          <span className="tratos-condition-name">{c.nombre}</span>
                          
                          {c.tipoValor === 'porcentaje' && (
                            <select 
                              className="mx-input" 
                              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              value={c.modoCondicion || 'normal'}
                              onChange={(e) => {
                                const nextCond = [...form.condiciones];
                                nextCond[idx].modoCondicion = e.target.value;
                                if (e.target.value === 'normal') nextCond[idx].valor = '';
                                setForm({ ...form, condiciones: nextCond });
                              }}
                            >
                              <option value="normal">Normal</option>
                              <option value="fijo">Fijo</option>
                            </select>
                          )}

                          {!(c.tipoValor === 'porcentaje' && (!c.modoCondicion || c.modoCondicion === 'normal')) && (
                            <input 
                              type={['numero', 'moneda', 'porcentaje', 'dias'].includes(c.tipoValor) ? 'number' : 'text'}
                              className="mx-input"
                              style={{ width: '100px', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              placeholder={c.tipoValor === 'moneda' ? '$ Valor' : c.tipoValor === 'porcentaje' ? '% Valor' : 'Valor'}
                              value={c.valor || ''}
                              onChange={(e) => {
                                const nextCond = [...form.condiciones];
                                nextCond[idx].valor = e.target.value;
                                setForm({ ...form, condiciones: nextCond });
                              }}
                            />
                          )}

                          <select 
                            className="mx-input" 
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                            value={c.estado}
                            onChange={(e) => toggleCondicionStatus(idx, e.target.value)}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="acordado">Acordado</option>
                            <option value="rechazado">Rechazado</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mx-form-row am-mt-16" style={{ display: 'flex', gap: '16px' }}>
                  <div className="mx-form-group" style={{ flex: 1 }}>
                    <label className="mx-label">Fecha Cierre</label>
                    <input type="date" className="mx-input" value={form.fechaCierre} onChange={e => setForm({...form, fechaCierre: e.target.value})} />
                  </div>
                  <div className="mx-form-group" style={{ flex: 1 }}>
                    <label className="mx-label">Estado General</label>
                    <select className="mx-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                      {ESTADOS_TRATO.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Notas</label>
                  <textarea className="mx-textarea" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows="3" />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Negociación</button>
              </div>
            </form>
          </div>
         </div>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteTrato)}
        onClose={() => setConfirmDeleteTrato(null)}
        onConfirm={handleDelete}
        title="¿Eliminar trato?"
        itemName={confirmDeleteTrato?.proveedorNombre}
      />

      {/* Modal de Compartir Trato (Minimalista) */}
      {shareModal.open && (
        <div className="mx-modal-overlay" style={{ zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div className="mx-modal" style={{ maxWidth: '380px', borderRadius: '24px', padding: '32px', textAlign: 'center' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: '#f0fdf4', color: '#166534', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px' }}>Trato Listo</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Envía el comprobante oficial al proveedor.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(`🤝 Hola ${shareModal.item?.proveedorNombre}, adjunto la confirmación oficial de nuestra negociación: ${shareModal.url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="mx-btn mx-btn-primary"
                style={{ background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '48px', borderRadius: '14px' }}
              >
                <Send size={18} /> WhatsApp Directo
              </a>
              
              <button 
                className="mx-btn mx-btn-outline"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '48px', borderRadius: '14px' }}
                onClick={() => copyToClipboard(shareModal.url)}
              >
                <Copy size={18} /> Copiar Link
              </button>

              <button 
                className="mx-btn"
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '0.85rem', marginTop: '8px' }}
                onClick={() => setShareModal({ open: false, url: '', item: null })}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
     </div>
   );
 }
