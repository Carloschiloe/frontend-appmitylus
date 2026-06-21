import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  HelpCircle,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  helpFaqs,
  helpPageContent,
  quickActions,
  guidedFlows,
} from './helpContent.js';
import { mitynexTours, primaryTourIds, toursPageContent } from './toursContent.js';
import './ayuda.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ICON_MAP = {
  handshake: FileText,
  flask:     FlaskConical,
  calendar:  CalendarDays,
  history:   Clock3,
  bug:       AlertCircle,
};

const ACTION_COLORS = {
  handshake: { color: '#0A5CFF', bg: 'rgba(10,92,255,0.09)' },
  flask:     { color: '#7c3aed', bg: 'rgba(124,58,237,0.09)' },
  calendar:  { color: '#16a34a', bg: 'rgba(22,163,74,0.09)' },
  history:   { color: '#0891b2', bg: 'rgba(8,145,178,0.09)' },
  bug:       { color: '#dc2626', bg: 'rgba(220,38,38,0.09)' },
};

// ── Module mini-screen data for animations ─────────────────────────────────
const ANIM_DATA = {
  tratos: {
    rows: [
      { name: 'Proveedor A', badge: 'Acordado', bc: '#0891b2' },
      { name: 'Proveedor B', badge: 'Activo',   bc: '#16a34a' },
      { name: 'Proveedor C', badge: 'Pausado',  bc: '#d97706' },
    ],
  },
  muestreos: {
    fields: [
      { label: 'Proveedor',    value: 'Mar Austral' },
      { label: 'U/Kg',         value: '14.2' },
      { label: 'Rendimiento',  value: '68%' },
    ],
  },
  biomasa: {
    days: [
      { d: 'L', on: false },
      { d: 'M', on: true  },
      { d: 'M', on: true  },
      { d: 'J', on: false },
      { d: 'V', on: true  },
      { d: 'S', on: true  },
    ],
  },
  historial: {
    events: [
      { label: 'Trato registrado',     time: '09:42' },
      { label: 'Muestreo guardado',    time: '11:15' },
      { label: 'Programa actualizado', time: 'Ayer'  },
    ],
  },
};

