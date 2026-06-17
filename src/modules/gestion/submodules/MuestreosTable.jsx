import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit,
  MapPin,
  Printer,
  Share2,
  TestTube2,
  Trash2,
} from 'lucide-react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-CL') : '-');

function MuestreoActions({ item, size = 14, disabled = false, onShare, onReport, onEdit, onDelete, stopPropagation = false }) {
  const handle = (event, callback) => {
    if (stopPropagation) event.stopPropagation();
    callback(item);
  };

  const isCompact = size === 12;

  return (
    <div className={`mu-table-actions ${isCompact ? 'compact' : ''}`}>
      <button
        className={`mx-action-btn share mu-action-share ${isCompact ? 'compact' : ''}`}
        title="Compartir enlace publico"
        onClick={(event) => handle(event, onShare)}
      >
        <Share2 size={size} />
      </button>
      <button
        className={`mx-action-btn print ${isCompact ? 'compact' : ''}`}
        title="Ver reporte"
        onClick={(event) => handle(event, onReport)}
      >
        <Printer size={size} />
      </button>
      <button
        className={`mx-action-btn edit ${isCompact ? 'compact' : ''} ${disabled ? 'disabled-soft' : ''}`}
        title="Editar"
        disabled={disabled}
        onClick={(event) => {
          if (disabled) return;
          handle(event, onEdit);
        }}
      >
        <Edit size={size} />
      </button>
      <button
        className={`mx-action-btn delete ${isCompact ? 'compact' : ''}`}
        title="Eliminar"
        onClick={(event) => handle(event, onDelete)}
      >
        <Trash2 size={size} />
      </button>
    </div>
  );
}

function QualityBadge({ item, compact = false }) {
  const label = item.clasificaciones?.[0]?.nombre;
  if (!label) {
    return compact
      ? <span className="mu-quality-compact muted">S/C</span>
      : <span className="mx-badge mx-badge-muted">S/C</span>;
  }

  return compact
    ? <span className="mu-quality-compact success">{label}</span>
    : <span className="mx-badge mx-badge-success">{label}</span>;
}

