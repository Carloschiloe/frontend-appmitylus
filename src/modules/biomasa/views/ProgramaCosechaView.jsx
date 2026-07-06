import ProgramaTablaView from './ProgramaTablaView';
import ProgramaCalendarioView from './ProgramaCalendarioView';
import ProgramaSeguimientoView from './ProgramaSeguimientoView';

export default function ProgramaCosechaView({
  progSubTab, setProgSubTab,
  programPeriod, setProgramPeriod,
  followupPeriod, setFollowupPeriod,
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
  followupPrograms,
  recentDailyAdjustments,
  followupSummary,
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
  setSegProg,
  setShowSegModal,
  setPauseModal,
  setPauseForm,
  setConfirmDelete,
  moveProgramPeriod,
  moveFollowupPeriod,
  getTodayProgramCamiones,
  getLatestProgramNovelty,
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

      {progSubTab === 'seguimiento' && (
        <ProgramaSeguimientoView
          followupPeriod={followupPeriod}
          setFollowupPeriod={setFollowupPeriod}
          weekDays={weekDays}
          mes={mes}
          moveFollowupPeriod={moveFollowupPeriod}
          followupSummary={followupSummary}
          followupPrograms={followupPrograms}
          getTodayProgramCamiones={getTodayProgramCamiones}
          getLatestProgramNovelty={getLatestProgramNovelty}
          handleOpenAdjustModal={handleOpenAdjustModal}
          setSegProg={setSegProg}
          setShowSegModal={setShowSegModal}
          recentDailyAdjustments={recentDailyAdjustments}
        />
      )}
    </div>
  );
}