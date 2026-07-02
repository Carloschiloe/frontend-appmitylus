import { useEffect, useState } from 'react';
import { Sparkles, X, Zap } from 'lucide-react';

export default function SpeedDialFab() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const close = () => setExpanded(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [expanded]);

  const openCopilot = () => {
    window.dispatchEvent(new CustomEvent('mitynex:copilot-open'));
    setExpanded(false);
  };

  const openQuickCapture = () => {
    window.dispatchEvent(new CustomEvent('mitynex:quick-capture-open'));
    setExpanded(false);
  };

  return (
    <div className="speed-dial" onClick={(e) => e.stopPropagation()}>
      <div className={`speed-dial-actions${expanded ? ' is-visible' : ''}`}>
        <button
          type="button"
          className="speed-dial-action speed-dial-action--copilot"
          onClick={openCopilot}
          tabIndex={expanded ? 0 : -1}
        >
          <Sparkles size={15} />
          <span>Copilot</span>
        </button>
        <button
          type="button"
          className="speed-dial-action speed-dial-action--quick"
          onClick={openQuickCapture}
          tabIndex={expanded ? 0 : -1}
        >
          <Zap size={15} />
          <span>Acción rápida</span>
        </button>
      </div>

      <button
        type="button"
        className={`speed-dial-main${expanded ? ' is-expanded' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-label="Acciones rápidas"
        title="Acciones rápidas"
        aria-expanded={expanded}
      >
        <span className={`speed-dial-icon${expanded ? ' is-x' : ''}`}>
          {expanded ? <X size={20} /> : <Sparkles size={20} />}
        </span>
        <span className="speed-dial-main-label">{expanded ? 'Cerrar' : 'Acciones'}</span>
      </button>
    </div>
  );
}
