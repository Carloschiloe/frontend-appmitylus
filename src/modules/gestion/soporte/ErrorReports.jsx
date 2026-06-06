import React, { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, Save } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useToast } from '../../../context/ToastContext.jsx';

const STATUS_OPTIONS = ['new', 'reviewing', 'reproduced', 'fixed', 'released', 'closed', 'not_reproducible'];
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL');
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
      addToast({ type: 'success', title: 'Error actualizado', message: selected.errorCode });
      loadReports();
    } finally {
      setSaving(false);
    }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildAgentPrompt(selected));
    addToast({ type: 'success', title: 'Prompt copiado', message: selected.errorCode });
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 18 }}>
          <section className="mx-card" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 8, marginBottom: 14 }}>
              <select className="mx-input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">Estado</option>
                {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="mx-input" value={filters.severity} onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value }))}>
                <option value="">Urgencia</option>
                {SEVERITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input className="mx-input" placeholder="Modulo" value={filters.module} onChange={(e) => setFilters((p) => ({ ...p, module: e.target.value }))} />
              <select className="mx-input" value={filters.source} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}>
                <option value="">Fuente</option>
                <option value="manual">manual</option>
                <option value="frontend_auto">frontend_auto</option>
                <option value="backend_auto">backend_auto</option>
              </select>
              <input className="mx-input" placeholder="Buscar" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
              <button type="button" className="mx-btn mx-btn-outline" onClick={loadReports} disabled={loading}>
                <RefreshCw size={16} />
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="mx-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Estado</th>
                    <th>Urgencia</th>
                    <th>Fuente</th>
                    <th>Modulo</th>
                    <th>Descripcion</th>
                    <th>Ocurr.</th>
                    <th>Usuario</th>
                    <th>Ultimo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} onClick={() => setSelectedId(item._id)} style={{ cursor: 'pointer', background: selectedId === item._id ? '#eff6ff' : undefined }}>
                      <td>{item.errorCode}</td>
                      <td>{item.status}</td>
                      <td>{item.severity}</td>
                      <td>{item.source}</td>
                      <td>{item.module || '-'}</td>
                      <td>{item.title || item.description}</td>
                      <td>{item.occurrences}</td>
                      <td>{item.userName || '-'}</td>
                      <td>{formatDate(item.lastSeenAt)}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr><td colSpan="9"><div className="mx-state-placeholder sm">Sin reportes para estos filtros.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="mx-card" style={{ padding: 16, maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
            {!selected && <div className="mx-state-placeholder">Selecciona un error.</div>}
            {selected && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <p className="mx-eyebrow">{selected.errorCode}</p>
                  <h2 style={{ margin: 0 }}>{selected.title}</h2>
                  <p style={{ color: 'var(--color-text-muted)' }}>{selected.description}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label><span className="mx-form-label">Estado</span><select className="mx-input" value={selected.status || 'new'} onChange={(e) => updateDetail('status', e.target.value)}>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label><span className="mx-form-label">Urgencia</span><select className="mx-input" value={selected.severity || 'medium'} onChange={(e) => updateDetail('severity', e.target.value)}>{SEVERITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                </div>
                <div><strong>Contexto</strong><p>{selected.module || '-'} · {selected.route || '-'} · {selected.endpoint || '-'}</p></div>
                <div><strong>Usuario</strong><p>{selected.userName || '-'} {selected.userEmail || ''}</p></div>
                <details open><summary>Stack</summary><JsonBlock value={selected.stack || '-'} /></details>
                <details><summary>Payload</summary><JsonBlock value={selected.payloadSnapshot} /></details>
                <details><summary>Respuesta</summary><JsonBlock value={selected.responseSnapshot} /></details>
                <details><summary>Ultimas acciones</summary><JsonBlock value={selected.lastActions} /></details>
                <details><summary>Ocurrencias</summary><JsonBlock value={selected.occurrencesLog} /></details>
                <label><span className="mx-form-label">Notas internas</span><textarea className="mx-input" rows={4} value={selected.internalNotes || ''} onChange={(e) => updateDetail('internalNotes', e.target.value)} /></label>
                <label><span className="mx-form-label">Diagnostico IA</span><textarea className="mx-input" rows={4} value={selected.aiDiagnosis || ''} onChange={(e) => updateDetail('aiDiagnosis', e.target.value)} /></label>
                <label><span className="mx-form-label">Resolucion</span><textarea className="mx-input" rows={4} value={selected.resolutionNote || ''} onChange={(e) => updateDetail('resolutionNote', e.target.value)} /></label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="mx-btn mx-btn-outline" onClick={copyPrompt}><Copy size={16} />Copiar prompt</button>
                  <button type="button" className="mx-btn mx-btn-primary" onClick={saveDetail} disabled={saving}><Save size={16} />Guardar</button>
                </div>
              </div>
            )}
          </aside>
      </div>
    </div>
  );
}
