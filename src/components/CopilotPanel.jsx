import React from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Loader2,
  Send,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { confirmCopilotCommand, sendCopilotCommand } from '../api/api-copilot';
import { useToast } from '../context/ToastContext.jsx';
import './CopilotPanel.css';

const EXAMPLES = [
  'Qué tengo pendiente esta semana',
  'Muéstrame el historial de Eduardo Barría',
  'Crea contacto Claudio Triviño',
  'Consulta últimos muestreos de Los Palqui',
];

function statusLabel(status) {
  switch (status) {
    case 'executed': return 'Ejecutado';
    case 'needs_confirmation': return 'Requiere confirmación';
    case 'needs_clarification': return 'Falta información';
    case 'rejected': return 'Rechazado';
    case 'draft': return 'Borrador';
    default: return status || 'Respuesta';
  }
}

function formatIntent(intent = '') {
  return String(intent || '')
    .replace(/^query_/, 'consultar ')
    .replace(/^register_/, 'registrar ')
    .replace(/^create_/, 'crear ')
    .replace(/_/g, ' ');
}

function getResultItems(result = {}) {
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.recent)) return result.recent;
  if (Array.isArray(result.samples)) return result.samples;
  if (Array.isArray(result.days)) return result.days;
  return [];
}

function renderItemTitle(item = {}) {
  return item.proveedorNombre
    || item.contactoNombre
    || item.nombre
    || item.providerName
    || item.fecha
    || item.fechaProgramada
    || 'Resultado';
}

function renderItemSubtitle(item = {}) {
  return [
    item.proximaAccion || item.resumen || item.tipoContacto || item.tipo,
    item.fechaProgramada || item.fechaGestion || item.fecha || item.fechaProximo,
    item.estadoAgenda || item.estado,
  ].filter(Boolean).join(' · ');
}

function CopilotResult({ result }) {
  const items = getResultItems(result).slice(0, 5);
  if (!items.length) return null;

  return (
    <div className="copilot-result-list">
      {items.map((item, index) => (
        <div className="copilot-result-item" key={item.id || item._id || `${renderItemTitle(item)}-${index}`}>
          <strong>{renderItemTitle(item)}</strong>
          <span>{renderItemSubtitle(item) || 'Sin detalle adicional'}</span>
        </div>
      ))}
    </div>
  );
}

function CopilotResponseCard({ response, onConfirm, confirming }) {
  if (!response) return null;
  const intent = response.command?.intent || '';
  const requiresConfirmation = response.status === 'needs_confirmation' && response.commandId;

  return (
    <section className={`copilot-response copilot-response--${response.status || 'draft'}`}>
      <div className="copilot-response__head">
        <span className="copilot-response__badge">
          {response.status === 'executed' ? <CheckCircle2 size={15} /> : <ClipboardList size={15} />}
          {statusLabel(response.status)}
        </span>
        {intent && <span className="copilot-response__intent">{formatIntent(intent)}</span>}
      </div>

      <p className="copilot-response__message">{response.message || 'Copilot procesó la solicitud.'}</p>

      {Array.isArray(response.command?.warnings) && response.command.warnings.length > 0 && (
        <div className="copilot-warnings">
          <AlertTriangle size={15} />
          <span>{response.command.warnings.join(' ')}</span>
        </div>
      )}

      <CopilotResult result={response.result} />

      {requiresConfirmation && (
        <button
          type="button"
          className="mx-btn mx-btn-primary copilot-confirm"
          onClick={() => onConfirm(response.commandId)}
          disabled={confirming}
        >
          {confirming ? <Loader2 size={16} className="copilot-spin" /> : <CheckCircle2 size={16} />}
          {confirming ? 'Confirmando...' : 'Confirmar acción'}
        </button>
      )}
    </section>
  );
}

