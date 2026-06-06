import React from 'react';
import { RefreshCw, AlertTriangle, Home, Bug } from 'lucide-react';
import { reportFrontendError } from '../utils/errorReporter.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorCode: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary atrapo un error critico:', error, errorInfo);
    reportFrontendError(error, {
      title: 'Error de renderizado React',
      stack: `${error?.stack || ''}\n${errorInfo?.componentStack || ''}`,
    }).then((result) => {
      if (result?.errorCode) this.setState({ errorCode: result.errorCode });
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportProblem = () => {
    window.dispatchEvent(new CustomEvent('mitynex:open-support-report', {
      detail: {
        description: this.state.error?.message || 'Error de pantalla',
        severity: 'high',
      },
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-app-shell">
          <div className="mx-main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 }}>
            <div className="mx-state-placeholder" style={{ maxWidth: '460px', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ background: '#fef2f2', color: '#ef4444', padding: '16px', borderRadius: '50%', marginBottom: '24px' }}>
                <AlertTriangle size={48} />
              </div>

              <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Algo salio mal</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px', fontSize: '0.95rem' }}>
                Algo no funciono correctamente en esta pantalla. Puedes intentar nuevamente o enviar un reporte al equipo de soporte.
              </p>
              {this.state.errorCode && (
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                  Codigo: {this.state.errorCode}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={this.handleGoHome} className="mx-btn mx-btn-outline" style={{ flex: 1 }}>
                  <Home size={18} />
                  Ir al Inicio
                </button>
                <button onClick={this.handleReportProblem} className="mx-btn mx-btn-outline" style={{ flex: 1 }}>
                  <Bug size={18} />
                  Reportar
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
