import React, { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, Save, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useToast } from '../../../context/ToastContext.jsx';

const STATUS_OPTIONS = ['new', 'reviewing', 'reproduced', 'fixed', 'released', 'closed', 'not_reproducible'];
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const SOURCE_OPTIONS = ['manual', 'frontend_auto', 'backend_auto'];

const STATUS_LABELS = {
  new: 'Nuevo',
  reviewing: 'En revision',
  reproduced: 'Reproducido',
  fixed: 'Corregido',
  released: 'Publicado',
  closed: 'Cerrado',
  not_reproducible: 'No reproducible',
};

const SEVERITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const SOURCE_LABELS = {
  manual: 'Reportado por usuario',
  frontend_auto: 'Error detectado en pantalla',
  backend_auto: 'Error detectado en servidor',
};

const SOURCE_SHORT_LABELS = {
  manual: 'Usuario',
  frontend_auto: 'Pantalla',
  backend_auto: 'Servidor',
};

const BADGE_STYLES = {
  status: {
    new: { background: '#eff6ff', color: '#1d4ed8' },
    reviewing: { background: '#fef9c3', color: '#854d0e' },
    reproduced: { background: '#fee2e2', color: '#b91c1c' },
    fixed: { background: '#dcfce7', color: '#166534' },
    released: { background: '#e0f2fe', color: '#0369a1' },
    closed: { background: '#f1f5f9', color: '#475569' },
    not_reproducible: { background: '#f3f4f6', color: '#4b5563' },
  },
  severity: {
    low: { background: '#f1f5f9', color: '#475569' },
    medium: { background: '#fef9c3', color: '#854d0e' },
    high: { background: '#ffedd5', color: '#c2410c' },
    critical: { background: '#fee2e2', color: '#b91c1c' },
  },
  source: {
    manual: { background: '#ede9fe', color: '#6d28d9' },
    frontend_auto: { background: '#e0f2fe', color: '#0369a1' },
    backend_auto: { background: '#f1f5f9', color: '#334155' },
  },
};

const formatStatusLabel = (value) => STATUS_LABELS[value] || value || '-';
const formatSeverityLabel = (value) => SEVERITY_LABELS[value] || value || '-';
const formatSourceLabel = (value) => SOURCE_LABELS[value] || value || '-';
const formatSourceShortLabel = (value) => SOURCE_SHORT_LABELS[value] || value || '-';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL');
}

