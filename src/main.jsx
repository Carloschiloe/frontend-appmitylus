import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Estilos Globales (Pipeline de Vite)
import './styles/tokens.css';
import './styles/base-ui.css';
import './styles/mitynex-brand.css';
import './index.css';

import ErrorBoundary from './components/ErrorBoundary.jsx';

console.log('--- MAIN.JSX BOOTING ---');
console.log('[MAIN PATH]', window.location.pathname);
console.log('[MAIN ENVIRONMENT]', process.env.NODE_ENV);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
