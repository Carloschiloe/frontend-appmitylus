import { Copy, MessageCircle, Target, X } from 'lucide-react';

export default function MuestreoShareModal({ isOpen, shareData, onClose, addToast }) {
  if (!isOpen) return null;

  const shareText = shareData?.message || shareData?.url || '';

  const copyLink = async () => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareText);
      addToast({ title: 'Mensaje copiado', message: 'Mensaje listo para enviar por WhatsApp.', type: 'success' });
      onClose();
    }
  };

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    onClose();
  };

  return (
    <div className="am-modal-overlay mu-share-overlay">
      <div className="am-modal-content mu-share-modal">
        <div className="mu-share-header">
          <span>Compartir</span>
          <button className="mx-btn-icon sm mu-share-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="mu-share-actions">
          <button className="mx-btn mu-share-btn whatsapp" onClick={openWhatsApp}>
            <div className="mu-share-btn-content">
              <MessageCircle size={18} /> WhatsApp
            </div>
          </button>

          <button className="mx-btn mx-btn-outline mu-share-btn" onClick={copyLink}>
            <div className="mu-share-btn-content">
              <Copy size={16} /> Copiar mensaje
            </div>
          </button>

          <button className="mx-btn mu-share-btn disabled" disabled>
            <div className="mu-share-btn-content">
              <Target size={16} /> Ping (Proximamente)
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
