import { ChevronLeft, ChevronRight, LayoutGrid, List, Plus, RotateCcw, Search } from 'lucide-react';
import { getMonthLabel } from './muestreos.helpers';

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
}) {
  const handleCalView = (nextView) => {
    onCalViewChange(nextView);
  };

  const handlePreviousPeriod = () => {
    if (calView === 'month') {
      onMesChange((prev) => shiftMonth(prev, -1));
    } else {
      onWeekOffsetChange((prev) => prev - 1);
    }
  };

  const handleNextPeriod = () => {
    if (calView === 'month') {
      onMesChange((prev) => shiftMonth(prev, 1));
    } else {
      onWeekOffsetChange((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    onWeekOffsetChange(0);
  };

  return (
    <>
      <div className="mx-card muestreos-period-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div className="mx-toggle-group">
            <button className={`mx-toggle-btn ${calView === 'month' ? 'active' : ''}`} onClick={() => handleCalView('month')}>Vista Mes</button>
            <button className={`mx-toggle-btn ${calView === 'week' ? 'active' : ''}`} onClick={() => handleCalView('week')}>Vista Semana</button>
            <button className={`mx-toggle-btn ${calView === 'all' ? 'active' : ''}`} onClick={() => handleCalView('all')}>Todos</button>
          </div>

          {calView !== 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="mx-btn-icon sm" onClick={handlePreviousPeriod}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)', minWidth: '200px', textAlign: 'center', textTransform: 'uppercase' }}>
                {calView === 'month' ? getMonthLabel(mes) : weekLabel}
              </span>
              <button className="mx-btn-icon sm" onClick={handleNextPeriod}><ChevronRight size={16} /></button>
              {calView === 'week' && weekOffset !== 0 && (
                <button className="mx-btn mx-btn-outline sm" onClick={handleToday}>Hoy</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-toolbar muestreos-actions-toolbar">
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => onViewModeChange('list')}><List size={14} /> Historial</button>
          <button className={`mx-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`} onClick={() => onViewModeChange('grouped')}><LayoutGrid size={14} /> Agrupado</button>
        </div>
        <div className="mx-search-box" style={{ flex: 1 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor o centro..."
            className="mx-input"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </div>
        <button className="mx-btn mx-btn-outline sm" onClick={onRefresh}><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary sm" onClick={onNewMuestreo}>
          <Plus size={18} /> Muestreo
        </button>
      </div>
    </>
  );
}
