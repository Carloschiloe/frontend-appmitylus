import { Suspense, lazy, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import './biomasa.css';
import {
  Plus,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import { maestrosApi } from '../../api/api-maestros';
import { useToast } from '../../context/ToastContext';
import { useBiomasaData } from '../../hooks/useBiomasaData';
import DisponibilidadView from './components/DisponibilidadView';
import ProgramaCosechaView from './views/ProgramaCosechaView';
import ProgramaModalesView from './views/ProgramaModalesView';
import HelpTourButton from '../../components/HelpTourButton';
import { useCalendarioPrograma } from './hooks/useCalendarioPrograma';
import { useProgramaActions } from './hooks/useProgramaActions';
import { useProgramaForm } from './hooks/useProgramaForm';
import { usePeriodNavigation } from './hooks/usePeriodNavigation';
import { useBiomasaComputed } from './hooks/useBiomasaComputed';
import { usePrefillHandler } from './hooks/usePrefillHandler';
import { downloadXlsx } from '../../utils/downloadXlsx';
import { mesActual, todayKey } from './utils/fechasChile';
const Muestreos = lazy(() => import('../gestion/submodules/Muestreos'));
const Tratos = lazy(() => import('../gestion/submodules/Tratos'));

export default function Biomasa() {
  const { addToast } = useToast();
  const location = useLocation();
  const isStatusView = location.pathname.includes('/status');
  const isTratosView = location.pathname.includes('/tratos');
  const isProgramView = location.pathname.includes('/programa');
  const isMuestreosView = location.pathname.includes('/muestreos');

  const statusSubTab = 'disponibilidad';
  const [progSubTab, setProgSubTab] = useState('programa');
  const [mes, setMes] = useState(mesActual);
  const { loading, disp, programas, calData, notasDia, tratosAcordados, reload: load } = useBiomasaData(mes, {
    isStatusView,
    isTratosView,
    isProgramView,
    isMuestreosView,
    statusSubTab,
    progSubTab
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    // S1 — Trato + Desde
    tratoId: '',
    vigenciaDesde: '',
    vigenciaHasta: '',   // legacy compat for edit; computed at save
    // S2 — Producto + Días
    tipoProducto: 'sin_definir',
    diasSemana: [0, 1, 2, 3, 4],
    // S3 — Programar (modo simple)
    modoProgramacion: 'camiones',
    camionesTotales: '',       // modo camiones: total camiones del programa
    tonsAProgramar: '',        // modo toneladas: total tons
    tipoTransporteId: '',
    tipoTransporteNombre: '',
    toneladasPorCamion: '',
    // S4 — Ritmo diario (modo simple)
    camionesPorDia: '',
    // S5 — Tipos de camión (siempre tabla, 1 fila por defecto)
    modoAvanzado: true,
    transportesAvanzados: [{ tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }],
    // Misc
    notas: '',
    diasEspeciales: [],
    condicionContinuidad: '',
    camionesDefault: 1,        // legacy: computed at save from camionesPorDia
  });

  const [suspendPopover, setSuspendPopover] = useState(null); // { programa, fecha, x, y, motivo, nota }
  const [notaPopover, setNotaPopover] = useState(null); // { fechaKey, nota, x, y }
  const [pauseModal, setPauseModal] = useState(null); // { id, proveedorNombre }
  const [pauseForm, setPauseForm] = useState({ pausadoDesde: todayKey(), motivoPausa: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizingProgram, setFinalizingProgram] = useState(null);
  const [finalizeForm, setFinalizeForm] = useState({ motivoCierre: '', nota: '', fechaCierre: todayKey() });
  const [showContinuityModal, setShowContinuityModal] = useState(false);
  const [continuitySource, setContinuitySource] = useState(null);
  const {
    programPeriod, setProgramPeriod,
    currentWeekOffset, setCurrentWeekOffset,
    moveProgramPeriod,
  } = usePeriodNavigation({ setMes });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProgram, setAdjustProgram] = useState(null);
  const [impactoAjuste, setImpactoAjuste] = useState(null); // resumen post-ajuste (Fase 4)
  const [adjustForm, setAdjustForm] = useState({
    fecha: todayKey(),
    accion: 'set_total',
    camiones: 0,
    motivo: 'Planta',
    nota: '',
    tipoTransporteId: '',
    tipoTransporteNombre: '',
    toneladasPorCamion: '',
  });
  const [tratoLimites, setTratoLimites] = useState({ vigenciaDesde: '', vigenciaHasta: '', maxCamionesDia: null });
  const [tratoSaldo, setTratoSaldo] = useState(null);
  const [tiposTransporte, setTiposTransporte] = useState([]);
  
  // Estados para Calendario Avanzado
  const [calView, setCalView] = useState('month'); // 'month' | 'week'
  const [selectedDay, setSelectedDay] = useState(null);
  const [isCalendarBoard, setIsCalendarBoard] = useState(false);
  const [calendarMetric, setCalendarMetric] = useState('both');
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [filterProveedor, setFilterProveedor] = useState(null);
  const [filterProducto, setFilterProducto] = useState(null);
  const tonsPerTruck = 11;
  const calendarBoardRef = useRef(null);


  const {
    monthData,
    weekDays,
    programasById,
    filteredProgramIds,
    enrichCalendarItem,
    allMonthProviders,
    allWeekProviders,
    allMonthProducts,
    allWeekProducts,
    weekData,
    weekSummaries,
    weekSummaryFull,
    monthSummary,
  } = useCalendarioPrograma({ mes, currentWeekOffset, programas, calData, filterProducto, filterProveedor, tonsPerTruck });

  // Sincronizar el mes cargado cuando cambia la semana seleccionada
  useEffect(() => {
    maestrosApi.getMaestrosActivos('tipo_transporte').then(setTiposTransporte).catch(() => {});
  }, []);

  useEffect(() => {
    const isWeekMode = isProgramView && (programPeriod === 'week' || (progSubTab === 'calendario' && calView === 'week'));
    if (isWeekMode && weekDays && weekDays[0]) {
      const weekMonth = weekDays[0].slice(0, 7);
      if (weekMonth !== mes) {
        setMes(weekMonth);
      }
    }
  }, [isProgramView, programPeriod, progSubTab, calView, currentWeekOffset, weekDays, mes]);



  useEffect(() => {
    document.body.classList.toggle('biomasa-calendar-board-open', isCalendarBoard);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsCalendarBoard(false);
    };
    if (isCalendarBoard) window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('biomasa-calendar-board-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarBoard]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsCalendarBoard(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleCalendarBoardToggle = useCallback(async () => {
    if (isCalendarBoard) {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsCalendarBoard(false);
      return;
    }

    setIsCalendarBoard(true);
    const target = calendarBoardRef.current;
    if (target?.requestFullscreen) {
      try {
        await target.requestFullscreen();
      } catch {
        addToast({
          title: 'Pantalla completa no disponible',
          message: 'El navegador bloqueó el modo pantalla completa. Puedes usar F11 como alternativa.',
          type: 'warning'
        });
      }
    }
  }, [addToast, isCalendarBoard]);

  useEffect(() => {
    if (selectedDay && !String(selectedDay.key || '').startsWith(mes)) {
      setSelectedDay(null);
    }
  }, [mes, selectedDay]);

  // El usuario ingresa explícitamente la cantidad — no precargar saldo automáticamente

  // Handlers CRUD
  const {
    fetchTratoSaldo,
    computeTratoLimites,
    handleOpenModal,
    handleSave,
    handleCrearContinuidad,
  } = useProgramaForm({
    addToast,
    load,
    mes,
    tratosAcordados,
    programas,
    formData,
    tratoSaldo,
    editingId,
    continuitySource,
    setTratoSaldo,
    setTratoLimites,
    setEditingId,
    setFormData,
    setSubmitAttempted,
    setShowModal,
    setShowConfirm,
    setShowContinuityModal,
  });

  usePrefillHandler({ loading, tratosAcordados, programas, handleOpenModal, addToast, progSubTab, setProgSubTab, setFilterProveedor });

  const [exportandoPrograma, setExportandoPrograma] = useState(false);

  const handleExportarPrograma = useCallback(async () => {
    setExportandoPrograma(true);
    try {
      const params = {};
      if (programPeriod === 'week' && weekDays?.length >= 2) {
        params.from = weekDays[0];
        params.to   = weekDays[weekDays.length - 1];
      } else if (programPeriod === 'month' && mes) {
        const [y, m] = mes.split('-');
        const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
        params.from = `${mes}-01`;
        params.to   = `${mes}-${String(lastDay).padStart(2, '0')}`;
      }
      const suffix = params.from ? `_${params.from.slice(0, 7)}` : '';
      await downloadXlsx('/exportar/programa-cosecha', `programa-cosecha${suffix}.xlsx`, params);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo exportar', type: 'error' });
    } finally {
      setExportandoPrograma(false);
    }
  }, [programPeriod, mes, weekDays, addToast]);

  const {
    handleStatusChange,
    handlePauseConfirm,
    handleDelete,
    handleOpenFinalizeModal,
    handleFinalizarConfirm,
    handleQuickAdjust,
    handleQuickAdjustTipo,
    handleSuspendDay,
    handleReactivateDay,
    handleUpsertNotaDia,
    handleDeleteNotaDia,
    handleOpenAdjustModal,
    handleAplicarAjusteDia,
    handleAplicarSemana,
  } = useProgramaActions({
    addToast,
    load,
    confirmDelete,
    pauseModal,
    pauseForm,
    adjustProgram,
    finalizingProgram,
    finalizeForm,
    setConfirmDelete,
    setPauseModal,
    setSuspendPopover,
    setNotaPopover,
    setFinalizingProgram,
    setFinalizeForm,
    setShowFinalizeModal,
    setContinuitySource,
    setShowContinuityModal,
    setAdjustProgram,
    setAdjustForm,
    setShowAdjustModal,
    setSelectedDay,
    setImpactoAjuste,
    tiposTransporte,
  });

  const {
    programasPeriodo,
    getProgramCamionesStatus,
  } = useBiomasaComputed({ programas, calData, weekDays, mes, programPeriod, enrichCalendarItem });

  if (!isStatusView && !isTratosView && !isProgramView && !isMuestreosView) return <Navigate to="/biomasa/status" replace />;

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Operaciones</p>
          <h1>Operaciones</h1>
        </div>
      </header>

      <div className={`mx-content-frame biomasa-content-frame ${isMuestreosView ? 'biomasa-content-frame--muestreos' : ''}`}>
        {isProgramView && (
        <div className="prog-sub-nav-bar">
          <div className="prog-sub-nav" data-tour="programa-vistas">
            <button className={`prog-sub-nav-btn${progSubTab === 'programa' ? ' active' : ''}`} onClick={() => setProgSubTab('programa')}><ListIcon size={13} /> Programa</button>
            <button className={`prog-sub-nav-btn${progSubTab === 'calendario' ? ' active' : ''}`} onClick={() => setProgSubTab('calendario')}><LayoutGrid size={13} /> Calendario</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpTourButton tourId="biomasa" />
            {progSubTab === 'programa' && (
              <button className="mx-btn mx-btn-primary" onClick={() => handleOpenModal()} data-tour="programa-crear">
                <Plus size={18} /> Crear Programa
              </button>
            )}
          </div>
        </div>
        )}

        <div className="tab-content-area">
          {isStatusView && <DisponibilidadView items={disp} loading={loading} mes={mes} setMes={setMes} reload={load} />}
          {isTratosView && (
            <Suspense fallback={<div className="mx-loading-placeholder"><div className="mx-spinner"></div><p>Cargando tratos...</p></div>}>
              <Tratos onCrearPrograma={handleOpenModal} />
            </Suspense>
          )}

          {isProgramView && (
            <ProgramaCosechaView
              progSubTab={progSubTab}
              setProgSubTab={setProgSubTab}
              programPeriod={programPeriod}
              setProgramPeriod={setProgramPeriod}
              calView={calView}
              setCalView={setCalView}
              mes={mes}
              setMes={setMes}
              weekDays={weekDays}
              calendarMetric={calendarMetric}
              setCalendarMetric={setCalendarMetric}
              isCalendarBoard={isCalendarBoard}
              calendarBoardRef={calendarBoardRef}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              currentWeekOffset={currentWeekOffset}
              setCurrentWeekOffset={setCurrentWeekOffset}
              filterProveedor={filterProveedor}
              setFilterProveedor={setFilterProveedor}
              filterProducto={filterProducto}
              setFilterProducto={setFilterProducto}
              showAllProviders={showAllProviders}
              setShowAllProviders={setShowAllProviders}
              programasPeriodo={programasPeriodo}
              weekData={weekData}
              weekSummaries={weekSummaries}
              weekSummaryFull={weekSummaryFull}
              monthSummary={monthSummary}
              monthData={monthData}
              allMonthProviders={allMonthProviders}
              allMonthProducts={allMonthProducts}
              allWeekProviders={allWeekProviders}
              allWeekProducts={allWeekProducts}
              programasById={programasById}
              filteredProgramIds={filteredProgramIds}
              calData={calData}
              notasDia={notasDia}
              tratosAcordados={tratosAcordados}
              handleOpenModal={handleOpenModal}
              handleOpenAdjustModal={handleOpenAdjustModal}
              handleOpenFinalizeModal={handleOpenFinalizeModal}
              handleStatusChange={handleStatusChange}
              handleQuickAdjust={handleQuickAdjust}
              handleReactivateDay={handleReactivateDay}
              handleCalendarBoardToggle={handleCalendarBoardToggle}
              setSuspendPopover={setSuspendPopover}
              setNotaPopover={setNotaPopover}
              setPauseModal={setPauseModal}
              setPauseForm={setPauseForm}
              setConfirmDelete={setConfirmDelete}
              moveProgramPeriod={moveProgramPeriod}
              enrichCalendarItem={enrichCalendarItem}
              tonsPerTruck={tonsPerTruck}
              tiposTransporte={tiposTransporte}
              handleQuickAdjustTipo={handleQuickAdjustTipo}
              getProgramCamionesStatus={getProgramCamionesStatus}
              onExportarPrograma={handleExportarPrograma}
              exportandoPrograma={exportandoPrograma}
              handleAplicarSemana={handleAplicarSemana}
            />
          )}
          {isMuestreosView && (
            <Suspense
              fallback={
                <div className="mx-loading-placeholder">
                  <div className="mx-spinner"></div>
                  <p>Cargando muestreos...</p>
                </div>
              }
            >
              <Muestreos />
            </Suspense>
          )}
        </div>
      </div>


      <ProgramaModalesView
        showAdjustModal={showAdjustModal}
        setShowAdjustModal={setShowAdjustModal}
        adjustProgram={adjustProgram}
        adjustForm={adjustForm}
        setAdjustForm={setAdjustForm}
        handleAplicarAjusteDia={handleAplicarAjusteDia}
        impactoAjuste={impactoAjuste}
        setImpactoAjuste={setImpactoAjuste}
        showModal={showModal}
        setShowModal={setShowModal}
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        formData={formData}
        setFormData={setFormData}
        editingId={editingId}
        tratoSaldo={tratoSaldo}
        tratoLimites={tratoLimites}
        setTratoLimites={setTratoLimites}
        tratosAcordados={tratosAcordados}
        tiposTransporte={tiposTransporte}
        computeTratoLimites={computeTratoLimites}
        fetchTratoSaldo={fetchTratoSaldo}
        handleSave={handleSave}
        submitAttempted={submitAttempted}
        setSubmitAttempted={setSubmitAttempted}
        pauseModal={pauseModal}
        setPauseModal={setPauseModal}
        pauseForm={pauseForm}
        setPauseForm={setPauseForm}
        handlePauseConfirm={handlePauseConfirm}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        handleDelete={handleDelete}
        showFinalizeModal={showFinalizeModal}
        setShowFinalizeModal={setShowFinalizeModal}
        finalizingProgram={finalizingProgram}
        finalizeForm={finalizeForm}
        setFinalizeForm={setFinalizeForm}
        handleFinalizarConfirm={handleFinalizarConfirm}
        showContinuityModal={showContinuityModal}
        setShowContinuityModal={setShowContinuityModal}
        continuitySource={continuitySource}
        handleCrearContinuidad={handleCrearContinuidad}
        notaPopover={notaPopover}
        setNotaPopover={setNotaPopover}
        notasDia={notasDia}
        handleUpsertNotaDia={handleUpsertNotaDia}
        handleDeleteNotaDia={handleDeleteNotaDia}
        suspendPopover={suspendPopover}
        setSuspendPopover={setSuspendPopover}
        handleSuspendDay={handleSuspendDay}
      />
    </div>
  );
}
