import React from 'react';
import { CheckCircle2, Copy, Send } from 'lucide-react';

export default function TratoShareModal({
  isOpen,
  url,
  message,
  onCopy,
  onClose,
}) {
  if (!isOpen) return null;

  const whatsappText = message || url;

  return (
    <div className="mx-modal-overlay tratos-share-overlay">
      <div className="mx-modal tratos-share-modal">
        <div className="tratos-share-header">
          <div className="tratos-share-icon">
            <CheckCircle2 size={32} />
          </div>
          <h2>Acuerdo listo</h2>
          <p>Envía el comprobante oficial al proveedor.</p>
        </div>

        <div className="tratos-share-actions">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noreferrer"
            className="mx-btn mx-btn-primary tratos-share-whatsapp"
          >
            <Send size={18} /> WhatsApp Directo
          </a>

          <button
            className="mx-btn mx-btn-outline tratos-share-copy"
            onClick={() => onCopy(url)}
          >
            <Copy size={18} /> Copiar enlace
          </button>

          <button
            className="mx-btn tratos-share-close"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
