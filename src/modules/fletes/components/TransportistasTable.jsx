import React from 'react';
import { ChevronDown, ChevronUp, Edit, Plus, Trash2, Truck } from 'lucide-react';
import { TIPO_CAMION_LABELS } from '../fletes.constants';

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-CL');
};

const formatMoney = (value) => {
  const number = Number(value || 0);
  return number.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
};

const formatKilo = (value) => {
  const number = Number(value || 0);
  if (!number) return '$0';
  return `$${number.toLocaleString('es-CL', { maximumFractionDigits: 2 })}`;
};

export default function TransportistasTable({
  transportistas,
  expandedGroups,
  onToggleGroup,
  onAddTarifa,
  onEditTransportista,
  onDeleteTransportista,
}) {
  if (!transportistas.length) {
    return (
      <div className="mx-table-card fletes-empty-card">
        <Truck size={36} />
        <h3>Sin transportistas</h3>
        <p>Crea el primer transportista o sube una planilla Excel para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="mx-table-card fletes-table-card">
      <div className="mx-table-wrap">
        <table className="mx-table fletes-table">
          <thead>
            <tr>
              <th className="fletes-col-toggle"></th>
              <th>Transportista</th>
              <th>RUT</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th className="fletes-text-center">Tarifas</th>
              <th className="fletes-text-center">Estado</th>
              <th className="fletes-text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transportistas.map((transportista) => {
              const id = transportista._id || transportista.id;
              const isExpanded = expandedGroups.has(id);
              const tarifas = Array.isArray(transportista.tarifas) ? transportista.tarifas : [];

              return (
                <React.Fragment key={id}>
                  <tr
                    onClick={() => onToggleGroup(id)}
                    className={`mu-group-row ${isExpanded ? 'expanded' : ''} ${transportista.activo === false ? 'fletes-row-inactive' : ''}`}
                  >
                    <td className="fletes-text-center">
                      {isExpanded ? <ChevronUp size={16} color="var(--color-primary)" /> : <ChevronDown size={16} />}
                    </td>
                    <td>
                      <div className="fletes-main-name">{transportista.nombre}</div>
                      <div className="fletes-main-sub">{transportista.email || 'Sin email'}</div>
                    </td>
                    <td>{transportista.rut || '-'}</td>
                    <td>{transportista.contacto || '-'}</td>
                    <td>{transportista.telefono || '-'}</td>
                    <td className="fletes-text-center">
                      <span className="mx-badge mx-badge-info">{tarifas.length}</span>
                    </td>
                    <td className="fletes-text-center">
                      <span className={`fletes-status ${transportista.activo === false ? 'inactive' : 'active'}`}>
                        {transportista.activo === false ? 'Inactivo' : 'Activo'}
                      </span>
                    </td>
                    <td className="fletes-text-right">
                      <button
                        type="button"
                        className="mx-action-btn edit"
                        title="Editar transportista"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditTransportista(transportista);
                        }}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        type="button"
                        className="mx-action-btn delete"
                        title="Desactivar transportista"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteTransportista(transportista);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>

                  {isExpanded && tarifas.map((tarifa) => (
                    <tr key={tarifa._id || `${id}-${tarifa.comuna}-${tarifa.tipoCamion}`} className="mu-group-child-row">
                      <td className="mu-group-child-marker"></td>
                      <td className="mu-group-child-detail" data-label="Comuna">
                        <div className="fletes-tarifa-title">{tarifa.comuna || 'Sin comuna'}</div>
                        <div className="fletes-main-sub">Tarifa vigente por zona</div>
                      </td>
                      <td data-label="Tipo camión" colSpan={2}>
                        <span className="fletes-truck-badge">{TIPO_CAMION_LABELS[tarifa.tipoCamion] || tarifa.tipoCamion || '-'}</span>
                      </td>
                      <td data-label="Costo fijo">{formatMoney(tarifa.costoFijoPorViaje)}</td>
                      <td className="fletes-text-center" data-label="Costo/kg">{formatKilo(tarifa.costoPorKilo)}</td>
                      <td data-label="Vigencia">
                        <div className="fletes-date-range">
                          {formatDate(tarifa.vigenciaDesde)}
                          <span>→</span>
                          {formatDate(tarifa.vigenciaHasta)}
                        </div>
                      </td>
                      <td></td>
                    </tr>
                  ))}

                  {isExpanded && tarifas.length === 0 && (
                    <tr className="mu-group-child-row">
                      <td className="mu-group-child-marker"></td>
                      <td colSpan={6} className="mu-group-child-detail">
                        <span className="fletes-empty-inline">Este transportista aún no tiene tarifas.</span>
                      </td>
                      <td></td>
                    </tr>
                  )}

                  {isExpanded && (
                    <tr className="mu-group-child-row fletes-add-row">
                      <td className="mu-group-child-marker"></td>
                      <td colSpan={7}>
                        <button type="button" className="mx-btn mx-btn-outline sm" onClick={() => onAddTarifa(transportista)}>
                          <Plus size={14} />
                          Agregar tarifa
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
