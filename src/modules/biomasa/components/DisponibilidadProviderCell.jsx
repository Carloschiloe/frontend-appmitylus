import CentroCodeBadge from '../../../components/CentroCodeBadge';
import { useProviderCertificacion } from '../../../context/CentrosContext';

const contactDetail = (item) => (
  item.contactoTelefono
  || item.contactoSnapshot?.telefono
  || item.contactoEmail
  || item.contactoSnapshot?.email
  || ''
);

export default function DisponibilidadProviderCell({ item, hideContact = false, showCentroCode = false }) {
  const providerName = item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '';
  const contactName = item.contactoNombre || '';
  const detail = contactDetail(item);
  const esComercializadora = item.tipo === 'comercializadora';
  const providerCert = useProviderCertificacion(providerName);

  return (
    <div className={`disponibilidad-provider-cell ${providerName ? '' : 'disponibilidad-provider-cell--contact-only'}`}>
      <span className="disponibilidad-provider-name" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        {providerName || 'Sin proveedor'}
        {esComercializadora && (
          <span className="dir-badge-comercializadora">Comercializadora</span>
        )}
        {providerCert && (
          <span className="ct-cert-badge" title={`El proveedor posee centros con certificación: ${providerCert}`}>
            {providerCert}
          </span>
        )}
      </span>
      {showCentroCode && (
        <div style={{ marginTop: 2, marginBottom: 2 }}>
          <CentroCodeBadge code={item.centroOrigenCodigo || item.centroCodigo} />
        </div>
      )}
      {!hideContact && contactName && (
        <span>Contacto: {contactName}{detail ? ` · ${detail}` : ''}</span>
      )}
    </div>
  );
}
