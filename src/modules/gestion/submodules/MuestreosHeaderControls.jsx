import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, FileDown, LayoutGrid, List, Plus, RotateCcw, Search } from 'lucide-react';
import { getMonthLabel } from './muestreos.helpers';
import HelpTourButton from '../../../components/HelpTourButton';

const MU_VIEW_LABELS = { month: 'Mes', week: 'Semana', all: 'Ver Todos' };

const shiftMonth = (monthKey, delta) => {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function MuestreosHeaderControls({
  calView,
  mes,
  onCalViewChange,
  onMesChange,
  weekOffset,
  onWeekOffsetChange,
  weekLabel,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchTermChange,
  onRefresh,
  onNewMuestreo,
  onExportar,
  exportando,
  productFilter = 'all',
  onProductFilterChange,
  availableProducts = [],
}) {
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target)) {
        setViewDropdownOpen(false);
      }
    };
    if (viewDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [viewDropdownOpen]);

  const handlePreviousPeriod = () => {
    if (calView === 'month') onMesChange((prev) => shiftMonth(prev, -1));
    else onWeekOffsetChange((prev) => prev - 1);
  };

  const handleNextPeriod = () => {
    if (calView === 'month') onMesChange((prev) => shiftMonth(prev, 1));
    else onWeekOffsetChange((prev) => prev + 1);
  };

  return (
    <div className="muestreos-controls-panel" data-tour="muestreos-filtros">
      <div className="mu-toolbar-row">

      {/* Vista dropdown */}
      <div className="harvest-prog-view-dropdown" ref={viewDropdownRef}>
        <button className="harvest-prog-view-btn" onClick={() => setViewDropdownOpen(o => !o)}>
          <span>Vista: <strong>{MU_VIEW_LABELS[calView]}</strong></span>
          <ChevronDown size={13} className={viewDropdownOpen ? 'rotated' : ''} />
        </button>
        {viewDropdownOpen && (
          <div className="harvest-prog-view-menu">
            {Object.entries(MU_VIEW_LABELS).map(([val, label]) => (
              <button
                key={val}
                className={`harvest-prog-view-option${calView === val ? ' active' : ''}`}
                onClick={() => { onCalViewChange(val); setViewDropdownOpen(false); }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Period nav */}
      {calView !== 'all' && (
        <div className="mu-period-nav">
          <button className="mx-btn-icon sm" onClick={handlePreviousPeriod}><ChevronLeft size={16} /></button>
          <span className="mu-period-label">
            {calView === 'month' ? getMonthLabel(mes) : weekLabel}
          </span>
          <button className="mx-btn-icon sm" onClick={handleNextPeriod}><ChevronRight size={16} /></button>
          {calView === 'week' && weekOffset !== 0 && (
            <button className="mx-btn mx-btn-outline sm" onClick={() => onWeekOffsetChange(0)}>Hoy</button>
          )}
        </div>
      )}

      <div className="mu-controls-sep" />

      {/* Historial / Agrupado pills */}
      <div className="mu-viewmode-pills">
        <button className={`mu-viewmode-pill${viewMode === 'list' ? ' active' : ''}`} onClick={() => onViewModeChange('list')}>
          <List size={13} /> Historial
        </button>
        <button className={`mu-viewmode-pill${viewMode === 'grouped' ? ' active' : ''}`} onClick={() => onViewModeChange('grouped')}>
          <LayoutGrid size={13} /> Agrupado
        </button>
      </div>

      {/* Search */}
      <div className="mx-search-box mu-toolbar-search" data-tour="muestreos-busqueda">
        <Search size={15} />
        <input
          type="text"
          placeholder="Buscar proveedor o centro..."
          className="mx-input"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>

      {/* Action buttons */}
      <div className="mu-controls-actions">
        <button className="mx-btn-icon sm mu-control-action-icon" onClick={onRefresh} title="Recargar">
          <RotateCcw size={16} />
          <span>Recargar</span>
        </button>
        <button className="mx-btn-icon sm mu-control-action-icon" onClick={onExportar} disabled={exportando} title="Exportar a Excel">
          <FileDown size={16} />
          <span>{exportando ? 'Exportando' : 'Exportar'}</span>
        </button>
        <HelpTourButton tourId="muestreos" className="mu-help-action" />
        <button className="mx-btn mx-btn-primary sm mu-new-action" onClick={onNewMuestreo} data-tour="muestreos-registrar">
          <Plus size={16} /> Muestreo
        </button>
      </div>
      </div>

      {availableProducts.length > 0 && (
        <div className="mu-product-chips-row">
          <span className="mu-product-chips-label">Producto:</span>
          <button
            className={`mu-product-chip${productFilter === 'all' ? ' active' : ''}`}
            onClick={() => onProductFilterChange('all')}
          >
            Todos
          </button>
          {availableProducts.map(name => (
            <button
              key={name}
              className={`mu-product-chip${productFilter === name ? ' active' : ''}`}
              onClick={() => onProductFilterChange(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
