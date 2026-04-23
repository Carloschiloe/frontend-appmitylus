import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getDisponibilidades,
  getAsignaciones,
  crearAsignacion,
  editarAsignacion,
  borrarAsignacion,
} from '../../api/api-mmpp.js';
import './biomasa.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const mesLabel = (mk = '', largo = false) => {
  if (!mk) return '—';
  const CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                  'Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = mk.split('-');
  const idx = parseInt(m, 10) - 1;
  return largo ? `${LARGO[idx]} ${y}` : `${CORTO[idx]} ${y}`;
};

const fmtTons = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' t';
};

const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);

// ── Sub-components ────────────────────────────────────────────────────────────

function PctBar({ pct }) {
  const p = clamp(pct, 0, 200);
  const fill = Math.min(p, 100);
  const cls = p >= 100 ? 'over' : p >= 85 ? 'warn' : '';
  return (
    <div className="bio-pct-bar">
      <div className="bio-pct-track">
        <div className={`bio-pct-fill ${cls}`} style={{ width: `${fill}%` }} />
      </div>
      <span className="bio-pct-label">{p.toFixed(0)}%</span>
    </div>
  );
}

function SaldoChip({ saldo }) {
  const v = Number(saldo);
  if (!Number.isFinite(v)) return <span>—</span>;
  const ok = v >= 0;
  return (
    <span style={{ color: ok ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
      {ok ? '+' : ''}{fmtTons(v)}
    </span>
  );
}

const ESTADO_META = {
  pendiente_ejecucion: { label: 'Pendiente',  cls: 'pendiente' },
  ejecutado:           { label: 'Ejecutado',  cls: 'confirmado' },
  cancelado:           { label: 'Cancelado',  cls: 'cancelado' },
  confirmado:          { label: 'Confirmado', cls: 'confirmado' },
  pendiente:           { label: 'Pendiente',  cls: 'pendiente' },
};

function EstadoBadge({ estado = '' }) {
  const meta = ESTADO_META[estado] || { label: estado || 'Sin estado', cls: 'default' };
  return <span className={`bio-badge ${meta.cls}`}>{meta.label}</span>;
}

function FuenteBadge({ fuente }) {
  if (fuente !== 'auto-trato') return null;
  return (
    <span
      title="Generado automáticamente al acordar el trato"
      style={{
        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
        background: 'var(--color-info-bg)', color: 'var(--color-info)',
        marginLeft: 4, verticalAlign: 'middle',
      }}
    >
      AUTO
    </span>
  );
}

const ESTADOS_COMPRA = ['pendiente_ejecucion', 'ejecutado', 'cancelado', 'confirmado', 'pendiente'];

const emptyAsig = (mes) => ({
  proveedorNombre: '', mesKey: mes,
  tons: '', centroCodigo: '',
  contactoNombre: '', estado: 'confirmado',
});

// ── Componente principal ──────────────────────────────────────────────────────

export default function Biomasa() {
  const [mes, setMes]           = useState(mesActual);
  const [tab, setTab]           = useState('pipeline'); // 'pipeline' | 'compras'

  const [disp, setDisp]         = useState([]);
  const [asig, setAsig]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [provFilter, setProvFilter] = useState('');

  const [modal, setModal]         = useState({ open: false, mode: 'add' });
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting]   = useState(false);

  // ── Carga paralela ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a] = await Promise.all([
        getDisponibilidades({ mesKey: mes }),
        getAsignaciones({ mesKey: mes }),
      ]);
      setDisp(d);
      setAsig(a);
    } catch (e) {
      setError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const disponible = disp.reduce((s, i) => s + (i.tons || 0), 0);
    // Separar asig auto (de tratos) de manuales
    const autoAsig = asig.filter(i => i.fuente === 'auto-trato');
    const acordado = autoAsig
      .filter(i => ['pendiente_ejecucion', 'confirmado'].includes(i.estado))
      .reduce((s, i) => s + Number(i.tons || 0), 0);
    const ejecutado = autoAsig
      .filter(i => i.estado === 'ejecutado')
      .reduce((s, i) => s + Number(i.tons || 0), 0);
    const manual = asig
      .filter(i => i.fuente !== 'auto-trato')
      .reduce((s, i) => s + Number(i.tons || 0), 0);
    const totalAsignado = asig.reduce((s, i) => s + Number(i.tons || 0), 0);
    const saldo = disponible - totalAsignado;
    const pct = disponible > 0 ? (totalAsignado / disponible) * 100 : 0;
    return { disponible, acordado, ejecutado, manual, totalAsignado, saldo, pct };
  }, [disp, asig]);

  // ── Filtros ──
  const visibleDisp = useMemo(() => {
    if (!provFilter.trim()) return disp;
    const q = provFilter.trim().toLowerCase();
    return disp.filter(i =>
      (i.proveedorNombre || '').toLowerCase().includes(q) ||
      (i.proveedorKey    || '').toLowerCase().includes(q)
    );
  }, [disp, provFilter]);

  const visibleAsig = useMemo(() => {
    if (!provFilter.trim()) return asig;
    const q = provFilter.trim().toLowerCase();
    return asig.filter(i =>
      (i.proveedorNombre || '').toLowerCase().includes(q) ||
      (i.empresaNombre   || '').toLowerCase().includes(q) ||
      (i.contactoNombre  || '').toLowerCase().includes(q)
    );
  }, [asig, provFilter]);

  // ── Modal (solo para Compras manuales) ──
  const openAdd = () => {
    setForm(emptyAsig(mes));
    setSaveError(null);
    setModal({ open: true, mode: 'add' });
  };

  const openEdit = (item) => {
    setForm({
      proveedorNombre: item.proveedorNombre || item.empresaNombre || '',
      mesKey:          item.mesKey          || mes,
      tons:            String(item.tons     ?? ''),
      centroCodigo:    item.centroCodigo    || '',
      contactoNombre:  item.contactoNombre  || '',
      estado:          item.estado          || 'confirmado',
    });
    setSaveError(null);
    setModal({ open: true, mode: 'edit', item });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'add' });
    setSaveError(null);
  };

  const handleField = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.proveedorNombre?.trim()) return setSaveError('El nombre del proveedor es obligatorio.');
    if (!form.mesKey)                  return setSaveError('El mes es obligatorio.');
    const tons = Number(form.tons);
    if (!Number.isFinite(tons) || tons <= 0) return setSaveError('Ingresa toneladas > 0.');

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        proveedorNombre: form.proveedorNombre.trim(),
        mesKey:          form.mesKey,
        tons,
        centroCodigo:    form.centroCodigo?.trim()   || undefined,
        contactoNombre:  form.contactoNombre?.trim() || undefined,
        estado:          form.estado,
        fuente:          'ui-biomasa',
      };
      modal.mode === 'add'
        ? await crearAsignacion(payload)
        : await editarAsignacion(modal.item._id, payload);
      closeModal();
      await load();
    } catch (e) {
      setSaveError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await borrarAsignacion(confirmId);
      setConfirmId(null);
      await load();
    } catch (e) {
      setError(e.message || 'Error al eliminar');
      setConfirmId(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──
  return (
    <div className="bio-page">

      {/* ── Header ── */}
      <div className="bio-header">
        <div className="bio-header-left">
          <div className="bio-header-icon">
            <i className="bi bi-droplet-half" />
          </div>
          <div>
            <h1>Biomasa</h1>
            <p>Planificación mensual · {mesLabel(mes, true)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{
              height: 36, padding: '0 10px', border: '1px solid var(--color-border)',
              borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
              background: 'var(--color-surface)', color: 'var(--color-text)',
            }}
          />
          <button className="bio-btn-secondary" onClick={load} title="Actualizar">
            <i className="bi bi-arrow-clockwise" />
          </button>
          {tab === 'compras' && (
            <button className="bio-btn-primary" onClick={openAdd}>
              <i className="bi bi-plus-lg" /> Compra manual
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bio-error-bar">
          <i className="bi bi-exclamation-triangle-fill" />
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="bio-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="bio-kpi">
          <div className="bio-kpi-label">Disponible declarado</div>
          <div className="bio-kpi-value accent">{fmtTons(kpis.disponible)}</div>
          <div className="bio-kpi-sub">{disp.length} proveedor{disp.length !== 1 ? 'es' : ''}</div>
        </div>
        <div className="bio-kpi">
          <div className="bio-kpi-label">Comprometido (tratos)</div>
          <div className="bio-kpi-value">{fmtTons(kpis.acordado)}</div>
          <div className="bio-kpi-sub">pendiente ejecución</div>
        </div>
        <div className="bio-kpi">
          <div className="bio-kpi-label">Ejecutado</div>
          <div className="bio-kpi-value success">{fmtTons(kpis.ejecutado)}</div>
          <div className="bio-kpi-sub">compras efectuadas</div>
        </div>
        <div className="bio-kpi">
          <div className="bio-kpi-label">Saldo</div>
          <div className={`bio-kpi-value ${kpis.saldo >= 0 ? 'success' : 'danger'}`}>
            {kpis.saldo >= 0 ? '+' : ''}{fmtTons(kpis.saldo)}
          </div>
          <div style={{ marginTop: 8 }}><PctBar pct={kpis.pct} /></div>
        </div>
      </div>

      {/* ── Tabla con tabs ── */}
      <div className="bio-table-card">
        <div className="bio-table-head">
          <div className="bio-tabs">
            <button
              className={`bio-tab${tab === 'pipeline' ? ' active' : ''}`}
              onClick={() => { setTab('pipeline'); setProvFilter(''); }}
            >
              <i className="bi bi-box-seam" /> Disponibilidad
              <span className="bio-tab-count">{disp.length}</span>
            </button>
            <button
              className={`bio-tab${tab === 'compras' ? ' active' : ''}`}
              onClick={() => { setTab('compras'); setProvFilter(''); }}
            >
              <i className="bi bi-cart3" /> Compras
              <span className="bio-tab-count">{asig.length}</span>
            </button>
          </div>
          <input
            type="text"
            className="bio-search"
            placeholder="Buscar proveedor..."
            value={provFilter}
            onChange={(e) => setProvFilter(e.target.value)}
          />
        </div>

        <div className="bio-table-wrap">
          {loading ? (
            <div className="bio-state">
              <div className="bio-spinner" />
              <p>Cargando datos de {mesLabel(mes)}...</p>
            </div>
          ) : tab === 'pipeline' ? (
            <TablaPipeline items={visibleDisp} />
          ) : (
            <TablaCompras
              items={visibleAsig}
              onEdit={openEdit}
              onDelete={setConfirmId}
            />
          )}
        </div>
      </div>

      {/* ── Modal compra manual ── */}
      {modal.open && (
        <div className="bio-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bio-modal">
            <div className="bio-modal-header">
              <h3>{modal.mode === 'add' ? 'Nueva compra manual' : 'Editar compra'}</h3>
              <button className="bio-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="bio-modal-body">
              <div className="bio-field">
                <label>Proveedor *</label>
                <input
                  name="proveedorNombre"
                  value={form.proveedorNombre || ''}
                  onChange={handleField}
                  placeholder="Nombre del proveedor"
                />
              </div>
              <div className="bio-field-row">
                <div className="bio-field">
                  <label>Mes *</label>
                  <input type="month" name="mesKey" value={form.mesKey || ''} onChange={handleField} />
                </div>
                <div className="bio-field">
                  <label>Toneladas *</label>
                  <input
                    type="number" name="tons" value={form.tons || ''}
                    onChange={handleField} placeholder="0" min="0" step="0.1"
                  />
                </div>
              </div>
              <div className="bio-field-row">
                <div className="bio-field">
                  <label>Código centro</label>
                  <input name="centroCodigo" value={form.centroCodigo || ''} onChange={handleField} placeholder="C-101" />
                </div>
                <div className="bio-field">
                  <label>Estado</label>
                  <select name="estado" value={form.estado || 'confirmado'} onChange={handleField}>
                    {ESTADOS_COMPRA.map(e => (
                      <option key={e} value={e}>
                        {ESTADO_META[e]?.label ?? e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bio-field">
                <label>Contacto</label>
                <input name="contactoNombre" value={form.contactoNombre || ''} onChange={handleField} placeholder="Nombre contacto (opcional)" />
              </div>
            </div>
            <div className="bio-modal-footer">
              {saveError && <span className="save-error"><i className="bi bi-exclamation-circle" /> {saveError}</span>}
              <button className="bio-btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="bio-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : modal.mode === 'add' ? 'Agregar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminación ── */}
      {confirmId && (
        <div className="bio-modal-overlay">
          <div className="bio-modal bio-confirm">
            <div className="bio-modal-header">
              <h3>Confirmar eliminación</h3>
              <button className="bio-modal-close" onClick={() => setConfirmId(null)}>×</button>
            </div>
            <div className="bio-modal-body">
              <p>¿Eliminar esta compra? Esta acción no se puede deshacer.</p>
            </div>
            <div className="bio-modal-footer">
              <button className="bio-btn-secondary" onClick={() => setConfirmId(null)} disabled={deleting}>Cancelar</button>
              <button
                className="bio-btn-primary"
                style={{ background: 'var(--color-error)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Pipeline / Disponibilidad (solo lectura) ─────────────────────────────

function TablaPipeline({ items }) {
  if (items.length === 0) {
    return (
      <div className="bio-state">
        <div className="bio-state-icon"><i className="bi bi-inbox" /></div>
        <p>Sin disponibilidades declaradas para este mes</p>
        <p className="hint">
          Declara disponibilidad desde <strong>Proveedores MMPP → Tratos</strong>
        </p>
      </div>
    );
  }
  return (
    <>
      <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="bi bi-info-circle" style={{ color: 'var(--color-info)', fontSize: 13 }} />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Vista de lectura. Para declarar disponibilidad ve a{' '}
          <strong>Proveedores MMPP → Tratos</strong>.
        </span>
      </div>
      <table className="bio-tbl">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Mes</th>
            <th>Tons disponibles</th>
            <th>Centro</th>
            <th>Contacto</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td>
                <strong>{item.proveedorNombre || item.proveedorKey || '—'}</strong>
                {item.proveedorKey && item.proveedorNombre && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.proveedorKey}</div>
                )}
              </td>
              <td className="muted">{mesLabel(item.mesKey)}</td>
              <td className="tons">{fmtTons(item.tons)}</td>
              <td className="muted">{item.centroCodigo || '—'}</td>
              <td className="muted">{item.contactoNombre || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Tab: Compras ──────────────────────────────────────────────────────────────

function TablaCompras({ items, onEdit, onDelete }) {
  const autoItems   = items.filter(i => i.fuente === 'auto-trato');
  const manualItems = items.filter(i => i.fuente !== 'auto-trato');

  if (items.length === 0) {
    return (
      <div className="bio-state">
        <div className="bio-state-icon"><i className="bi bi-cart-x" /></div>
        <p>Sin compras para este mes</p>
        <p className="hint">
          Las compras se generan automáticamente al acordar un trato, o puedes agregar una manual.
        </p>
      </div>
    );
  }

  return (
    <table className="bio-tbl">
      <thead>
        <tr>
          <th>Proveedor</th>
          <th>Mes</th>
          <th>Tons</th>
          <th>Estado</th>
          <th>Origen</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {/* Primero los auto-generados de tratos */}
        {autoItems.map((item) => (
          <tr key={item._id}>
            <td>
              <strong>{item.proveedorNombre || item.empresaNombre || item.proveedorKey || '—'}</strong>
              {item.contactoNombre && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.contactoNombre}</div>
              )}
            </td>
            <td className="muted">{mesLabel(item.mesKey)}</td>
            <td className="tons">{fmtTons(item.tons)}</td>
            <td><EstadoBadge estado={item.estado} /></td>
            <td>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                <i className="bi bi-link-45deg" /> Trato
              </span>
            </td>
            <td className="bio-actions">
              <button className="bio-btn-icon" title="Editar" onClick={() => onEdit(item)}>
                <i className="bi bi-pencil" />
              </button>
            </td>
          </tr>
        ))}
        {/* Luego los manuales */}
        {manualItems.map((item) => (
          <tr key={item._id}>
            <td>
              <strong>{item.proveedorNombre || item.empresaNombre || item.proveedorKey || '—'}</strong>
              {item.contactoNombre && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.contactoNombre}</div>
              )}
            </td>
            <td className="muted">{mesLabel(item.mesKey)}</td>
            <td className="tons">{fmtTons(item.tons)}</td>
            <td><EstadoBadge estado={item.estado} /></td>
            <td>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Manual</span>
            </td>
            <td className="bio-actions">
              <button className="bio-btn-icon" title="Editar" onClick={() => onEdit(item)}>
                <i className="bi bi-pencil" />
              </button>
              <button className="bio-btn-icon danger bio-btn-gap" title="Eliminar" onClick={() => onDelete(item._id)}>
                <i className="bi bi-trash" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
