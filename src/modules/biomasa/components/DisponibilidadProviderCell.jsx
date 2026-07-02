const contactDetail = (item) => (
  item.contactoTelefono
  || item.contactoSnapshot?.telefono
  || item.contactoEmail
  || item.contactoSnapshot?.email
  || ''
);

export default function DisponibilidadProviderCell({ item }) {
  const providerName = item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '';
  const contactName = item.contactoNombre || '';
  const detail = contactDetail(item);
  const esComercializadora = item.tipo === 'comercializadora';

  return (
    <div className={`disponibilidad-provider-cell ${providerName ? '' : 'disponibilidad-provider-cell--contact-only'}`}>
      <span className="disponibilidad-provider-name">
        {providerName || 'Sin proveedor'}
        {esComercializadora && (
          <span className="dir-badge-comercializadora" style={{ marginLeft: 6 }}>Comercializadora</span>
        )}
      </span>
      {contactName && (
        <span>Contacto: {contactName}{detail ? ` · ${detail}` : ''}</span>
      )}
    </div>
  );
}