export default function MuestreosTable({
  viewMode,
  filtered,
  groupedData,
  expandedGroups,
  onToggleGroup,
  pagination,
  page,
  onPageChange,
  isLoadingDetails,
  editingId,
  onShare,
  onReport,
  onEdit,
  onDelete,
}) {
  return (
    <div className="mx-table-card muestreos-table-card" data-tour="muestreos-tabla">
      <div className="mx-table-wrap">
        <table className="mx-table">
          <thead>
            <tr>
              <th className={viewMode === 'grouped' ? 'mu-col-toggle' : 'mu-col-date'}>{viewMode === 'grouped' ? '' : 'Fecha'}</th>
              <th>Proveedor / Centro</th>
              <th className="mu-text-center">Muestras</th>
              <th className="mu-text-center">R% Prom.</th>
              <th className="mu-text-center">U x Kg</th>
              <th className="mu-text-center">Procesable %</th>
              <th className="mu-text-center">% Rechazo</th>
              <th className="mu-text-center">{viewMode === 'list' ? 'Calificación' : ''}</th>
              <th className="mu-text-right">{viewMode === 'list' ? 'Acciones' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {viewMode === 'list' ? (
              filtered.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <div className="mx-empty-state">
                      <TestTube2 size={36} />
                      <p className="mx-empty-state__title">Sin muestreos para mostrar</p>
                      <p className="mx-empty-state__text">No hay registros que coincidan con los filtros actuales.</p>
                    </div>
                  </td>
                </tr>
              ) :
              filtered.map((item) => (
                <tr key={item._id || item.id}>
                  <td className="mu-date-cell">{formatDate(item.fecha)}</td>
                  <td>
                    <div className="mu-provider-name">{item.proveedorNombre || item.proveedor}</div>
                    <div className="mu-center-line">
                      <MapPin size={10} /> {item.centroCodigo || 'Sin Centro'} {item.linea && `- L: ${item.linea}`}
                    </div>
                  </td>
                  <td className="mu-text-center">1</td>
                  <td className="mu-text-center"><span className="mx-badge mx-badge-info mu-strong-badge">{Number(item.rendimiento || 0).toFixed(1)}%</span></td>
                  <td className="mu-text-center mu-strong">{item.uxkg || 0}</td>
                  <td className="mu-text-center mu-success-strong">
                    {item.total > 0 ? (item.procesable / item.total * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="mu-text-center">
                    <span className={(item.total > 0 && item.rechazos / item.total > 0.05) ? 'mu-error-text' : ''}>
                      {item.total > 0 ? (item.rechazos / item.total * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                  <td className="mu-text-center"><QualityBadge item={item} /></td>
                  <td className="mu-text-right">
                    <MuestreoActions item={item} onShare={onShare} onReport={onReport} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              ))
            ) : groupedData.length === 0 ? (
              <tr>
                <td colSpan="9">
                  <div className="mx-empty-state">
                    <TestTube2 size={36} />
                    <p className="mx-empty-state__title">Sin muestreos para mostrar</p>
                    <p className="mx-empty-state__text">No hay registros que coincidan con los filtros actuales.</p>
                  </div>
                </td>
              </tr>
            ) : (
              groupedData.map((group) => (
                <React.Fragment key={group.key}>
                  <tr onClick={() => onToggleGroup(group.key)} className={`mu-group-row ${expandedGroups.has(group.key) ? 'expanded' : ''}`}>
                    <td className="mu-text-center">{expandedGroups.has(group.key) ? <ChevronUp size={16} color="var(--color-primary)" /> : <ChevronDown size={16} />}</td>
                    <td className="mu-group-name">{group.key}</td>
                    <td className="mu-text-center"><span className="mx-badge mx-badge-muted mu-strong-badge">{group.muestras}</span></td>
                    <td className="mu-text-center mu-primary-strong">{(group.rendSum / group.muestras).toFixed(1)}%</td>
                    <td className="mu-text-center mu-strong">{(group.uxkgSum / group.muestras).toFixed(0)}</td>
                    <td className="mu-text-center mu-success-strong">
                      {group.totalSum > 0 ? ((group.totalSum - group.rechazosSum) / group.totalSum * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className={`mu-text-center mu-strong ${(group.rechazosSum / group.totalSum * 100) > 5 ? 'mu-error-text' : ''}`}>
                      {group.totalSum > 0 ? (group.rechazosSum / group.totalSum * 100).toFixed(1) : 0}%
                    </td>
                    <td className="mu-text-center">-</td>
                    <td className="mu-text-right"><ChevronRight size={14} className="mu-muted-chevron" /></td>
                  </tr>
                  {expandedGroups.has(group.key) && group.items.map((item) => (
                    <tr key={item._id || item.id} className="mu-group-child-row">
                      <td className="mu-group-child-marker"></td>
                      <td className="mu-group-child-detail">
                        <div className="mu-group-child-meta">
                          <span className="mu-group-child-date">{formatDate(item.fecha)}</span>
                          <span className="mu-group-child-center">{item.centroCodigo || 'Sin Centro'} {item.linea && `- L: ${item.linea}`}</span>
                        </div>
                      </td>
                      <td className="mu-text-center">1</td>
                      <td className="mu-text-center mu-small-cell">{Number(item.rendimiento).toFixed(1)}%</td>
                      <td className="mu-text-center mu-small-cell">{item.uxkg}</td>
                      <td className="mu-text-center mu-small-cell mu-success-strong">
                        {item.total > 0 ? (item.procesable / item.total * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="mu-text-center mu-small-cell">{item.total > 0 ? (item.rechazos / item.total * 100).toFixed(1) : 0}%</td>
                      <td className="mu-text-center"><QualityBadge item={item} compact /></td>
                      <td className="mu-text-right">
                        <MuestreoActions
                          item={item}
                          size={12}
                          disabled={isLoadingDetails && editingId === (item._id || item.id)}
                          onShare={onShare}
                          onReport={onReport}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          stopPropagation
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewMode === 'list' && pagination && pagination.pages > 1 && (
        <div className="mu-table-pagination">
          <span className="mu-table-pagination-info">
            {pagination.total} muestreos &nbsp;-&nbsp; Pag. {pagination.page} / {pagination.pages}
          </span>
          <div className="mu-table-pagination-actions">
            <button
              className="mx-btn mx-btn-outline sm"
              disabled={page <= 1}
              onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            >
              <ArrowLeft size={14} /> Anterior
            </button>
            <button
              className="mx-btn mx-btn-outline sm"
              disabled={page >= pagination.pages}
              onClick={() => onPageChange((current) => Math.min(pagination.pages, current + 1))}
            >
              Siguiente <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
