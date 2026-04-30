import React, { useState, useEffect } from 'react';
import Biomasa from './modules/biomasa/Biomasa.jsx';

const PAGES = { biomasa: Biomasa };

export default function App() {
  const [page, setPage] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return Object.prototype.hasOwnProperty.call(PAGES, h) ? h : null;
  });

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      setPage(Object.prototype.hasOwnProperty.call(PAGES, h) ? h : null);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
      document.querySelectorAll('.content, .bio-main, .bio-panel, .bio-table-wrap').forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    };
    reset();
    const raf = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(raf);
  }, [page]);

  const Page = page ? PAGES[page] : null;
  if (!Page) return null;
  return <Page />;
}
