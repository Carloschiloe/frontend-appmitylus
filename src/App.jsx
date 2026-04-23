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

  const Page = page ? PAGES[page] : null;
  if (!Page) return null;
  return <Page />;
}
