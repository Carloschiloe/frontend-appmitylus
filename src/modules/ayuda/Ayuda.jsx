import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Compass, Search, Sparkles } from 'lucide-react';
import { helpFaqs, helpPageContent } from './helpContent.js';
import { mitynexTours, primaryTourIds, toursPageContent } from './toursContent.js';
import './ayuda.css';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function Ayuda() {
  const [search, setSearch] = useState('');
  const normalizedSearch = normalize(search.trim());

  const tours = useMemo(() => primaryTourIds
    .map((id) => mitynexTours[id])
    .filter((tour) => !normalizedSearch || normalize(`${tour.title} ${tour.summary}`).includes(normalizedSearch)), [normalizedSearch]);

  const faqs = useMemo(() => helpFaqs.filter((faq) => (
    !normalizedSearch || normalize(`${faq.question} ${faq.answer}`).includes(normalizedSearch)
  )), [normalizedSearch]);

  return (
    <div className="mx-page ayuda-page">
      <header className="ayuda-hero">
        <div className="ayuda-hero-glow" />
        <div className="ayuda-hero-copy">
          <span className="ayuda-eyebrow"><Sparkles size={15} /> {toursPageContent.eyebrow}</span>
          <h1>{toursPageContent.title}</h1>
          <p>{toursPageContent.subtitle}</p>
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
        {tours.length > 0 && (
          <section>
            <div className="ayuda-heading">
              <div>
                <h2>{toursPageContent.toursTitle}</h2>
                <p>{toursPageContent.toursSubtitle}</p>
              </div>
            </div>
            <div className="ayuda-tour-grid">
              {tours.map((tour) => (
                <article key={tour.id} className="ayuda-tour-card">
                  <div className="ayuda-tour-card-icon"><Compass size={21} /></div>
                  <div><h3>{tour.title}</h3><p>{tour.summary}</p></div>
                  <Link to={tour.route}>{toursPageContent.goToModuleLabel} <ArrowRight size={14} /></Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {faqs.length > 0 && (
          <section>
            <div className="ayuda-heading"><h2>{helpPageContent.faqTitle}</h2></div>
            <div className="ayuda-faq-list">
              {faqs.map((faq) => (
                <details key={faq.id} className="ayuda-faq">
                  <summary>{faq.question}<ChevronDown size={18} /></summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {!tours.length && !faqs.length && (
          <section className="ayuda-empty">
            <Search size={30} />
            <h2>{helpPageContent.noResultsTitle}</h2>
            <p>{helpPageContent.noResultsText}</p>
            <button type="button" onClick={() => setSearch('')}>{helpPageContent.clearSearchLabel}</button>
          </section>
        )}
      </div>
    </div>
  );
}
