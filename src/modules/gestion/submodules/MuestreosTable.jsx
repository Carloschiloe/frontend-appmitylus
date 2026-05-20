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
  Trash2,
} from 'lucide-react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-CL') : '-');

function MuestreoActions({ item, size = 14, disabled = false, onShare, onReport, onEdit, onDelete, stopPropagation = false }) {
  const handle = (event, callback) => {
    if (stopPropagation) event.stopPropagation();
    callback(item);
  };

  const compactStyle = size === 12 ? { width: '28px', height: '28px' } : undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: size === 12 ? '12px' : '8px' }}>
      <button
        className="mx-action-btn share"
        style={{ ...compactStyle, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bcf0da' }}
        title="Compartir enlace publico"
        onClick={(event) => handle(event, onShare)}
      >
        <Share2 size={size} />
      </button>
      <button
        className="mx-action-btn print"
        style={compactStyle}
        title="Ver reporte"
        onClick={(event) => handle(event, onReport)}
      >
        <Printer size={size} />
      </button>
      <button
        className="mx-action-btn edit"
        style={{ ...compactStyle, opacity: disabled ? 0.5 : 1 }}
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
        className="mx-action-btn delete"
        style={compactStyle}
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
      ? <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>S/C</span>
      : <span className="mx-badge mx-badge-muted">S/C</span>;
  }

  return compact
    ? <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>{label}</span>
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
    <div className="mx-table-card muestreos-table-card">
      <div className="mx-table-wrap">
        <table className="mx-table">
          <thead>
            <tr>
              <th style={{ width: viewMode === 'grouped' ? '40px' : '100px' }}>{viewMode === 'grouped' ? '' : 'Fecha'}</th>
              <th>Proveedor / Centro</th>
              <th style={{ textAlign: 'center' }}>Muestras</th>
              <th style={{ textAlign: 'center' }}>R% Prom.</th>
              <th style={{ textAlign: 'center' }}>U x Kg</th>
              <th style={{ textAlign: 'center' }}>Procesable %</th>
              <th style={{ textAlign: 'center' }}>% Rechazo</th>
              <th style={{ textAlign: 'center' }}>{viewMode === 'list' ? 'Calificacion' : ''}</th>
              <th style={{ textAlign: 'right' }}>{viewMode === 'list' ? 'Acciones' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {viewMode === 'list' ? (
              filtered.map((item) => (
                <tr key={item._id || item.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDate(item.fecha)}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{item.proveedorNombre || item.proveedor}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={10} /> {item.centroCodigo || 'Sin Centro'} {item.linea && `- L: ${item.linea}`}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>1</td>
                  <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-info" style={{ fontWeight: 700 }}>{Number(item.rendimiento || 0).toFixed(1)}%</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{item.uxkg || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>
                    {item.total > 0 ? (item.procesable / item.total * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: (item.total > 0 && item.rechazos / item.total > 0.05) ? 'var(--color-error)' : 'inherit' }}>
                      {item.total > 0 ? (item.rechazos / item.total * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}><QualityBadge item={item} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <MuestreoActions item={item} onShare={onShare} onReport={onReport} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              ))
            ) : (
              groupedData.map((group) => (
                <React.Fragment key={group.key}>
                  <tr onClick={() => onToggleGroup(group.key)} style={{ cursor: 'pointer', background: expandedGroups.has(group.key) ? 'var(--color-primary-bg)' : 'white' }}>
                    <td style={{ textAlign: 'center' }}>{expandedGroups.has(group.key) ? <ChevronUp size={16} color="var(--color-primary)" /> : <ChevronDown size={16} />}</td>
                    <td style={{ fontWeight: 800, color: 'var(--color-text)' }}>{group.key}</td>
                    <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-muted" style={{ fontWeight: 700 }}>{group.muestras}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-primary)' }}>{(group.rendSum / group.muestras).toFixed(1)}%</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{(group.uxkgSum / group.muestras).toFixed(0)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>
                      {group.totalSum > 0 ? ((group.totalSum - group.rechazosSum) / group.totalSum * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: (group.rechazosSum / group.totalSum * 100) > 5 ? 'var(--color-error)' : 'inherit' }}>
                      {group.totalSum > 0 ? (group.rechazosSum / group.totalSum * 100).toFixed(1) : 0}%
                    </td>
                    <td style={{ textAlign: 'center' }}>-</td>
                    <td style={{ textAlign: 'right' }}><ChevronRight size={14} style={{ opacity: 0.2 }} /></td>
                  </tr>
                  {expandedGroups.has(group.key) && group.items.map((item) => (
                    <tr key={item._id || item.id} style={{ background: '#fafafa' }}>
                      <td style={{ textAlign: 'right', borderRight: '2px solid var(--color-primary)' }}></td>
                      <td style={{ paddingLeft: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>{formatDate(item.fecha)}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>{item.centroCodigo || 'Sin Centro'} {item.linea && `- L: ${item.linea}`}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>1</td>
                      <td style={{ textAlign: 'center', fontSize: '13px' }}>{Number(item.rendimiento).toFixed(1)}%</td>
                      <td style={{ textAlign: 'center', fontSize: '13px' }}>{item.uxkg}</td>
                      <td style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-success)', fontWeight: 700 }}>
                        {item.total > 0 ? (item.procesable / item.total * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '13px' }}>{item.total > 0 ? (item.rechazos / item.total * 100).toFixed(1) : 0}%</td>
                      <td style={{ textAlign: 'center' }}><QualityBadge item={item} compact /></td>
                      <td style={{ textAlign: 'right' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-subtle)' }}>
            {pagination.total} muestreos &nbsp;-&nbsp; Pag. {pagination.page} / {pagination.pages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
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
