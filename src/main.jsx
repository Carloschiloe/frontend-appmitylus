import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Estilos Globales (Pipeline de Vite)
import './styles/tokens.css';
import './styles/base-ui.css';
import './styles/mitynex-brand.css';
import './index.css';
import './styles/enterprise-polish.css';

import ErrorBoundary from './components/ErrorBoundary.jsx';

// Indicador de build: permite verificar qué commit corre en el navegador.
window.__MITYNEX_BUILD__ = __MITYNEX_COMMIT__;
console.info('Mitynex frontend build:', __MITYNEX_COMMIT__);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