function Badge({ type, value, short = false }) {
  const style = BADGE_STYLES[type]?.[value] || { background: '#f1f5f9', color: '#475569' };
  const label = type === 'status'
    ? formatStatusLabel(value)
    : type === 'severity'
      ? formatSeverityLabel(value)
      : short
        ? formatSourceShortLabel(value)
        : formatSourceLabel(value);

  return (
    <span
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        padding: '6px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function KpiCard({ label, value, tone }) {
  const colors = {
    blue: '#eff6ff',
    amber: '#fef9c3',
    red: '#fee2e2',
    slate: '#f1f5f9',
  };
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, background: colors[tone] || '#fff' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function InfoBlock({ title, children }) {
  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, background: '#fff' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <span style={{ color: 'var(--color-text)', fontSize: 14 }}>{value || '-'}</span>
    </div>
  );
}

function JsonBlock({ value }) {
  if (!value) return <div className="mx-state-placeholder sm">Sin datos</div>;
  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12 }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function buildAgentPrompt(report) {
  return `Tenemos el siguiente error en Mitynex:

Codigo:
${report.errorCode}

Modulo:
${report.module || '-'}

Ruta:
${report.route || '-'}

Endpoint:
${report.endpoint || '-'}

Usuario:
${report.userName || '-'} ${report.userEmail ? `<${report.userEmail}>` : ''}

Descripcion:
${report.description || report.title || '-'}

Stack:
${report.stack || '-'}

Ultimas acciones:
${JSON.stringify(report.lastActions || [], null, 2)}

Payload:
${JSON.stringify(report.payloadSnapshot || {}, null, 2)}

Necesito que revises la causa probable, identifiques archivos relacionados, propongas una correccion minima, ejecutes build/test y no modifiques logica no relacionada.`;
}

function ErrorDetailModal({ report, onClose, onSaved }) {
  const { addToast } = useToast();
  const [draft, setDraft] = useState(report);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(report);
  }, [report]);

  if (!draft) return null;

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const saveDetail = async () => {
    setSaving(true);
    try {
      const data = await apiClient.patch(`/support/error-reports/${draft._id}`, {
        status: draft.status,
        severity: draft.severity,
        internalNotes: draft.internalNotes || '',
        resolutionNote: draft.resolutionNote || '',
        aiDiagnosis: draft.aiDiagnosis || '',
      });
      setDraft(data.report);
      addToast({ type: 'success', title: 'Cambios guardados correctamente.', message: draft.errorCode });
      onSaved(data.report);
    } finally {
      setSaving(false);
    }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildAgentPrompt(draft));
    addToast({ type: 'success', title: 'Prompt copiado para Codex/Claude.', message: draft.errorCode });
  };

  return (
    <div className="mx-modal-overlay" role="dialog" aria-modal="true" aria-label="Detalle de reporte">
      <div
        className="mx-card"
        style={{
          width: 'min(1040px, calc(100vw - 32px))',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="mx-eyebrow" style={{ margin: 0 }}>Detalle del reporte</p>
            <h2 style={{ margin: 0 }}>{draft.errorCode}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge type="status" value={draft.status} />
              <Badge type="severity" value={draft.severity} />
            </div>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose} aria-label="Cerrar detalle">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <InfoBlock title="Resumen del problema">
            <div style={{ display: 'grid', gap: 10 }}>
              <DetailRow label="Que ocurrio" value={draft.description || draft.title} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <DetailRow label="Modulo" value={draft.module} />
                <DetailRow label="Pantalla/Ruta" value={draft.route} />
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700 }}>Origen</span>
                  <div style={{ marginTop: 4 }}><Badge type="source" value={draft.source} /></div>
                </div>
                <DetailRow label="Veces que ocurrio" value={draft.occurrences} />
                <DetailRow label="Primera vez" value={formatDate(draft.firstSeenAt || draft.createdAt)} />
                <DetailRow label="Ultima vez" value={formatDate(draft.lastSeenAt)} />
              </div>
            </div>
          </InfoBlock>

          <InfoBlock title="Usuario afectado">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <DetailRow label="Nombre" value={draft.userName} />
              <DetailRow label="Correo" value={draft.userEmail} />
              <DetailRow label="Empresa/Tenant" value={draft.companyId} />
            </div>
          </InfoBlock>

          <InfoBlock title="Gestion interna">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <label>
                  <span className="mx-form-label">Estado</span>
                  <select className="mx-input" value={draft.status || 'new'} onChange={(e) => updateField('status', e.target.value)}>
                    {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mx-form-label">Urgencia</span>
                  <select className="mx-input" value={draft.severity || 'medium'} onChange={(e) => updateField('severity', e.target.value)}>
                    {SEVERITY_OPTIONS.map((item) => <option key={item} value={item}>{formatSeverityLabel(item)}</option>)}
                  </select>
                </label>
              </div>
              <label><span className="mx-form-label">Notas internas</span><textarea className="mx-input" rows={4} value={draft.internalNotes || ''} onChange={(e) => updateField('internalNotes', e.target.value)} /></label>
              <label><span className="mx-form-label">Diagnostico</span><textarea className="mx-input" rows={4} value={draft.aiDiagnosis || ''} onChange={(e) => updateField('aiDiagnosis', e.target.value)} /></label>
              <label><span className="mx-form-label">Resolucion</span><textarea className="mx-input" rows={4} value={draft.resolutionNote || ''} onChange={(e) => updateField('resolutionNote', e.target.value)} /></label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="mx-btn mx-btn-outline" onClick={copyPrompt}><Copy size={16} />Copiar prompt para Codex/Claude</button>
                <button type="button" className="mx-btn mx-btn-primary" onClick={saveDetail} disabled={saving}><Save size={16} />Guardar cambios</button>
              </div>
            </div>
          </InfoBlock>

          <InfoBlock title="Informacion tecnica avanzada">
            <div style={{ display: 'grid', gap: 8 }}>
              <details><summary>Detalle tecnico</summary><JsonBlock value={draft.stack || '-'} /></details>
              <details><summary>Datos enviados al sistema</summary><JsonBlock value={draft.payloadSnapshot} /></details>
              <details><summary>Respuesta recibida</summary><JsonBlock value={draft.responseSnapshot} /></details>
              <details><summary>Ultimas acciones del usuario</summary><JsonBlock value={draft.lastActions} /></details>
              <details><summary>Historial de ocurrencias</summary><JsonBlock value={draft.occurrencesLog} /></details>
            </div>
          </InfoBlock>
        </div>
      </div>
    </div>
  );
}

