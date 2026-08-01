// src/components/CentroCodeBadge.jsx
// Componente reutilizable que muestra el código del centro + badge de certificación (ej: ASC) si aplica.
import { useCentroCertificacion } from '../context/CentrosContext';

/**
 * @param {string} code       - Código del centro (ej: "103544")
 * @param {string} [className] - Clase adicional para el span del código
 * @param {boolean} [asCode]  - Si es true, usa <code> en vez de <span>
 */
export default function CentroCodeBadge({ code, className = '', asCode = false }) {
  const cert = useCentroCertificacion(code);

  if (!code) return <span className="centros-muted">Sin centro</span>;

  const CodeEl = asCode ? 'code' : 'span';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
      <CodeEl className={className || undefined}>{code}</CodeEl>
      {cert && (
        <span className="ct-cert-badge" title={`Certificación: ${cert}`}>
          {cert}
        </span>
      )}
    </span>
  );
}
