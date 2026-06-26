import React from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  History,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
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

function fmt(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function formatNumber(value, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number.toLocaleString('es-CL', { maximumFractionDigits: 1 })}${suffix}`;
}

function entityName(item = {}) {
  return item.proveedorNombre
    || item.contactoNombre
    || item.nombre
    || item.providerName
    || item.centroCodigo
    || 'Sin proveedor';
}

function StatPill({ label, value }) {
  return (
    <div className="copilot-stat-pill">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AgendaResult({ result }) {
  const items = Array.isArray(result?.items) ? result.items.slice(0, 6) : [];
  if (!items.length) return null;

  return (
    <div className="copilot-result-grid">
      {items.map((item, index) => (
        <div className="copilot-result-card" key={item.id || item._id || `${entityName(item)}-${index}`}>
          <div className="copilot-result-card__top">
            <strong>{entityName(item)}</strong>
            {item.estadoAgenda && <span>{item.estadoAgenda}</span>}
          </div>
          <p>{fmt(item.proximaAccion || item.resumen, 'Sin próxima acción')}</p>
          <small>{fmt(item.fechaProgramada || item.fechaProximo)} · {fmt(item.responsable)}</small>
        </div>
      ))}
    </div>
  );
}

function MuestreosResult({ result }) {
  const samples = Array.isArray(result?.samples) ? result.samples.slice(0, 5) : [];
  const stats = result?.stats || {};
  if (!samples.length && !Object.keys(stats).length) return null;

  return (
    <div className="copilot-result-block">
      <div className="copilot-stats">
        <StatPill label="muestreos" value={formatNumber(stats.total || samples.length)} />
        <StatPill label="rend. prom." value={formatNumber(stats.rendimientoPromedio, '%')} />
        <StatPill label="u×kg prom." value={formatNumber(stats.uxkgPromedio)} />
      </div>
      {!!samples.length && (
        <div className="copilot-result-grid">
          {samples.map((item, index) => (
            <div className="copilot-result-card" key={item.id || item._id || `${item.fecha}-${index}`}>
              <div className="copilot-result-card__top">
                <strong>{fmt(item.fecha)}</strong>
                <span>{formatNumber(item.rendimiento, '%')}</span>
              </div>
              <p>{entityName(item)}</p>
              <small>Centro {fmt(item.centroCodigo)} · U×kg {formatNumber(item.uxkg)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryResult({ result }) {
  const recent = Array.isArray(result?.recent) ? result.recent.slice(0, 4) : [];
  const next = Array.isArray(result?.next) ? result.next.slice(0, 3) : [];
  if (!recent.length && !next.length) return null;

  return (
    <div className="copilot-result-block">
      <div className="copilot-stats">
        <StatPill label="gestiones" value={formatNumber(result?.counts?.interacciones || recent.length)} />
        <StatPill label="próx. pasos" value={formatNumber(result?.counts?.proximosPasos || next.length)} />
        <StatPill label="muestreos" value={formatNumber(result?.counts?.muestreos || 0)} />
      </div>

      {!!recent.length && (
        <div className="copilot-result-section">
          <span className="copilot-result-section__title"><History size={14} /> Últimas gestiones</span>
          <div className="copilot-result-grid">
            {recent.map((item, index) => (
              <div className="copilot-result-card" key={item.id || item._id || `${item.fechaGestion}-${index}`}>
                <div className="copilot-result-card__top">
                  <strong>{fmt(item.tipoContacto || item.tipo)}</strong>
                  <span>{fmt(item.fechaGestion || item.fecha)}</span>
                </div>
                <p>{fmt(item.resumen || item.nota || item.proximaAccion, 'Sin resumen')}</p>
                <small>{fmt(item.responsable)}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!next.length && (
        <div className="copilot-result-section">
          <span className="copilot-result-section__title"><Clock3 size={14} /> Próximos pasos</span>
          <div className="copilot-result-grid">
            {next.map((item, index) => (
              <div className="copilot-result-card" key={item.id || item._id || `${item.fechaProximo}-${index}`}>
                <div className="copilot-result-card__top">
                  <strong>{fmt(item.proximaAccion || item.resumen)}</strong>
                  <span>{fmt(item.fechaProximo || item.fechaProgramada)}</span>
                </div>
                <small>{fmt(item.estado || item.estadoAgenda)}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramaResult({ result }) {
  const days = Array.isArray(result?.days) ? result.days.slice(0, 5) : [];
  if (!days.length && !result?.totals) return null;

  return (
    <div className="copilot-result-block">
      <div className="copilot-stats">
        <StatPill label="camiones" value={formatNumber(result?.totals?.camiones)} />
        <StatPill label="días" value={formatNumber(result?.totals?.diasConPrograma)} />
        <StatPill label="proveedores" value={formatNumber(result?.totals?.proveedores)} />
      </div>
      {!!days.length && (
        <div className="copilot-result-grid">
          {days.map((day, index) => (
            <div className="copilot-result-card" key={day.fecha || index}>
              <div className="copilot-result-card__top">
                <strong>{fmt(day.fecha)}</strong>
                <span>{formatNumber(day.totalCamiones, ' cam.')}</span>
              </div>
              <p>{Array.isArray(day.items) && day.items.length ? `${day.items.length} registros programados` : 'Sin registros'}</p>
              <small>{fmt(day.producto || day.estado)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GenericResult({ result }) {
  const items = [result?.item, result?.contact, result?.created, result?.data]
    .filter(Boolean)
    .concat(Array.isArray(result?.items) ? result.items : [])
    .slice(0, 4);
  if (!items.length) return null;

  return (
    <div className="copilot-result-grid">
      {items.map((item, index) => (
        <div className="copilot-result-card" key={item.id || item._id || index}>
          <strong>{entityName(item)}</strong>
          <p>{fmt(item.resumen || item.message || item.descripcion || item.tipoContacto, 'Registro procesado')}</p>
        </div>
      ))}
    </div>
  );
}

function CopilotResult({ response }) {
  const result = response?.result || {};
  const intent = response?.command?.intent || '';

  if (intent === 'query_agenda') return <AgendaResult result={result} />;
  if (intent === 'query_muestreos') return <MuestreosResult result={result} />;
  if (intent === 'query_history') return <HistoryResult result={result} />;
  if (intent === 'query_programa_cosecha') return <ProgramaResult result={result} />;
  return <GenericResult result={result} />;
}

function buildSpeechText(response) {
  const parts = [response?.message];
  const result = response?.result || {};
  const intent = response?.command?.intent || '';

  if (intent === 'query_agenda' && Array.isArray(result.items)) {
    parts.push(`Encontré ${result.items.length} compromisos.`);
    result.items.slice(0, 3).forEach((item) => {
      parts.push(`${entityName(item)}: ${fmt(item.proximaAccion || item.resumen)} para ${fmt(item.fechaProgramada || item.fechaProximo)}.`);
    });
  }

  if (intent === 'query_muestreos' && result.stats) {
    parts.push(`Total muestreos: ${formatNumber(result.stats.total)}. Rendimiento promedio: ${formatNumber(result.stats.rendimientoPromedio, '%')}.`);
  }

  if (intent === 'query_history' && result.counts) {
    parts.push(`Gestiones: ${formatNumber(result.counts.interacciones)}. Próximos pasos: ${formatNumber(result.counts.proximosPasos)}.`);
  }

  if (intent === 'query_programa_cosecha' && result.totals) {
    parts.push(`Camiones: ${formatNumber(result.totals.camiones)}. Días con programa: ${formatNumber(result.totals.diasConPrograma)}.`);
  }

  return parts.filter(Boolean).join(' ');
}

function commandEntityLabel(command = {}) {
  const entity = command.entity || {};
  const payload = command.payload || {};
  const resolved = command.resolution?.item || command.resolvedEntity || {};

  return entity.providerName
    || entity.contactName
    || entity.centerCode
    || payload.proveedorNombre
    || payload.contactoNombre
    || payload.nombre
    || payload.search
    || resolved.proveedorNombre
    || resolved.contactoNombre
    || resolved.centroCodigo
    || '';
}

function ConfirmationPreview({ command }) {
  const payload = command?.payload || {};
  const rows = [
    ['Entidad', commandEntityLabel(command)],
    ['Acción realizada', payload.tipo || payload.tipoContacto || payload.accionRealizada],
    ['Fecha gestión', payload.fecha || payload.fechaGestion],
    ['Resumen', payload.resumen || payload.nota || payload.descripcion],
    ['Próximo paso', payload.proximoPaso || payload.proximaAccion],
    ['Fecha próximo paso', payload.fechaProximo || payload.fechaProgramada],
    ['Teléfono', payload.contactoTelefono || payload.telefono],
    ['Correo', payload.contactoEmail || payload.email],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  if (!rows.length) return null;

  return (
    <div className="copilot-confirm-preview">
      <span className="copilot-confirm-preview__title">Se guardará esto</span>
      <dl>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{fmt(value)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function CopilotResponseCard({
  response,
  responseId,
  onConfirm,
  confirming,
  onSpeak,
  speaking,
  voiceSupported,
}) {
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
        <div className="copilot-response__tools">
          {intent && <span className="copilot-response__intent">{formatIntent(intent)}</span>}
          {voiceSupported && (
            <button
              type="button"
              className={`copilot-speak ${speaking ? 'is-speaking' : ''}`}
              onClick={() => onSpeak(response, responseId)}
              title={speaking ? 'Detener lectura' : 'Leer respuesta'}
            >
              {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {speaking ? 'Detener' : 'Leer'}
            </button>
          )}
        </div>
      </div>

      <p className="copilot-response__message">{response.message || 'Copilot procesó la solicitud.'}</p>

      {Array.isArray(response.command?.warnings) && response.command.warnings.length > 0 && (
        <div className="copilot-warnings">
          <AlertTriangle size={15} />
          <span>{response.command.warnings.join(' ')}</span>
        </div>
      )}

      <CopilotResult response={response} />

      {requiresConfirmation && (
        <>
          <ConfirmationPreview command={response.command} />
          <button
            type="button"
            className="mx-btn mx-btn-primary copilot-confirm"
            onClick={() => onConfirm(response.commandId)}
            disabled={confirming}
          >
            {confirming ? <Loader2 size={16} className="copilot-spin" /> : <CheckCircle2 size={16} />}
            {confirming ? 'Confirmando...' : 'Confirmar acción'}
          </button>
        </>
      )}
    </section>
  );
}

export default function CopilotPanel({ queryClient }) {
  const { addToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [speakingId, setSpeakingId] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const recognitionRef = React.useRef(null);
  const dictationBaseRef = React.useRef('');

  const latestResponse = history.findLast?.((item) => item.type === 'assistant')?.response
    || [...history].reverse().find((item) => item.type === 'assistant')?.response
    || null;

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
    setVoiceSupported(Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance));
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel?.();
    };
  }, []);

  function refreshAppData() {
    queryClient?.invalidateQueries?.();
  }

  function toggleDictation() {
    if (!speechSupported) {
      addToast({
        type: 'warning',
        title: 'Dictado no disponible',
        message: 'Este navegador no permite reconocimiento de voz. Puedes escribir la instrucción normalmente.',
      });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    dictationBaseRef.current = text.trim();

    recognition.lang = 'es-CL';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      addToast({
        type: 'error',
        title: 'No pude escuchar',
        message: 'Revisa permisos del micrófono o intenta escribir la instrucción.',
      });
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      const base = dictationBaseRef.current;
      setText([base, transcript].filter(Boolean).join(' '));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function speakResponse(response, responseId) {
    if (!voiceSupported) return;

    if (speakingId === responseId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildSpeechText(response));
    utterance.lang = 'es-CL';
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId((current) => (current === responseId ? null : current));
    utterance.onerror = () => setSpeakingId((current) => (current === responseId ? null : current));

    setSpeakingId(responseId);
    window.speechSynthesis.speak(utterance);
  }

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
        refreshAppData();
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
      refreshAppData();
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
    window.speechSynthesis?.cancel?.();
    setSpeakingId(null);
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
                        responseId={item.id}
                        response={item.response}
                        onConfirm={handleConfirm}
                        confirming={confirming && latestResponse?.commandId === item.response?.commandId}
                        onSpeak={speakResponse}
                        speaking={speakingId === item.id}
                        voiceSupported={voiceSupported}
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
                <button
                  type="button"
                  className={`mx-btn mx-btn-outline copilot-dictate ${listening ? 'is-listening' : ''}`}
                  onClick={toggleDictation}
                  title={speechSupported ? 'Dictar instrucción' : 'Dictado no disponible en este navegador'}
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  {listening ? 'Escuchando...' : 'Dictar'}
                </button>
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
