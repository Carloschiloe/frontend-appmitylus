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
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  createCopilotSpeech,
  getCopilotVoiceStatus,
  streamCopilotCommand,
  transcribeCopilotAudio,
} from '../api/api-copilot';
import { useToast } from '../context/ToastContext.jsx';
import './CopilotPanel.css';

const EXAMPLES = [
  'Qué tengo pendiente esta semana',
  'Muéstrame el historial de Eduardo Barría',
  'Crea contacto Claudio Triviño',
  'Consulta últimos muestreos de Los Palqui',
];

const MAX_CONVERSATION_MESSAGES = 16;
const MAX_RECORDING_MS = 15000;

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

function deriveTurnStatus(results = []) {
  if (!results.length) return 'draft';
  if (results.some((r) => r.status === 'rejected' || r.status === 'needs_clarification')) return 'rejected';
  if (results.every((r) => r.status === 'executed')) return 'executed';
  return results[0].status || 'draft';
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
                  <strong>{entityName(item)}</strong>
                  <span>{fmt(item.tipoContacto || item.tipo)}</span>
                </div>
                <p>{fmt(item.resumen || item.nota || item.proximaAccion, 'Sin resumen')}</p>
                <small>{fmt(item.fechaGestion || item.fecha)} · {fmt(item.responsable)}</small>
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
                  <strong>{entityName(item)}</strong>
                  <span>{fmt(item.estado || item.estadoAgenda)}</span>
                </div>
                <p>{fmt(item.proximaAccion || item.resumen, 'Sin próxima acción')}</p>
                <small>{fmt(item.fechaProximo || item.fechaProgramada)}</small>
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

/**
 * La narrativa del agente ya es una respuesta natural y completa (cuenta que
 * encontró, con quién, cuántos). Leer ademas el detalle de cada tarjeta encima
 * duplicaba el contenido y hacia la lectura mucho mas larga de lo necesario.
 * Solo se cae al mensaje de cada resultado cuando no hay narrativa (ej. al
 * confirmar una accion, donde no se vuelve a llamar a la IA).
 */
function buildTurnSpeechText(turn) {
  if (turn?.narrative) return turn.narrative;
  return (turn?.results || []).map((response) => response?.message).filter(Boolean).join(' ');
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

function optionTitle(option = {}) {
  if (option.contactoNombre && option.proveedorNombre) return option.contactoNombre;
  return option.proveedorNombre
    || option.contactoNombre
    || option.centroCodigo
    || option.label
    || 'Opción';
}

function optionSubtitle(option = {}) {
  return [
    option.proveedorNombre && option.contactoNombre ? option.proveedorNombre : '',
    option.centroCodigo ? `Centro ${option.centroCodigo}` : '',
    option.centroComuna,
    option.telefono,
  ].filter(Boolean).join(' · ');
}

function optionSearchLabel(option = {}) {
  if (option.centroCodigo) return `centro ${option.centroCodigo}`;
  if (option.contactoNombre && option.proveedorNombre) return `${option.contactoNombre} de ${option.proveedorNombre}`;
  return option.proveedorNombre || option.contactoNombre || option.label || '';
}

function buildClarifiedText(response, option, sourceText = '') {
  const target = optionSearchLabel(option);
  const intent = response?.command?.intent || '';
  if (!target) return sourceText;

  if (intent === 'query_history') return `Muéstrame el historial de ${target}`;
  if (intent === 'query_muestreos') return `Consulta últimos muestreos de ${target}`;
  if (intent === 'query_programa_cosecha') return `Consulta programa de cosecha de ${target}`;
  if (intent === 'register_interaction') return `${sourceText}. El proveedor/contacto correcto es ${target}`;
  return `${sourceText || response?.message || 'Consulta'} ${target}`.trim();
}

function ClarificationOptions({ response, sourceText, onChoose }) {
  const options = Array.isArray(response?.options) ? response.options.slice(0, 5) : [];
  if (response?.status !== 'needs_clarification' || !options.length) return null;

  return (
    <div className="copilot-options">
      <span className="copilot-options__title">Elige la coincidencia correcta</span>
      {options.map((option, index) => (
        <button
          type="button"
          className="copilot-option"
          key={option.id || option.contactoId || option.proveedorId || option.centroId || index}
          onClick={() => onChoose(buildClarifiedText(response, option, sourceText))}
        >
          <strong>{optionTitle(option)}</strong>
          <span>{optionSubtitle(option) || option.label || 'Sin detalle adicional'}</span>
        </button>
      ))}
    </div>
  );
}

function CopilotResultEntry({
  response,
  sourceText,
  onConfirm,
  onChooseOption,
  confirmingId,
}) {
  if (!response) return null;
  const intent = response.command?.intent || '';
  const requiresConfirmation = response.status === 'needs_confirmation' && response.commandId;
  const isConfirmingThis = confirmingId === response.commandId;

  return (
    <div className={`copilot-result-entry copilot-result-entry--${response.status || 'draft'}`}>
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

      <CopilotResult response={response} />
      <ClarificationOptions response={response} sourceText={sourceText} onChoose={onChooseOption} />

      {requiresConfirmation && (
        <>
          <ConfirmationPreview command={response.command} />
          <button
            type="button"
            className="mx-btn mx-btn-primary copilot-confirm"
            onClick={() => onConfirm(response.commandId)}
            disabled={isConfirmingThis}
          >
            {isConfirmingThis ? <Loader2 size={16} className="copilot-spin" /> : <CheckCircle2 size={16} />}
            {isConfirmingThis ? 'Confirmando...' : 'Confirmar acción'}
          </button>
        </>
      )}
    </div>
  );
}

function CopilotTurn({
  turn,
  onConfirm,
  onChooseOption,
  confirmingId,
  onSpeak,
  speaking,
  speechLoading,
  voiceSupported,
}) {
  const turnStatus = deriveTurnStatus(turn.results);
  const canSpeak = voiceSupported && (turn.narrative || turn.results.length > 0);

  return (
    <section className={`copilot-response copilot-response--${turn.error && !turn.results.length ? 'rejected' : turnStatus}`}>
      <div className="copilot-response__head">
        <span className="copilot-avatar copilot-avatar--sm"><Bot size={14} /></span>
        {canSpeak && (
          <button
            type="button"
            className={`copilot-speak ${speaking ? 'is-speaking' : ''} ${speechLoading ? 'is-loading' : ''}`}
            onClick={() => onSpeak(turn)}
            title={speechLoading ? 'Generando audio...' : speaking ? 'Detener lectura' : 'Leer respuesta'}
          >
            {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {speechLoading ? 'Generando...' : speaking ? 'Detener' : 'Leer'}
          </button>
        )}
      </div>

      {turn.narrative && <p className="copilot-turn__narrative">{turn.narrative}</p>}

      {turn.results.map((response, index) => (
        <CopilotResultEntry
          key={response.commandId || `${turn.id}-${index}`}
          response={response}
          sourceText={turn.sourceText}
          onConfirm={onConfirm}
          onChooseOption={onChooseOption}
          confirmingId={confirmingId}
        />
      ))}

      {turn.streaming && (
        <div className="copilot-loading">
          <Loader2 size={15} className="copilot-spin" />
          {turn.statusMessage || 'Pensando...'}
        </div>
      )}

      {turn.error && !turn.streaming && (
        <p className="copilot-response__message copilot-turn__error">{turn.error}</p>
      )}
    </section>
  );
}

export default function CopilotPanel({ queryClient }) {
  const { addToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [confirmingId, setConfirmingId] = React.useState(null);
  const [listening, setListening] = React.useState(false);
  const [recordingProfessional, setRecordingProfessional] = React.useState(false);
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [professionalVoice, setProfessionalVoice] = React.useState({ enabled: false, checked: false });
  const [speakingId, setSpeakingId] = React.useState(null);
  const [speechLoadingId, setSpeechLoadingId] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const recognitionRef = React.useRef(null);
  const dictationBaseRef = React.useRef('');
  const mediaRecorderRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const audioPlayerRef = React.useRef(null);
  const conversationRef = React.useRef([]);
  const streamControllerRef = React.useRef(null);
  const recordingTimeoutRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
    setVoiceSupported(Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance));
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamControllerRef.current?.abort?.();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      window.speechSynthesis?.cancel?.();
    };
  }, []);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('mitynex:copilot-open', handler);
    return () => window.removeEventListener('mitynex:copilot-open', handler);
  }, []);

  React.useEffect(() => {
    if (!open || professionalVoice.checked) return;
    getCopilotVoiceStatus()
      .then((data) => setProfessionalVoice({
        enabled: Boolean(data?.voice?.enabled),
        checked: true,
        voice: data?.voice || null,
      }))
      .catch(() => setProfessionalVoice({ enabled: false, checked: true }));
  }, [open, professionalVoice.checked]);

  function refreshAppData() {
    queryClient?.invalidateQueries?.();
  }

  function pushConversationMessage(role, content) {
    const clean = String(content || '').trim();
    if (!clean) return;
    conversationRef.current = [...conversationRef.current, { role, content: clean }].slice(-MAX_CONVERSATION_MESSAGES);
  }

  function patchTurn(turnId, patchFn) {
    setHistory((prev) => prev.map((item) => (item.id === turnId ? patchFn(item) : item)));
  }

  function appendDictatedText(transcript) {
    const clean = String(transcript || '').trim();
    if (!clean) return;
    const base = dictationBaseRef.current || text.trim();
    setText([base, clean].filter(Boolean).join(' '));
  }

  async function startProfessionalRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Grabación no disponible en este navegador.');
    }

    dictationBaseRef.current = text.trim();
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const options = MediaRecorder.isTypeSupported?.('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data?.size) audioChunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      setRecordingProfessional(false);
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      try {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (!blob.size) return;
        const result = await transcribeCopilotAudio(blob);
        if (!String(result?.text || '').trim()) {
          addToast({
            type: 'warning',
            title: 'No logré entender lo que dijiste',
            message: 'Intenta hablar un poco más fuerte y cerca del micrófono, o escribe la instrucción.',
          });
          return;
        }
        appendDictatedText(result.text);
      } catch (error) {
        addToast({
          type: 'warning',
          title: 'No pude transcribir con voz profesional',
          message: error?.data?.message || error?.message || 'Probando con el dictado del navegador...',
        });
        startBrowserDictation();
      } finally {
        audioChunksRef.current = [];
      }
    };

    recorder.start();
    setRecordingProfessional(true);
    // Tope de seguridad: si se olvida tocar de nuevo para detener, no se queda
    // grabando para siempre sin transcribir nunca.
    recordingTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, MAX_RECORDING_MS);
  }

  function startBrowserDictation() {
    if (!speechSupported) {
      addToast({
        type: 'warning',
        title: 'Dictado no disponible',
        message: 'Este navegador no permite reconocimiento de voz. Puedes escribir la instrucción normalmente.',
      });
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
      appendDictatedText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function toggleDictation() {
    if (recordingProfessional) {
      mediaRecorderRef.current?.stop?.();
      return;
    }

    if (professionalVoice.enabled) {
      try {
        await startProfessionalRecording();
        return;
      } catch (error) {
        addToast({
          type: 'warning',
          title: 'Grabación profesional no disponible',
          message: error?.message || 'Intentaré usar dictado del navegador.',
        });
      }
    }

    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }

    startBrowserDictation();
  }

  function speakTurn(turn) {
    if (!voiceSupported && !professionalVoice.enabled) return;

    if (speakingId === turn.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      setSpeechLoadingId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    window.speechSynthesis.cancel();
    setSpeakingId(turn.id);

    const speechText = buildTurnSpeechText(turn);
    if (professionalVoice.enabled) {
      setSpeechLoadingId(turn.id);
      createCopilotSpeech(speechText)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioPlayerRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            audioPlayerRef.current = null;
            setSpeakingId((current) => (current === turn.id ? null : current));
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            audioPlayerRef.current = null;
            setSpeechLoadingId(null);
            fallbackBrowserSpeech(speechText, turn.id);
          };
          audio.play()
            .then(() => setSpeechLoadingId((current) => (current === turn.id ? null : current)))
            .catch(() => {
              URL.revokeObjectURL(url);
              audioPlayerRef.current = null;
              setSpeechLoadingId(null);
              fallbackBrowserSpeech(speechText, turn.id);
            });
        })
        .catch(() => {
          setSpeechLoadingId(null);
          fallbackBrowserSpeech(speechText, turn.id);
        });
      return;
    }

    fallbackBrowserSpeech(speechText, turn.id);
  }

  function fallbackBrowserSpeech(speechText, turnId) {
    if (!window.SpeechSynthesisUtterance) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'es-CL';
    utterance.rate = 1.1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId((current) => (current === turnId ? null : current));
    utterance.onerror = () => setSpeakingId((current) => (current === turnId ? null : current));

    window.speechSynthesis.speak(utterance);
  }

  async function runCommand(clean) {
    if (!clean || loading) return;

    const userId = crypto.randomUUID?.() || Date.now();
    const assistantId = crypto.randomUUID?.() || `${Date.now()}-a`;

    setHistory((prev) => [
      ...prev,
      { type: 'user', text: clean, id: userId },
      {
        type: 'assistant',
        id: assistantId,
        sourceText: clean,
        narrative: '',
        statusMessage: 'Analizando instrucción...',
        results: [],
        streaming: true,
        error: null,
      },
    ]);
    pushConversationMessage('user', clean);
    setText('');
    setLoading(true);

    const controller = new AbortController();
    streamControllerRef.current = controller;

    try {
      await streamCopilotCommand({
        text: clean,
        history: conversationRef.current,
        mode: 'draft',
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'status') {
            patchTurn(assistantId, (item) => ({ ...item, statusMessage: event.data }));
          } else if (event.type === 'narrative') {
            patchTurn(assistantId, (item) => ({ ...item, narrative: event.data }));
            pushConversationMessage('assistant', event.data);
          } else if (event.type === 'result') {
            const response = event.data;
            patchTurn(assistantId, (item) => ({ ...item, results: [...item.results, response] }));
            if (response.status === 'executed') {
              refreshAppData();
              window.dispatchEvent(new CustomEvent('mitynex:copilot-executed', { detail: response }));
              addToast({ type: 'success', title: 'Copilot ejecutó la acción', message: response.message });
            }
          } else if (event.type === 'error') {
            patchTurn(assistantId, (item) => ({ ...item, error: event.data?.message || 'Copilot no pudo completar la acción.' }));
          }
        },
      });
    } catch (error) {
      const message = error?.data?.message || error?.message || 'No se pudo procesar la solicitud.';
      patchTurn(assistantId, (item) => ({ ...item, error: item.error || message }));
      addToast({
        type: 'error',
        title: 'Copilot no pudo responder',
        message,
      });
    } finally {
      patchTurn(assistantId, (item) => ({ ...item, streaming: false, statusMessage: '' }));
      setLoading(false);
      streamControllerRef.current = null;
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    const clean = text.trim();
    await runCommand(clean);
  }

  async function handleChooseOption(clarifiedText) {
    const clean = String(clarifiedText || '').trim();
    if (!clean) return;
    await runCommand(clean);
  }

  async function handleConfirm(commandId) {
    if (!commandId || confirmingId) return;
    setConfirmingId(commandId);

    const assistantId = crypto.randomUUID?.() || `${Date.now()}-c`;
    setHistory((prev) => [
      ...prev,
      {
        type: 'assistant',
        id: assistantId,
        sourceText: '',
        narrative: '',
        statusMessage: 'Ejecutando acción confirmada...',
        results: [],
        streaming: true,
        error: null,
      },
    ]);

    try {
      await streamCopilotCommand({
        mode: 'confirm',
        commandId,
        history: conversationRef.current,
        onEvent: (event) => {
          if (event.type === 'status') {
            patchTurn(assistantId, (item) => ({ ...item, statusMessage: event.data }));
          } else if (event.type === 'result') {
            const response = event.data;
            patchTurn(assistantId, (item) => ({ ...item, results: [...item.results, response] }));
            addToast({ type: 'success', title: 'Acción confirmada', message: response.message });
            refreshAppData();
            window.dispatchEvent(new CustomEvent('mitynex:copilot-executed', { detail: response }));
          } else if (event.type === 'error') {
            patchTurn(assistantId, (item) => ({ ...item, error: event.data?.message || 'No se pudo confirmar la acción.' }));
          }
        },
      });
    } catch (error) {
      const message = error?.data?.message || error?.message || 'El comando pudo expirar o cambiar de contexto.';
      patchTurn(assistantId, (item) => ({ ...item, error: item.error || message }));
      addToast({
        type: 'error',
        title: 'No se pudo confirmar',
        message,
      });
    } finally {
      patchTurn(assistantId, (item) => ({ ...item, streaming: false, statusMessage: '' }));
      setConfirmingId(null);
    }
  }

  function reset() {
    streamControllerRef.current?.abort?.();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    window.speechSynthesis?.cancel?.();
    setSpeakingId(null);
    setSpeechLoadingId(null);
    setHistory([]);
    setText('');
    conversationRef.current = [];
  }

  return (
    <>
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
                      <CopilotTurn
                        key={item.id}
                        turn={item}
                        onConfirm={handleConfirm}
                        onChooseOption={handleChooseOption}
                        confirmingId={confirmingId}
                        onSpeak={speakTurn}
                        speaking={speakingId === item.id}
                        speechLoading={speechLoadingId === item.id}
                        voiceSupported={voiceSupported || professionalVoice.enabled}
                      />
                    )
                  ))}
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
                  className={`mx-btn mx-btn-outline copilot-dictate ${listening || recordingProfessional ? 'is-listening' : ''}`}
                  onClick={toggleDictation}
                  title={professionalVoice.enabled ? 'Dictar con voz profesional' : speechSupported ? 'Dictar instrucción' : 'Dictado no disponible en este navegador'}
                >
                  {listening || recordingProfessional ? <MicOff size={16} /> : <Mic size={16} />}
                  {recordingProfessional ? 'Grabando...' : listening ? 'Escuchando...' : 'Dictar'}
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
