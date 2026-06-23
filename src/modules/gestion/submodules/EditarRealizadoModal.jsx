import { useState, useEffect } from 'react';
import { Beaker, Calendar, CheckCircle2, ChevronDown, MessageSquare, MinusCircle, Phone, Save, Target, Users, X } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

const TIPO_OPTIONS = [
  { value: 'llame', label: 'Llamada', icon: Phone },
  { value: 'visite', label: 'Visita a centro', icon: Calendar },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'tome_muestra', label: 'Muestreo', icon: Beaker },
  { value: 'negocie', label: 'Reunión', icon: Users },
];

function getActionOption(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  return TIPO_OPTIONS.find((option) => (
    text === option.value
    || text === option.label.toLowerCase()
    || (option.value === 'llame' && text.includes('llam'))
    || (option.value === 'visite' && text.includes('visit'))
    || (option.value === 'whatsapp' && text.includes('whatsapp'))
    || (option.value === 'tome_muestra' && text.includes('muestr'))
    || (option.value === 'negocie' && (text.includes('reuni') || text.includes('negoci')))
  )) || null;
}

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [nextActionMenuOpen, setNextActionMenuOpen] = useState(false);

  const selectedAction = TIPO_OPTIONS.find((option) => option.value === tipoGestion) || TIPO_OPTIONS[0];
  const selectedNextAction = getActionOption(proximaAccion);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get(`/interacciones/${item.sourceId}`);
        const doc = res.item || res;
        setResumen(doc.resumen || doc.resultado || '');
        setTipoGestion(doc.tipo || 'llame');
        setDocFecha(doc.fecha ? new Date(doc.fecha).toISOString() : new Date().toISOString());
        const nextStep = doc.proximoPaso || doc.proximaAccion || '';
        const nextDate = doc.fechaProximo || doc.proximoPasoFecha || doc.fechaProximaAccion || '';
        setProximaAccion(nextStep);
        setFechaProxima(toDateInputValue(nextDate));
        setHayProxima(Boolean(nextStep || nextDate));
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
    if (hayProxima && (!proximaAccion || !fechaProxima)) {
      addToast({ title: 'Falta próximo paso', message: 'Selecciona la próxima acción y su fecha.', type: 'warning' });
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
                <label className="mx-label">Acción realizada</label>
                <div className="quick-capture-action-picker" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={`quick-capture-action-select${actionMenuOpen ? ' is-open' : ''}`}
                    onClick={() => setActionMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={actionMenuOpen}
                  >
                    <selectedAction.icon size={18} />
                    <span>{selectedAction.label}</span>
                    <ChevronDown className="quick-capture-action-select__chevron" size={17} aria-hidden="true" />
                  </button>
                  {actionMenuOpen && (
                    <div className="quick-capture-action-menu" role="listbox" aria-label="Acción realizada">
                      {TIPO_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = tipoGestion === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={active ? 'is-active' : ''}
                            onClick={() => {
                              setTipoGestion(option.value);
                              setActionMenuOpen(false);
                            }}
                          >
                            <Icon size={16} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                      <div className="quick-capture-action-picker">
                        <button
                          type="button"
                          className={`quick-capture-action-select${nextActionMenuOpen ? ' is-open' : ''}`}
                          onClick={() => setNextActionMenuOpen((open) => !open)}
                          aria-haspopup="listbox"
                          aria-expanded={nextActionMenuOpen}
                        >
                          {selectedNextAction ? <selectedNextAction.icon size={18} /> : <Target size={18} />}
                          <span>{selectedNextAction?.label || proximaAccion || 'Selecciona el próximo paso'}</span>
                          <ChevronDown className="quick-capture-action-select__chevron" size={17} aria-hidden="true" />
                        </button>
                        {nextActionMenuOpen && (
                          <div className="quick-capture-action-menu" role="listbox" aria-label="Próxima acción">
                            {TIPO_OPTIONS.map((option) => {
                              const Icon = option.icon;
                              const active = selectedNextAction?.value === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  className={active ? 'is-active' : ''}
                                  onClick={() => {
                                    setProximaAccion(option.label);
                                    setNextActionMenuOpen(false);
                                  }}
                                >
                                  <Icon size={16} />
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