export default function ErrorReports() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ status: '', severity: '', module: '', source: '', search: '' });
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const canAccess = user?.rol === 'admin' || user?.rol === 'superadmin';

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const kpis = useMemo(() => ({
    new: items.filter((item) => item.status === 'new').length,
    reviewing: items.filter((item) => item.status === 'reviewing').length,
    critical: items.filter((item) => item.severity === 'critical').length,
    closed: items.filter((item) => item.status === 'closed').length,
  }), [items]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/support/error-reports${query ? `?${query}` : ''}`);
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id) => {
    setSelectedId(id);
    const data = await apiClient.get(`/support/error-reports/${id}`);
    setSelectedDetail(data.report);
  };

  useEffect(() => {
    if (canAccess) loadReports();
  }, [query, canAccess]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const updateAfterSave = (updatedReport) => {
    setSelectedDetail(updatedReport);
    setItems((prev) => prev.map((item) => (
      item._id === updatedReport._id ? { ...item, ...updatedReport } : item
    )));
  };

  return (
    <>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <KpiCard label="Nuevos" value={kpis.new} tone="blue" />
          <KpiCard label="En revision" value={kpis.reviewing} tone="amber" />
          <KpiCard label="Criticos" value={kpis.critical} tone="red" />
          <KpiCard label="Cerrados" value={kpis.closed} tone="slate" />
        </div>

        <section className="mx-card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <input className="mx-input" style={{ minWidth: 0 }} placeholder="Buscar por codigo, usuario o problema" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
            <select className="mx-input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Estado</option>
              {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
            </select>
            <select className="mx-input" value={filters.severity} onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value }))}>
              <option value="">Urgencia</option>
              {SEVERITY_OPTIONS.map((item) => <option key={item} value={item}>{formatSeverityLabel(item)}</option>)}
            </select>
            <input className="mx-input" placeholder="Modulo" value={filters.module} onChange={(e) => setFilters((p) => ({ ...p, module: e.target.value }))} />
            <select className="mx-input" value={filters.source} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}>
              <option value="">Origen</option>
              {SOURCE_OPTIONS.map((item) => <option key={item} value={item}>{formatSourceLabel(item)}</option>)}
            </select>
            <button type="button" className="mx-btn mx-btn-outline" onClick={loadReports} disabled={loading}>
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="mx-table" style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Problema</th>
                  <th>Modulo</th>
                  <th>Usuario</th>
                  <th>Urgencia</th>
                  <th>Estado</th>
                  <th>Origen</th>
                  <th>Veces</th>
                  <th>Fecha</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} style={{ background: selectedId === item._id ? '#eff6ff' : undefined }}>
                    <td>{item.errorCode}</td>
                    <td>{item.title || item.description}</td>
                    <td>{item.module || '-'}</td>
                    <td>{item.userName || item.userEmail || '-'}</td>
                    <td><Badge type="severity" value={item.severity} /></td>
                    <td><Badge type="status" value={item.status} /></td>
                    <td><Badge type="source" value={item.source} short /></td>
                    <td>{item.occurrences}</td>
                    <td>{formatDate(item.lastSeenAt)}</td>
                    <td>
                      <button type="button" className="mx-btn mx-btn-outline" onClick={() => openDetail(item._id)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan="10"><div className="mx-state-placeholder sm">No hay errores reportados todavia.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedDetail && (
        <ErrorDetailModal
          report={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onSaved={updateAfterSave}
        />
      )}
    </>
  );
}