function ModuleAnim({ moduleId, color }) {
  const data = ANIM_DATA[moduleId];
  if (!data) return null;

  const titles = {
    tratos:    'Tratos',
    muestreos: 'Nuevo muestreo',
    biomasa:   'Prog. de Cosecha',
    historial: 'Historial',
  };

  return (
    <div className={`ma ma-${moduleId}`} aria-hidden="true">
      <div className="ma-bar">
        <span className="ma-dots"><i /><i /><i /></span>
        <span className="ma-screen-name">{titles[moduleId]}</span>
        {moduleId === 'tratos' && (
          <span className="ma-regbtn" style={{ background: color }}>+ Registrar</span>
        )}
      </div>

      {moduleId === 'tratos' && (
        <div className="ma-body">
          {data.rows.map((r, i) => (
            <div key={i} className="ma-row">
              <span className="ma-ava" style={{ background: color + '22', color }} />
              <span className="ma-nm">{r.name}</span>
              <span className="ma-ch" style={{ background: r.bc + '1a', color: r.bc }}>{r.badge}</span>
            </div>
          ))}
        </div>
      )}

      {moduleId === 'muestreos' && (
        <div className="ma-body">
          {data.fields.map((f, i) => (
            <div key={i} className="ma-fld">
              <span className="ma-fld-lbl">{f.label}</span>
              <div className="ma-fld-inp">
                <span className="ma-fld-val" style={{ color }}>{f.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {moduleId === 'biomasa' && (
        <div className="ma-body ma-body-cal">
          <div className="ma-cal">
            {data.days.map((d2, i) => (
              <div key={i} className={`ma-cday ${d2.on ? 'on' : ''}`} style={{ '--c': color }}>
                {d2.d}
              </div>
            ))}
          </div>
          <div className="ma-prog"><div className="ma-prog-fill" style={{ '--c': color }} /></div>
          <div className="ma-calstat" style={{ color }}>
            <span className="ma-stat-n">42</span><span className="ma-stat-l"> camiones</span>
            <span className="ma-stat-sep">·</span>
            <span className="ma-stat-n">1.260</span><span className="ma-stat-l"> ton.</span>
          </div>
        </div>
      )}

      {moduleId === 'historial' && (
        <div className="ma-body">
          {data.events.map((e, i) => (
            <div key={i} className="ma-ev">
              <span className="ma-ev-dot" style={{ '--c': color }} />
              <span className="ma-ev-lbl">{e.label}</span>
              <span className="ma-ev-time">{e.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TOUR_META = {
  tratos:    { icon: FileText,     color: '#0A5CFF', bg: 'rgba(10,92,255,0.10)' },
  muestreos: { icon: FlaskConical, color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  biomasa:   { icon: CalendarDays, color: '#16a34a', bg: 'rgba(22,163,74,0.10)' },
  historial: { icon: Clock3,       color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  soporte:   { icon: AlertCircle,  color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function QuickActionCard({ action }) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[action.icon] || Zap;
  const palette = ACTION_COLORS[action.icon] || ACTION_COLORS.handshake;

  const handleClick = () => {
    if (action.route) {
      navigate(action.route);
    } else if (action.action === 'support-report') {
      window.dispatchEvent(new CustomEvent('mitynex:open-support-report'));
    }
  };

  return (
    <button type="button" className="ayuda-qa-card" onClick={handleClick}>
      <div className="ayuda-qa-icon" style={{ background: palette.bg, color: palette.color }}>
        <Icon size={18} />
      </div>
      <div className="ayuda-qa-copy">
        <strong>{action.title}</strong>
        <span>{action.description}</span>
      </div>
      <ChevronRight size={15} className="ayuda-qa-arrow" />
    </button>
  );
}

function GuidedFlowCard({ flow, isOpen, onToggle }) {
  const [activeStep, setActiveStep] = useState(0);
  const Icon = ICON_MAP[flow.icon] || BookOpen;
  const palette = ACTION_COLORS[flow.icon] || ACTION_COLORS.handshake;

  useEffect(() => {
    if (!isOpen) { setActiveStep(0); return; }
    const t = setInterval(() => setActiveStep((s) => (s + 1) % flow.steps.length), 2600);
    return () => clearInterval(t);
  }, [isOpen, flow.steps.length]);

  const handleAction = () => {
    if (flow.action === 'support-report') {
      window.dispatchEvent(new CustomEvent('mitynex:open-support-report'));
    }
  };

  return (
    <div className={`ayuda-flow-card ${isOpen ? 'is-open' : ''}`}>
      <button type="button" className="ayuda-flow-card-header" onClick={onToggle}>
        <div className="ayuda-flow-card-icon" style={{ background: palette.bg, color: palette.color }}>
          <Icon size={18} />
        </div>
        <div className="ayuda-flow-card-copy">
          <strong>{flow.title}</strong>
          <span>{flow.description}</span>
        </div>
        <span className="ayuda-flow-card-steps-badge">{flow.steps.length}</span>
        <ChevronDown size={16} className="ayuda-flow-card-chevron" />
      </button>

      {isOpen && (
        <div className="ayuda-flow-card-body">
          {/* Stepper dots */}
          <div className="afc-stepper">
            {flow.steps.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`afc-dot ${i === activeStep ? 'active' : i < activeStep ? 'past' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveStep(i); }}
              />
            ))}
            <span className="afc-counter">Paso {activeStep + 1} / {flow.steps.length}</span>
          </div>

          <ol className="ayuda-steps-list">
            {flow.steps.map((step, i) => (
              <li
                key={i}
                className={`ayuda-step-item ${i === activeStep ? 'is-active' : ''}`}
                onClick={() => setActiveStep(i)}
              >
                <span className="ayuda-step-num">{i + 1}</span>
                <div className="ayuda-step-copy">
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {flow.route ? (
            <Link to={flow.route} className="ayuda-flow-card-cta">
              Ir al módulo <ArrowRight size={13} />
            </Link>
          ) : flow.action ? (
            <button type="button" className="ayuda-flow-card-cta" onClick={handleAction}>
              {flow.actionLabel || 'Abrir'} <ArrowRight size={13} />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Ayuda() {
  const [search,     setSearch]     = useState('');
  const [openFlowId, setOpenFlowId] = useState(null);

  const normalizedSearch = normalize(search.trim());

  const tours = useMemo(() =>
    primaryTourIds
      .map((id) => mitynexTours[id])
      .filter((t) => t && (!normalizedSearch || normalize(`${t.title} ${t.summary}`).includes(normalizedSearch))),
    [normalizedSearch]
  );

  const flows = useMemo(() =>
    guidedFlows.filter((f) =>
      f.id !== 'reportar-problema' && (
        !normalizedSearch ||
        normalize(`${f.title} ${f.description} ${f.keywords?.join(' ') || ''}`).includes(normalizedSearch)
      )
    ),
    [normalizedSearch]
  );

  const actions = useMemo(() =>
    quickActions.filter((a) =>
      a.id !== 'reportar-problema' && (
        !normalizedSearch || normalize(`${a.title} ${a.description}`).includes(normalizedSearch)
      )
    ),
    [normalizedSearch]
  );

  const faqs = useMemo(() =>
    helpFaqs.filter((f) =>
      !normalizedSearch || normalize(`${f.question} ${f.answer}`).includes(normalizedSearch)
    ),
    [normalizedSearch]
  );

  const hasResults = tours.length || flows.length || actions.length || faqs.length;

  const toggleFlow = (id) => setOpenFlowId((prev) => (prev === id ? null : id));

  return (
    <div className="mx-page ayuda-page">

      {/* ── Hero compacto ── */}
      <header className="ayuda-hero">
        <div className="ayuda-hero-glow" />
        <div className="ayuda-hero-inner">
          <span className="ayuda-eyebrow"><Sparkles size={13} /> {toursPageContent.eyebrow}</span>
          <h1>{toursPageContent.title}</h1>
          <p>{toursPageContent.subtitle}</p>
        </div>
        <label className="ayuda-hero-search">
          <Search size={19} />
          <span className="sr-only">{helpPageContent.searchLabel}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={helpPageContent.searchPlaceholder}
            autoComplete="off"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="ayuda-search-clear">
              {helpPageContent.clearSearchLabel}
            </button>
          )}
        </label>
      </header>

      <div className="mx-content-frame ayuda-content">
        {/* ── Reportar problema — siempre visible, separado ── */}
        <div className="ayuda-report-zone">
          <div className="ayuda-report-icon">
            <AlertCircle size={22} />
          </div>
          <div className="ayuda-report-copy">
            <strong>¿Encontraste un problema?</strong>
            <p>Envíanos el contexto y lo revisamos. El sistema adjunta información técnica automáticamente.</p>
          </div>
          <button
            type="button"
            className="ayuda-report-cta"
            onClick={() => window.dispatchEvent(new CustomEvent('mitynex:open-support-report'))}
          >
            Reportar problema
          </button>
        </div>

        {!hasResults ? (
          <section className="ayuda-empty">
            <Search size={28} />
            <h2>{helpPageContent.noResultsTitle}</h2>
            <p>{helpPageContent.noResultsText}</p>
            <button type="button" onClick={() => setSearch('')}>{helpPageContent.clearSearchLabel}</button>
          </section>
        ) : (
          <>
            {/* ── Acciones rápidas ── */}
            {actions.length > 0 && (
              <section>
                <div className="ayuda-heading">
                  <div>
                    <h2><Zap size={16} /> Acciones rápidas</h2>
                    <p>Atajos directos a las tareas más frecuentes de la plataforma.</p>
                  </div>
                </div>
                <div className="ayuda-qa-grid">
                  {actions.map((action) => (
                    <QuickActionCard key={action.id} action={action} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Guías paso a paso ── */}
            {flows.length > 0 && (
              <section>
                <div className="ayuda-heading">
                  <div>
                    <h2><BookOpen size={16} /> Guías paso a paso</h2>
                    <p>Abre cualquier guía y sigue los pasos sin salir de esta pantalla.</p>
                  </div>
                </div>
                <div className="ayuda-flows-grid">
                  {flows.map((flow) => (
                    <GuidedFlowCard
                      key={flow.id}
                      flow={flow}
                      isOpen={openFlowId === flow.id}
                      onToggle={() => toggleFlow(flow.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Tours interactivos ── */}
            {tours.length > 0 && (
              <section>
                <div className="ayuda-heading">
                  <div>
                    <h2><CheckCircle2 size={16} /> {toursPageContent.toursTitle}</h2>
                    <p>{toursPageContent.toursSubtitle}</p>
                  </div>
                </div>
                <div className="ayuda-tour-grid">
                  {tours.map((tour) => {
                    const meta = TOUR_META[tour.id] || TOUR_META.tratos;
                    const Icon = meta.icon;
                    return (
                      <Link key={tour.id} to={tour.route} className="ayuda-tour-card" style={{ '--tour-color': meta.color, '--tour-bg': meta.bg }}>
                        <ModuleAnim moduleId={tour.id} color={meta.color} />
                        <div className="ayuda-tour-card-footer">
                          <div className="ayuda-tour-card-icon" style={{ background: meta.bg, color: meta.color }}>
                            <Icon size={18} />
                          </div>
                          <div className="ayuda-tour-card-copy">
                            <h3>{tour.title}</h3>
                            <p>{tour.summary}</p>
                          </div>
                          <span className="ayuda-tour-card-link" style={{ background: meta.color }}>
                            {toursPageContent.goToModuleLabel} <ArrowRight size={13} />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Preguntas frecuentes ── */}
            {faqs.length > 0 && (
              <section>
                <div className="ayuda-heading">
                  <h2><HelpCircle size={16} /> {helpPageContent.faqTitle}</h2>
                </div>
                <div className="ayuda-faq-list">
                  {faqs.map((faq) => (
                    <details key={faq.id} className="ayuda-faq">
                      <summary>
                        {faq.question}
                        <ChevronDown size={17} />
                      </summary>
                      <div className="ayuda-faq-body">
                        <p>{faq.answer}</p>
                        {faq.relatedSectionId && (
                          <span className="ayuda-faq-tag">
                            Módulo: {faq.relatedSectionId.replace(/-/g, ' ')}
                          </span>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
