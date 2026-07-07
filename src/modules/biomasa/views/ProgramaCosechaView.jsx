import ProgramaTablaView from './ProgramaTablaView';
import ProgramaCalendarioView from './ProgramaCalendarioView';

export default function ProgramaCosechaView({
  progSubTab, setProgSubTab,
  programPeriod, setProgramPeriod,
  calView, setCalView,
  mes, setMes,
  weekDays,
  calendarMetric, setCalendarMetric,
  isCalendarBoard,
  calendarBoardRef,
  selectedDay, setSelectedDay,
  currentWeekOffset, setCurrentWeekOffset,
  filterProveedor, setFilterProveedor,
  filterProducto, setFilterProducto,
  showAllProviders, setShowAllProviders,
  programasPeriodo,
  weekData,
  weekSummaries,
  weekSummaryFull,
  monthSummary,
  monthData,
  allMonthProviders,
  allMonthProducts,
  allWeekProviders,
  allWeekProducts,
  programasById,
  filteredProgramIds,
  calData,
  notasDia,
  tratosAcordados,
  handleOpenModal,
  handleOpenAdjustModal,
  handleOpenFinalizeModal,
  handleStatusChange,
  handleQuickAdjust,
  handleQuickAdjustTipo,
  tiposTransporte,
  handleReactivateDay,
  handleCalendarBoardToggle,
  setSuspendPopover,
  setNotaPopover,
  setPauseModal,
  setPauseForm,
  setConfirmDelete,
  moveProgramPeriod,
  enrichCalendarItem,
  tonsPerTruck,
  getProgramCamionesStatus,
  onExportarPrograma,
  exportandoPrograma,
  handleAplicarSemana,
}) {
  return (
    <div className="program-view">
      {progSubTab === 'programa' && (
        <ProgramaTablaView
          programPeriod={programPeriod}
          setProgramPeriod={setProgramPeriod}
          weekDays={weekDays}
          mes={mes}
          moveProgramPeriod={moveProgramPeriod}
          programasPeriodo={programasPeriodo}
          tonsPerTruck={tonsPerTruck}
          getProgramCamionesStatus={getProgramCamionesStatus}
          tratosAcordados={tratosAcordados}
          handleOpenModal={handleOpenModal}
          handleOpenFinalizeModal={handleOpenFinalizeModal}
          handleStatusChange={handleStatusChange}
          setPauseModal={setPauseModal}
          setPauseForm={setPauseForm}
          setConfirmDelete={setConfirmDelete}
          onExportarPrograma={onExportarPrograma}
          exportandoPrograma={exportandoPrograma}
        />
      )}
      
      {progSubTab === 'calendario' && (
        <ProgramaCalendarioView
          calView={calView}
          setCalView={setCalView}
          mes={mes}
          setMes={setMes}
          weekDays={weekDays}
          currentWeekOffset={currentWeekOffset}
          setCurrentWeekOffset={setCurrentWeekOffset}
          calendarMetric={calendarMetric}
          setCalendarMetric={setCalendarMetric}
          isCalendarBoard={isCalendarBoard}
          calendarBoardRef={calendarBoardRef}
          handleCalendarBoardToggle={handleCalendarBoardToggle}
          monthData={monthData}
          calData={calData}
          filteredProgramIds={filteredProgramIds}
          enrichCalendarItem={enrichCalendarItem}
          filterProducto={filterProducto}
          setFilterProducto={setFilterProducto}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          weekData={weekData}
          programasById={programasById}
          handleStatusChange={handleStatusChange}
          handleReactivateDay={handleReactivateDay}
          handleQuickAdjust={handleQuickAdjust}
          handleQuickAdjustTipo={handleQuickAdjustTipo}
          tiposTransporte={tiposTransporte}
          setSuspendPopover={setSuspendPopover}
          notasDia={notasDia}
          setNotaPopover={setNotaPopover}
          weekSummaries={weekSummaries}
          weekSummaryFull={weekSummaryFull}
          allWeekProviders={allWeekProviders}
          filterProveedor={filterProveedor}
          setFilterProveedor={setFilterProveedor}
          allWeekProducts={allWeekProducts}
          monthSummary={monthSummary}
          allMonthProviders={allMonthProviders}
          showAllProviders={showAllProviders}
          setShowAllProviders={setShowAllProviders}
          allMonthProducts={allMonthProducts}
          handleOpenAdjustModal={handleOpenAdjustModal}
          handleAplicarSemana={handleAplicarSemana}
        />
      )}

    </div>
  );
}