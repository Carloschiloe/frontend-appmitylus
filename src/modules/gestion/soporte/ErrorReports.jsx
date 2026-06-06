import React, { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, Save } from 'lucide-react';
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

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL');
}

function Badge({ type, value }) {
  const style = BADGE_STYLES[type]?.[value] || { background: '#f1f5f9', color: '#475569' };
  const label = type === 'status'
    ? formatStatusLabel(value)
    : type === 'severity'
      ? formatSeverityLabel(value)
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

export default function ErrorReports() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [filters, setFilters] = useState({ status: '', severity: '', module: '', source: '', search: '' });
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAccess = user?.rol === 'admin' || user?.rol === 'superadmin';
  const selected = detail || items.find((item) => item._id === selectedId);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/support/error-reports${query ? `?${query}` : ''}`);
      setItems(data.items || []);
      if (!selectedId && data.items?.[0]) setSelectedId(data.items[0]._id);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    if (!id) return;
    const data = await apiClient.get(`/support/error-reports/${id}`);
    setDetail(data.report);
  };

  useEffect(() => {
    if (canAccess) loadReports();
  }, [query, canAccess]);

  useEffect(() => {
    setDetail(null);
    if (selectedId && canAccess) loadDetail(selectedId);
  }, [selectedId, canAccess]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const updateDetail = (field, value) => {
    setDetail((prev) => ({ ...(prev || selected), [field]: value }));
  };

  const saveDetail = async () => {
    if (!selected?._id) return;
    setSaving(true);
    try {
      const data = await apiClient.patch(`/support/error-reports/${selected._id}`, {
        status: selected.status,
        severity: selected.severity,
        internalNotes: selected.internalNotes || '',
        resolutionNote: selected.resolutionNote || '',
        aiDiagnosis: selected.aiDiagnosis || '',
      });
      setDetail(data.report);
      addToast({ type: 'success', title: 'Cambios guardados', message: selected.errorCode });
      loadReports();
    } finally {
      setSaving(false);
    }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildAgentPrompt(selected));
    addToast({ type: 'success', title: 'Prompt copiado.', message: selected.errorCode });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 18 }}>
      <section className="mx-card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 14 }}>
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
          <input className="mx-input" placeholder="Buscar por codigo, usuario o problema" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <button type="button" className="mx-btn mx-btn-outline" onClick={loadReports} disabled={loading}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="mx-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Estado</th>
                <th>Urgencia</th>
                <th>Origen</th>
                <th>Modulo</th>
                <th>Problema</th>
                <th>Veces</th>
                <th>Usuario</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} onClick={() => setSelectedId(item._id)} style={{ cursor: 'pointer', background: selectedId === item._id ? '#eff6ff' : undefined }}>
                  <td>{item.errorCode}</td>
                  <td><Badge type="status" value={item.status} /></td>
                  <td><Badge type="severity" value={item.severity} /></td>
                  <td><Badge type="source" value={item.source} /></td>
                  <td>{item.module || '-'}</td>
                  <td>{item.title || item.description}</td>
                  <td>{item.occurrences}</td>
                  <td>{item.userName || item.userEmail || '-'}</td>
                  <td>{formatDate(item.lastSeenAt)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan="9"><div className="mx-state-placeholder sm">No hay errores reportados todavia.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="mx-card" style={{ padding: 16, maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
        {!selected && <div className="mx-state-placeholder">Selecciona un reporte para ver su detalle.</div>}
        {selected && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <p className="mx-eyebrow" style={{ margin: 0 }}>Reporte de soporte</p>
              <h2 style={{ margin: 0 }}>{selected.errorCode}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge type="status" value={selected.status} />
                <Badge type="severity" value={selected.severity} />
              </div>
            </div>

            <InfoBlock title="Resumen del problema">
              <div style={{ display: 'grid', gap: 10 }}>
                <DetailRow label="Que ocurrio" value={selected.description || selected.title} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <DetailRow label="Modulo" value={selected.module} />
                  <DetailRow label="Ruta/Pantalla" value={selected.route} />
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700 }}>Origen</span>
                    <div style={{ marginTop: 4 }}><Badge type="source" value={selected.source} /></div>
                  </div>
                  <DetailRow label="Primera vez" value={formatDate(selected.firstSeenAt || selected.createdAt)} />
                  <DetailRow label="Ultima vez" value={formatDate(selected.lastSeenAt)} />
                  <DetailRow label="Veces que ocurrio" value={selected.occurrences} />
                </div>
              </div>
            </InfoBlock>

            <InfoBlock title="Usuario afectado">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <DetailRow label="Nombre" value={selected.userName} />
                <DetailRow label="Correo" value={selected.userEmail} />
                <DetailRow label="Empresa/Tenant" value={selected.companyId} />
              </div>
            </InfoBlock>

            <InfoBlock title="Gestion interna">
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  <label>
                    <span className="mx-form-label">Estado</span>
                    <select className="mx-input" value={selected.status || 'new'} onChange={(e) => updateDetail('status', e.target.value)}>
                      {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mx-form-label">Urgencia</span>
                    <select className="mx-input" value={selected.severity || 'medium'} onChange={(e) => updateDetail('severity', e.target.value)}>
                      {SEVERITY_OPTIONS.map((item) => <option key={item} value={item}>{formatSeverityLabel(item)}</option>)}
                    </select>
                  </label>
                </div>
                <label><span className="mx-form-label">Notas internas</span><textarea className="mx-input" rows={4} value={selected.internalNotes || ''} onChange={(e) => updateDetail('internalNotes', e.target.value)} /></label>
                <label><span className="mx-form-label">Diagnostico IA</span><textarea className="mx-input" rows={4} value={selected.aiDiagnosis || ''} onChange={(e) => updateDetail('aiDiagnosis', e.target.value)} /></label>
                <label><span className="mx-form-label">Resolucion</span><textarea className="mx-input" rows={4} value={selected.resolutionNote || ''} onChange={(e) => updateDetail('resolutionNote', e.target.value)} /></label>
              </div>
            </InfoBlock>

            <InfoBlock title="Informacion tecnica avanzada">
              <div style={{ display: 'grid', gap: 8 }}>
                <details><summary>Detalle tecnico</summary><JsonBlock value={selected.stack || '-'} /></details>
                <details><summary>Datos enviados al sistema</summary><JsonBlock value={selected.payloadSnapshot} /></details>
                <details><summary>Respuesta recibida</summary><JsonBlock value={selected.responseSnapshot} /></details>
                <details><summary>Ultimas acciones del usuario</summary><JsonBlock value={selected.lastActions} /></details>
                <details><summary>Historial de ocurrencias</summary><JsonBlock value={selected.occurrencesLog} /></details>
              </div>
            </InfoBlock>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="mx-btn mx-btn-outline" onClick={copyPrompt}><Copy size={16} />Copiar prompt para Codex/Claude</button>
              <button type="button" className="mx-btn mx-btn-primary" onClick={saveDetail} disabled={saving}><Save size={16} />Guardar cambios</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
