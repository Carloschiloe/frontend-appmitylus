import { useState, useRef, useEffect } from 'react';
import { Pencil, ArrowRight, Handshake } from 'lucide-react';

export default function DisponibilidadRowActions({ item, onEdit, onCreateTrato, onEditTrato }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const canCreate = (item.estado || 'disponible') === 'disponible' && !item.tratoId && onCreateTrato;
  const canEditTrato = item.tratoId && onEditTrato;

  // Si no hay opción secundaria, es un simple botón para ahorrar clics
  if (!canCreate && !canEditTrato) {
    return (
      <button type="button" className="mx-btn-icon sm" onClick={() => onEdit?.(item)} title="Editar disponibilidad">
        <Pencil size={15} />
      </button>
    );
  }

  return (
    <div className="disp-row-actions-dropdown" ref={ref}>
      <button type="button" className={`mx-btn-icon sm ${open ? 'active' : ''}`} onClick={() => setOpen(!open)} title="Acciones">
        <Pencil size={15} />
      </button>
      {open && (
        <div className="disp-row-actions-menu">
          <button type="button" onClick={() => { setOpen(false); onEdit?.(item); }}>
            <Pencil size={14} /> Editar disponibilidad
          </button>
          {canEditTrato && (
            <button type="button" onClick={() => { setOpen(false); onEditTrato?.(item); }}>
              <Handshake size={14} /> Editar trato
            </button>
          )}
          {canCreate && (
            <button type="button" onClick={() => { setOpen(false); onCreateTrato?.(item); }}>
              <ArrowRight size={14} /> Crear trato
            </button>
          )}
        </div>
      )}
    </div>
  );
}
