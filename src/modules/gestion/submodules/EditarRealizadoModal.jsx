import { useState, useEffect } from 'react';
import { Beaker, Calendar, CheckCircle2, MessageSquare, MinusCircle, Phone, Save, X } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

const TIPO_OPTIONS = [
  { value: 'llame', label: 'Llamé', icon: Phone },
  { value: 'visite', label: 'Visité', icon: Calendar },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'tome_muestra', label: 'Tomé muestra', icon: Beaker },
];

function formatDateCL(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function EditarRealizadoModal({ item, onClose, onSaved }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resumen, setResumen] = useState('');
  const [tipoGestion, setTipoGestion] = useState('llame');
  const [docFecha, setDocFecha] = useState('');
  const [hayProxima, setHayProxima] = useState(false);
  const [proximaAccion, setProximaAccion] = useState('');
  const [fechaProxima, setFechaProxima] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get(`/interacciones/${item.sourceId}`);
        const doc = res.item || res;
        setResumen(doc.resumen || doc.resultado || '');
        setTipoGestion(doc.tipo || 'llame');
        setDocFecha(doc.fecha ? new Date(doc.fecha).toISOString() : new Date().toISOString());
      } catch {
        addToast({ title: 'Error', message: 'No se pudo cargar el registro.', type: 'error' });
        onClose();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [item.sourceId, addToast, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!resumen.trim()) {
      addToast({ title: 'Falta resumen', message: 'Escribe qué pasó.', type: 'warning' });
      return;
    }
    if (hayProxima && !fechaProxima) {
      addToast({ title: 'Falta fecha', message: 'Indica cuándo es la próxima acción.', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const isoFechaProxima = hayProxima && fechaProxima
        ? new Date(`${fechaProxima}T09:00:00`).toISOString()
        : null;
      await apiClient.put(`/interacciones/${item.sourceId}`, {
        resumen: resumen.trim(),
        resultado: resumen.trim(),
        tipo: tipoGestion,
        fecha: docFecha,
        responsablePG: item.responsible || 'Sistema',
        proximoPaso: hayProxima ? proximaAccion : '',
        fechaProximo: isoFechaProxima,
      });
      addToast({
        title: 'Actualizado',
        message: hayProxima ? 'Gestión corregida y próxima acción agendada.' : 'Gestión corregida correctamente.',
        type: 'success',
      });
      onSaved();
      onClose();
    } catch (error) {
      addToast({ title: 'Error', message: error?.message || 'No se pudo guardar.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal" style={{ maxWidth: '520px', width: 'min(100%, 520px)' }}>
        <div className="mx-modal-header">
          <div>
            <h3 className="mx-modal-title">Editar gestión realizada</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
              {item.provider} · {formatDateCL(item.date)}
            </p>
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="mx-modal-body" style={{ display: 'grid', placeItems: 'center', minHeight: 140 }}>
            <div className="mx-spinner" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mx-form">
            <div className="mx-modal-body" style={{ display: 'grid', gap: '18px' }}>

              <section className="mx-form-group">
                <label className="mx-label">¿Qué hiciste?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                  {TIPO_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = tipoGestion === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTipoGestion(opt.value)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
                          borderRadius: 12, minHeight: 40, fontWeight: 500, fontSize: '0.82rem',
                          border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: active ? 'rgba(10, 92, 255, 0.08)' : 'white',
                          color: active ? 'var(--color-primary)' : 'var(--color-text)',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon size={13} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mx-form-group">
                <label className="mx-label">
                  Resumen de la gestión <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  className="mx-input"
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  rows={3}
                  placeholder="Describe qué pasó en esta gestión..."
                  required
                  style={{ resize: 'vertical' }}
                />
              </section>

              <section className="mx-form-group">
                <label className="mx-label">¿Agregar próxima acción?</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setHayProxima(true)}
                    style={{
                      flex: 1, borderRadius: 12, minHeight: 44, fontWeight: 500, fontSize: '0.88rem',
                      border: hayProxima ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: hayProxima ? 'rgba(10, 92, 255, 0.08)' : 'white',
                      color: hayProxima ? 'var(--color-primary)' : 'var(--color-text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={15} /> Sí, agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => setHayProxima(false)}
                    style={{
                      flex: 1, borderRadius: 12, minHeight: 44, fontWeight: 500, fontSize: '0.88rem',
                      border: !hayProxima ? '2px solid #64748b' : '1px solid var(--color-border)',
                      background: !hayProxima ? 'rgba(100,116,139,0.08)' : 'white',
                      color: !hayProxima ? '#64748b' : 'var(--color-text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                    }}
                  >
                    <MinusCircle size={15} /> Solo corregir
                  </button>
                </div>
                {hayProxima && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10, marginTop: 12 }}>
                    <div className="mx-form-group">
                      <label className="mx-label">Próxima acción</label>
                      <input
                        className="mx-input"
                        value={proximaAccion}
                        onChange={(e) => setProximaAccion(e.target.value)}
                        placeholder="Ej: Llamar para confirmar"
                      />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Fecha</label>
                      <input
                        type="date"
                        className="mx-input"
                        value={fechaProxima}
                        onChange={(e) => setFechaProxima(e.target.value)}
                        required={hayProxima}
                      />
                    </div>
                  </div>
                )}
              </section>

            </div>

            <div className="mx-modal-footer">
              <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="mx-btn mx-btn-primary" disabled={saving}>
                <Save size={15} style={{ marginRight: 4 }} />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
