import React, { useEffect, useState } from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';
import { reportManualError, getClientContext } from '../utils/errorReporter.js';
import { useToast } from '../context/ToastContext.jsx';

const EMPTY_FORM = {
  module: '',
  attemptedAction: '',
  description: '',
  expectedBehavior: '',
  severity: 'medium',
};

export default function SupportReportModal({ open, onClose, initialData = {} }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const context = getClientContext();
    setForm({
      ...EMPTY_FORM,
      module: initialData.module || context.module || '',
      attemptedAction: initialData.attemptedAction || '',
      description: initialData.description || '',
      expectedBehavior: initialData.expectedBehavior || '',
      severity: initialData.severity || 'medium',
    });
  }, [open, initialData]);

  if (!open) return null;

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    const result = await reportManualError({
      ...form,
      title: form.description || form.attemptedAction || 'Reporte manual de problema',
    });
    setSubmitting(false);
    if (result?.ok) {
      addToast({
        type: 'success',
        title: 'Reporte enviado',
        message: `Codigo: ${result.errorCode}`,
      });
      onClose();
    } else {
      addToast({
        type: 'error',
        title: 'No se pudo enviar',
        message: 'El reporte no bloqueo tu trabajo. Intenta nuevamente si el problema continua.',
      });
    }
  };

  return (
    <div className="mx-modal-overlay" role="dialog" aria-modal="true" aria-label="Reportar problema">
      <form
        onSubmit={submit}
        className="mx-card"
        style={{ width: 'min(620px, calc(100vw - 32px))', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <p className="mx-eyebrow">Soporte</p>
            <h2 style={{ margin: 0 }}>Reportar problema</h2>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
          <label>
            <span className="mx-form-label">Modulo</span>
            <input className="mx-input" value={form.module} onChange={(e) => updateField('module', e.target.value)} />
          </label>
          <label>
            <span className="mx-form-label">Que estabas intentando hacer?</span>
            <textarea className="mx-input" rows={3} value={form.attemptedAction} onChange={(e) => updateField('attemptedAction', e.target.value)} required />
          </label>
          <label>
            <span className="mx-form-label">Que ocurrio?</span>
            <textarea className="mx-input" rows={3} value={form.description} onChange={(e) => updateField('description', e.target.value)} required />
          </label>
          <label>
            <span className="mx-form-label">Que esperabas que pasara?</span>
            <textarea className="mx-input" rows={3} value={form.expectedBehavior} onChange={(e) => updateField('expectedBehavior', e.target.value)} />
          </label>
          <label>
            <span className="mx-form-label">Urgencia</span>
            <select className="mx-input" value={form.severity} onChange={(e) => updateField('severity', e.target.value)}>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Critico</option>
            </select>
          </label>
        </div>

        <p style={{ display: 'flex', gap: 8, color: 'var(--color-text-muted)', fontSize: 13, marginTop: 16 }}>
          <AlertTriangle size={16} />
          Se enviara contexto tecnico seguro, ruta actual y ultimas acciones. No adjuntes claves ni datos sensibles.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
          <button type="submit" className="mx-btn mx-btn-primary" disabled={submitting}>
            <Send size={16} />
            {submitting ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </div>
      </form>
    </div>
  );
}
