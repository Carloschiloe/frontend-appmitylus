import { X } from 'lucide-react';

export default function MuestreoImagePreview({ image, onClose }) {
  if (!image) return null;

  return (
    <div
      className="mu-image-preview"
      onClick={onClose}
    >
      <button
        type="button"
        className="mu-image-preview-close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar imagen ampliada"
        title="Cerrar imagen ampliada"
      >
        <X size={24} />
      </button>
      <img
        src={image}
        className="mu-image-preview-img"
        onClick={(event) => event.stopPropagation()}
        alt="Preview"
      />
    </div>
  );
}
