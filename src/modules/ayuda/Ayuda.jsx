import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Bug,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FlaskConical,
  Handshake,
  History,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  assistantPrompts,
  guidedFlows,
  helpFaqs,
  helpPageContent,
  helpSections,
  quickActions,
  visualHints,
} from './helpContent.js';
import './ayuda.css';

const ICONS = {
  bug: Bug,
  calendar: CalendarDays,
  flask: FlaskConical,
  handshake: Handshake,
  history: History,
};

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function includesSearch(values, search) {
  return !search || normalize(values.flat(Infinity).join(' ')).includes(search);
}

function VisualHint({ step, fallbackIcon }) {
  if (step.image) {
    return <img className="ayuda-tutorial-image" src={step.image} alt="" />;
  }

  const hint = visualHints[step.visualHint];
  if (!hint) {
    return <div className="ayuda-tutorial-fallback">{React.createElement(fallbackIcon, { size: 38 })}</div>;
  }

  return (
    <div className={`ayuda-tutorial-mock ayuda-tutorial-mock--${hint.type}`}>
      <div className="ayuda-tutorial-window-bar"><i /><i /><i /><span>{hint.eyebrow}</span></div>

      {hint.type === 'sidebar' && (
        <div className="ayuda-mock-sidebar">
          <div className="ayuda-mock-brand" />
          {hint.items.map((item) => <span key={item} className={item === hint.active ? 'is-active' : ''}>{item}</span>)}
        </div>
      )}
      {hint.type === 'module' && (
        <div className="ayuda-mock-module"><BookOpen size={25} /><div><strong>{hint.title}</strong><span>{hint.detail}</span></div></div>
      )}
      {hint.type === 'button' && (
        <div className="ayuda-mock-centered"><button type="button" tabIndex="-1">{hint.label}</button></div>
      )}
      {hint.type === 'form' && (
        <div className="ayuda-mock-form">{hint.fields.map((field) => <label key={field}><span>{field}</span><i /></label>)}</div>
      )}
      {hint.type === 'summary' && (
        <div className="ayuda-mock-summary">{hint.metrics.map((metric) => <span key={metric}><i />{metric}</span>)}</div>
      )}
      {hint.type === 'calendar' && (
        <div className="ayuda-mock-calendar"><div>{hint.days.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><strong>{hint.detail}</strong></div>
      )}
      {hint.type === 'upload' && (
        <div className="ayuda-mock-upload"><span>+</span><strong>{hint.label}</strong></div>
      )}
      {hint.type === 'search' && (
        <div className="ayuda-mock-search"><Search size={17} /><span>{hint.label}</span></div>
      )}
      {hint.type === 'timeline' && (
        <div className="ayuda-mock-timeline">{hint.items.map((item) => <span key={item}><i />{item}</span>)}</div>
      )}
      {hint.type === 'chips' && (
        <div className="ayuda-mock-chips">{hint.items.map((item) => <span key={item}>{item}</span>)}</div>
      )}
      {hint.type === 'actions' && (
        <div className="ayuda-mock-actions">{hint.items.map((item) => <button key={item} type="button" tabIndex="-1">{item}</button>)}</div>
      )}
    </div>
  );
}

export default function Ayuda() {
  const [search, setSearch] = useState('');
  const [activeFlowId, setActiveFlowId] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const guideRef = useRef(null);
  const faqRef = useRef(null);
  const normalizedSearch = normalize(search.trim());

  const filteredActions = useMemo(() => quickActions.filter((item) => (
    includesSearch([item.title, item.description], normalizedSearch)
  )), [normalizedSearch]);
  const filteredFlows = useMemo(() => guidedFlows.filter((item) => (
    includesSearch([item.title, item.description, item.keywords, item.steps.map((step) => [step.title, step.text])], normalizedSearch)
  )), [normalizedSearch]);
  const filteredSections = useMemo(() => helpSections.filter((item) => (
    includesSearch([item.title, item.summary, item.whatYouCanDo, item.relatedFeatures], normalizedSearch)
  )), [normalizedSearch]);
  const filteredFaqs = useMemo(() => helpFaqs.filter((item) => (
    includesSearch([item.question, item.answer], normalizedSearch)
  )), [normalizedSearch]);
  const activeFlow = guidedFlows.find((flow) => flow.id === activeFlowId);
  const hasResults = filteredActions.length || filteredFlows.length || filteredSections.length || filteredFaqs.length;

  const openGuide = (flowId) => {
    setActiveFlowId(flowId);
    setActiveStep(0);
    window.setTimeout(() => guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const runAction = (action) => {
    if (action === 'support-report') {
      window.dispatchEvent(new CustomEvent('mitynex:open-support-report'));
    }
  };

  const selectPrompt = (prompt) => {
    if (prompt.guidedFlowId) {
      openGuide(prompt.guidedFlowId);
      return;
    }
    const faq = helpFaqs.find((item) => item.id === prompt.faqId);
    setSearch(faq?.question || prompt.label);
    window.setTimeout(() => faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  return (
    <div className="mx-page ayuda-page">
      <header className="ayuda-hero">
        <div className="ayuda-hero-glow" />
        <div className="ayuda-hero-copy">
          <span className="ayuda-eyebrow"><Sparkles size={15} /> {helpPageContent.eyebrow}</span>
          <h1>{helpPageContent.title}</h1>
          <p>{helpPageContent.subtitle}</p>
        </div>
        <label className="ayuda-hero-search">
          <Search size={21} />
          <span className="sr-only">{helpPageContent.searchLabel}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={helpPageContent.searchPlaceholder}
          />
          {search && <button type="button" onClick={() => setSearch('')}>{helpPageContent.clearSearchLabel}</button>}
        </label>
      </header>

      <div className="mx-content-frame ayuda-content">
        {hasResults ? (
          <>
            {filteredActions.length > 0 && (
              <section>
                <div className="ayuda-heading">
                  <div><h2>{helpPageContent.quickActionsTitle}</h2><p>{helpPageContent.quickActionsSubtitle}</p></div>
                </div>
                <div className="ayuda-action-grid">
                  {filteredActions.map((action) => {
                    const Icon = ICONS[action.icon] || BookOpen;
                    return (
                      <article key={action.id} className="ayuda-action-card">
                        <div className="ayuda-action-icon"><Icon size={20} /></div>
                        <div className="ayuda-action-copy"><h3>{action.title}</h3><p>{action.description}</p></div>
                        <div className="ayuda-action-buttons">
                          <button type="button" onClick={() => openGuide(action.guidedFlowId)}>{helpPageContent.viewStepsLabel}</button>
                          {action.route ? (
                            <Link to={action.route}>{helpPageContent.goToModuleLabel}<ArrowRight size={14} /></Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {filteredFlows.length > 0 && (
              <section ref={guideRef}>
                <div className="ayuda-heading">
                  <div><h2>{helpPageContent.guidedFlowsTitle}</h2><p>{helpPageContent.guidedFlowsSubtitle}</p></div>
                </div>
                <div className="ayuda-flow-layout">
                  <div className="ayuda-flow-list">
                    {filteredFlows.map((flow) => {
                      const Icon = ICONS[flow.icon] || BookOpen;
                      return (
                        <button key={flow.id} type="button" className={activeFlowId === flow.id ? 'is-active' : ''} onClick={() => openGuide(flow.id)}>
                          <span><Icon size={18} /></span><span><strong>{flow.title}</strong><small>{flow.description}</small></span><ArrowRight size={16} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="ayuda-flow-stage">
                    {activeFlow ? (
                      <>
                        <div className="ayuda-flow-progress">
                          <span>{helpPageContent.stepLabel} {activeStep + 1} {helpPageContent.ofLabel} {activeFlow.steps.length}</span>
                          <div><i style={{ width: `${((activeStep + 1) / activeFlow.steps.length) * 100}%` }} /></div>
                        </div>
                        <div className="ayuda-flow-visual">
                          <VisualHint step={activeFlow.steps[activeStep]} fallbackIcon={ICONS[activeFlow.icon] || BookOpen} />
                        </div>
                        <div className="ayuda-flow-step-copy">
                          <div>
                            <h3>{activeFlow.steps[activeStep].title}</h3>
                            <p>{activeFlow.steps[activeStep].text}</p>
                          </div>
                          {activeFlow.route && <Link to={activeFlow.route}>{helpPageContent.goToModuleLabel}<ExternalLink size={14} /></Link>}
                        </div>
                        <div className="ayuda-flow-controls">
                          <button type="button" disabled={activeStep === 0} onClick={() => setActiveStep((step) => step - 1)}><ArrowLeft size={15} />{helpPageContent.previousLabel}</button>
                          {activeStep < activeFlow.steps.length - 1 ? (
                            <button type="button" onClick={() => setActiveStep((step) => step + 1)}>{helpPageContent.nextLabel}<ArrowRight size={15} /></button>
                          ) : !activeFlow.route ? (
                            <button type="button" onClick={() => runAction(activeFlow.action)}>{activeFlow.actionLabel}<ArrowRight size={15} /></button>
                          ) : <span />}
                        </div>
                      </>
                    ) : (
                      <div className="ayuda-flow-placeholder"><BookOpen size={36} /><h3>{helpPageContent.guidedFlowsTitle}</h3><p>{helpPageContent.guidedFlowsSubtitle}</p></div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="ayuda-assistant">
              <div className="ayuda-assistant-icon"><Bot size={28} /></div>
              <div className="ayuda-assistant-copy">
                <span>{helpPageContent.assistantBadge}</span>
                <h2>{helpPageContent.assistantTitle}</h2>
                <p>{helpPageContent.assistantText}</p>
                <div className="ayuda-prompt-list">
                  {assistantPrompts.map((prompt) => <button key={prompt.id} type="button" onClick={() => selectPrompt(prompt)}>{prompt.label}</button>)}
                </div>
              </div>
            </section>

            {filteredSections.length > 0 && (
              <section>
                <div className="ayuda-heading"><div><h2>{helpPageContent.modulesTitle}</h2><p>{helpPageContent.modulesSubtitle}</p></div></div>
                <div className="ayuda-module-grid">
                  {filteredSections.map((section) => (
                    <article key={section.id} className="ayuda-module-card">
                      <div><BookOpen size={17} /><span>{helpPageContent.lastUpdatedLabel} {section.lastUpdated}</span></div>
                      <h3>{section.title}</h3><p>{section.summary}</p>
                      {section.route && <Link to={section.route}>{helpPageContent.exploreModuleLabel}<ArrowRight size={14} /></Link>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {filteredFaqs.length > 0 && (
              <section ref={faqRef}>
                <div className="ayuda-heading"><h2>{helpPageContent.faqTitle}</h2></div>
                <div className="ayuda-faq-list">
                  {filteredFaqs.map((faq) => <details key={faq.id} className="ayuda-faq"><summary>{faq.question}<ChevronDown size={18} /></summary><p>{faq.answer}</p></details>)}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="ayuda-empty"><Search size={30} /><h2>{helpPageContent.noResultsTitle}</h2><p>{helpPageContent.noResultsText}</p><button type="button" onClick={() => setSearch('')}>{helpPageContent.clearSearchLabel}</button></section>
        )}
      </div>
    </div>
  );
}