export default function CopilotPanel() {
  const { addToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [history, setHistory] = React.useState([]);

  const latestResponse = history.findLast?.((item) => item.type === 'assistant')?.response
    || [...history].reverse().find((item) => item.type === 'assistant')?.response
    || null;

  async function handleSubmit(event) {
    event?.preventDefault();
    const clean = text.trim();
    if (!clean || loading) return;

    setHistory((prev) => [...prev, { type: 'user', text: clean, id: crypto.randomUUID?.() || Date.now() }]);
    setText('');
    setLoading(true);

    try {
      const response = await sendCopilotCommand({ text: clean });
      setHistory((prev) => [...prev, { type: 'assistant', response, id: crypto.randomUUID?.() || Date.now() }]);

      if (response.status === 'executed') {
        addToast({ type: 'success', title: 'Copilot ejecutó la acción', message: response.message });
        window.dispatchEvent(new CustomEvent('mitynex:copilot-executed', { detail: response }));
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Copilot no pudo responder',
        message: error?.data?.message || error?.message || 'Revisa el contexto de empresa e intenta nuevamente.',
      });
      setHistory((prev) => [...prev, {
        type: 'assistant',
        id: crypto.randomUUID?.() || Date.now(),
        response: {
          status: 'rejected',
          message: error?.data?.message || error?.message || 'No se pudo procesar la solicitud.',
        },
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(commandId) {
    if (!commandId || confirming) return;
    setConfirming(true);

    try {
      const response = await confirmCopilotCommand(commandId);
      setHistory((prev) => [...prev, { type: 'assistant', response, id: crypto.randomUUID?.() || Date.now() }]);
      addToast({ type: 'success', title: 'Acción confirmada', message: response.message });
      window.dispatchEvent(new CustomEvent('mitynex:copilot-executed', { detail: response }));
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo confirmar',
        message: error?.data?.message || error?.message || 'El comando pudo expirar o cambiar de contexto.',
      });
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setHistory([]);
    setText('');
  }

  return (
    <>
      <button
        type="button"
        className="copilot-fab"
        onClick={() => setOpen(true)}
        title="Mitynex Copilot"
        aria-label="Abrir Mitynex Copilot"
      >
        <Sparkles size={18} />
        <span>Copilot</span>
      </button>

      {open && (
        <div className="copilot-overlay" role="dialog" aria-modal="true" aria-label="Mitynex Copilot">
          <aside className="copilot-panel">
            <header className="copilot-header">
              <div className="copilot-title">
                <span className="copilot-avatar"><Bot size={20} /></span>
                <div>
                  <h3>Mitynex Copilot</h3>
                  <p>Consulta, prepara registros y confirma acciones seguras.</p>
                </div>
              </div>
              <button type="button" className="mx-btn-icon" onClick={() => setOpen(false)} aria-label="Cerrar Copilot">
                <X size={20} />
              </button>
            </header>

            <div className="copilot-body">
              {history.length === 0 ? (
                <div className="copilot-empty">
                  <Zap size={28} />
                  <strong>Escribe una instrucción simple</strong>
                  <span>Por ahora entiende agenda, historial, contactos, muestreos y programa de cosecha.</span>
                  <div className="copilot-examples">
                    {EXAMPLES.map((example) => (
                      <button key={example} type="button" onClick={() => setText(example)}>
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="copilot-thread">
                  {history.map((item) => (
                    item.type === 'user' ? (
                      <div className="copilot-message copilot-message--user" key={item.id}>
                        {item.text}
                      </div>
                    ) : (
                      <CopilotResponseCard
                        key={item.id}
                        response={item.response}
                        onConfirm={handleConfirm}
                        confirming={confirming && latestResponse?.commandId === item.response?.commandId}
                      />
                    )
                  ))}
                  {loading && (
                    <div className="copilot-loading">
                      <Loader2 size={17} className="copilot-spin" />
                      Interpretando instrucción...
                    </div>
                  )}
                </div>
              )}
            </div>

            <form className="copilot-compose" onSubmit={handleSubmit}>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ej: Registra llamada a Eduardo Barría, tiene producto chico y agenda muestreo para el 20 de julio"
                rows={3}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    handleSubmit(event);
                  }
                }}
              />
              <div className="copilot-compose__actions">
                <button type="button" className="mx-btn mx-btn-outline" onClick={reset} disabled={!history.length && !text}>
                  Limpiar
                </button>
                <button type="submit" className="mx-btn mx-btn-primary" disabled={loading || !text.trim()}>
                  {loading ? <Loader2 size={16} className="copilot-spin" /> : <Send size={16} />}
                  Enviar
                </button>
              </div>
              <button type="button" className="copilot-collapse" onClick={() => setOpen(false)}>
                <ChevronDown size={16} />
                Minimizar
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

