import { X } from 'lucide-react';

export default function MuestreoImagePreview({ image, onClose }) {
  if (!image) return null;

  return (
    <div
      className="mu-image-preview"
      onClick={onClose}
    >
      <button
        className="mu-image-preview-close"
        onClick={onClose}
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
