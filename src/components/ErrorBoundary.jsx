import React from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que el siguiente renderizado muestre la interfaz de repuesto.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Aquí podríamos conectar con un servicio de monitoreo como Sentry
    console.error("ErrorBoundary atrapó un error crítico:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-app-shell">
          <div className="mx-main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 }}>
            <div className="mx-state-placeholder" style={{ maxWidth: '400px', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ background: '#fef2f2', color: '#ef4444', padding: '16px', borderRadius: '50%', marginBottom: '24px' }}>
                <AlertTriangle size={48} />
              </div>
              
              <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Algo salió mal</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px', fontSize: '0.95rem' }}>
                La aplicación encontró un error inesperado al renderizar la interfaz. Nuestro equipo ha sido notificado (en log).
              </p>

              <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
                <button onClick={this.handleGoHome} className="mx-btn mx-btn-outline" style={{ flex: 1 }}>
                  <Home size={18} />
                  Ir al Inicio
                </button>
                <button onClick={this.handleReload} className="mx-btn mx-btn-primary" style={{ flex: 1 }}>
                  <RefreshCw size={18} />
                  Recargar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
