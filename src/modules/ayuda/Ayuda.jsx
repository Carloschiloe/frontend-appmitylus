import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ExternalLink,
  Lightbulb,
  ListChecks,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  helpFaqs,
  helpPageContent,
  helpQuickActions,
  helpSections,
} from './helpContent.js';
import './ayuda.css';

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sectionSearchText(section) {
  return normalizeSearchText([
    section.title,
    section.summary,
    ...section.whatYouCanDo,
    ...section.steps,
    ...section.tips,
    ...section.relatedFeatures,
  ].join(' '));
}

export default function Ayuda() {
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [openSections, setOpenSections] = useState({});
  const normalizedSearch = normalizeSearchText(search.trim());

  const filteredSections = useMemo(() => helpSections.filter((section) => {
    const matchesModule = selectedSection === 'all' || section.id === selectedSection;
    return matchesModule && (!normalizedSearch || sectionSearchText(section).includes(normalizedSearch));
  }), [normalizedSearch, selectedSection]);

  const filteredFaqs = useMemo(() => helpFaqs.filter((faq) => {
    const matchesModule = selectedSection === 'all' || faq.relatedSectionId === selectedSection;
    const matchesSearch = !normalizedSearch || normalizeSearchText(`${faq.question} ${faq.answer}`).includes(normalizedSearch);
    return matchesModule && matchesSearch;
  }), [normalizedSearch, selectedSection]);

  const toggleSection = (id) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedSection('all');
  };

  const runQuickAction = (action) => {
    if (action.action === 'support-report') {
      window.dispatchEvent(new CustomEvent('mitynex:open-support-report'));
    }
  };

  const hasResults = filteredSections.length > 0 || filteredFaqs.length > 0;

  return (
    <div className="mx-page ayuda-page">
      <header className="mx-hero ayuda-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{helpPageContent.eyebrow}</p>
          <h1>{helpPageContent.title}</h1>
          <p>{helpPageContent.subtitle}</p>
        </div>
        <BookOpen size={52} aria-hidden="true" />
      </header>

      <div className="mx-content-frame ayuda-content">
        <section className="ayuda-toolbar" aria-label={helpPageContent.moduleFilterLabel}>
          <label className="ayuda-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={helpPageContent.searchPlaceholder}
            />
          </label>
          <label className="ayuda-filter">
            <span>{helpPageContent.moduleFilterLabel}</span>
            <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>
              <option value="all">{helpPageContent.allModulesLabel}</option>
              {helpSections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <div className="ayuda-section-heading">
            <div>
              <p className="ayuda-kicker"><Sparkles size={15} /> {helpPageContent.quickActionsTitle}</p>
            </div>
          </div>
          <div className="ayuda-quick-grid">
            {helpQuickActions.map((action) => {
              const content = (
                <>
                  <div>
                    <strong>{action.label}</strong>
                    <span>{action.description}</span>
                  </div>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              );

              return action.route ? (
                <Link key={action.id} to={action.route} className="ayuda-quick-action">{content}</Link>
              ) : (
                <button key={action.id} type="button" className="ayuda-quick-action" onClick={() => runQuickAction(action)}>
                  {content}
                </button>
              );
            })}
          </div>
        </section>

        {hasResults ? (
          <>
            {filteredSections.length > 0 && (
              <section>
                <div className="ayuda-section-heading">
                  <div>
                    <h2>{helpPageContent.modulesTitle}</h2>
                    <p>{helpPageContent.modulesSubtitle}</p>
                  </div>
                </div>
                <div className="ayuda-card-grid">
                  {filteredSections.map((section) => {
                    const isOpen = Boolean(openSections[section.id]);
                    return (
                      <article key={section.id} id={`ayuda-${section.id}`} className="mx-card ayuda-card">
                        <div className="ayuda-card-top">
                          <div className="ayuda-card-icon"><BookOpen size={20} /></div>
                          <span className="ayuda-updated">
                            <CalendarClock size={14} />
                            {helpPageContent.lastUpdatedLabel}: {section.lastUpdated}
                          </span>
                        </div>
                        <h3>{section.title}</h3>
                        <p className="ayuda-summary">{section.summary}</p>
                        <div className="ayuda-tags">
                          {section.relatedFeatures.map((feature) => <span key={feature}>{feature}</span>)}
                        </div>

                        {isOpen && (
                          <div className="ayuda-details">
                            <div>
                              <h4><CircleHelp size={17} /> {helpPageContent.whatYouCanDoLabel}</h4>
                              <ul>{section.whatYouCanDo.map((item) => <li key={item}>{item}</li>)}</ul>
                            </div>
                            <div>
                              <h4><ListChecks size={17} /> {helpPageContent.stepsLabel}</h4>
                              <ol>{section.steps.map((item) => <li key={item}>{item}</li>)}</ol>
                            </div>
                            <div className="ayuda-tips">
                              <h4><Lightbulb size={17} /> {helpPageContent.tipsLabel}</h4>
                              <ul>{section.tips.map((item) => <li key={item}>{item}</li>)}</ul>
                            </div>
                          </div>
                        )}

                        <div className="ayuda-card-actions">
                          <button type="button" className="mx-btn mx-btn-outline" onClick={() => toggleSection(section.id)}>
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {isOpen ? helpPageContent.hideDetailsLabel : helpPageContent.showDetailsLabel}
                          </button>
                          {section.route && (
                            <Link to={section.route} className="mx-btn mx-btn-primary">
                              {helpPageContent.goToModuleLabel}
                              <ExternalLink size={15} />
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {filteredFaqs.length > 0 && (
              <section className="ayuda-faq-section">
                <div className="ayuda-section-heading">
                  <h2>{helpPageContent.faqTitle}</h2>
                </div>
                <div className="ayuda-faq-list">
                  {filteredFaqs.map((faq) => (
                    <details key={faq.id} className="mx-card ayuda-faq">
                      <summary>{faq.question}<ChevronDown size={18} /></summary>
                      <p>{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="mx-card ayuda-empty">
            <Search size={28} />
            <h2>{helpPageContent.noResultsTitle}</h2>
            <p>{helpPageContent.noResultsText}</p>
            <button type="button" className="mx-btn mx-btn-primary" onClick={clearFilters}>
              {helpPageContent.clearSearchLabel}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
