import React, { Suspense, lazy, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import './biomasa.css';
import {
  Plus,
  Inbox,
  ShoppingCart,
  Activity,
  LayoutGrid,
  List as ListIcon,
  Handshake,
  TestTube2,
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
import {
  mesActual, finMes,
  todayKey, toChileDateKey,
} from './utils/fechasChile';
import {
  asText,
  formatDailyAdjustmentText,
} from './utils/programaCalculos';
const Muestreos = lazy(() => import('../gestion/submodules/Muestreos'));
const Tratos = lazy(() => import('../gestion/submodules/Tratos'));

export default function Biomasa() {
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const isStatusView = location.pathname.includes('/status');
  const isTratosView = location.pathname.includes('/tratos');
  const isProgramView = location.pathname.includes('/programa');
  const isMuestreosView = location.pathname.includes('/muestreos');

  const [statusSubTab, setStatusSubTab] = useState('disponibilidad');
  const [progSubTab, setProgSubTab] = useState('programa');
  
  const [mes, setMes] = useState(mesActual);
  const [statusPeriod, setStatusPeriod] = useState('month'); // 'month' | 'week'
  const { loading, disp, asig, programas, calData, notasDia, tratosAcordados, tratosBiomasa, perdidasBiomasa, reload: load } = useBiomasaData(mes, {
    isStatusView,
    isProgramView,
    isMuestreosView,
    statusSubTab,
    progSubTab
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillTratoId = searchParams.get('tratoId');
  const prefillProgramaId = searchParams.get('programaId');
  const [hasHandledPrefill, setHasHandledPrefill] = useState(false);

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
  const [showSegModal, setShowSegModal] = useState(false);
  const [segProg, setSegProg] = useState(null);
  const [segNota, setSegNota] = useState('');
  const [segEstado, setSegEstado] = useState('');
  const [programPeriod, setProgramPeriod] = useState('month');
  const [followupPeriod, setFollowupPeriod] = useState('week');
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
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [isCalendarBoard, setIsCalendarBoard] = useState(false);
  const [calendarMetric, setCalendarMetric] = useState('both');
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [filterProveedor, setFilterProveedor] = useState(null);
  const [filterProducto, setFilterProducto] = useState(null);
  const [tonsPerTruck, setTonsPerTruck] = useState(11);
  const calendarBoardRef = useRef(null);

  const moveProgramPeriod = useCallback((direction) => {
    if (programPeriod === 'week') {
      setCurrentWeekOffset(offset => offset + direction);
      return;
    }

    setMes(prev => {
      const [y, m] = prev.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [programPeriod]);

  const moveFollowupPeriod = useCallback((direction) => {
    if (followupPeriod === 'week') {
      setCurrentWeekOffset(offset => offset + direction);
      return;
    }

    setMes(prev => {
      const [y, m] = prev.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [followupPeriod]);

  const moveStatusPeriod = useCallback((direction) => {
    if (statusPeriod === 'week') {
      setCurrentWeekOffset(offset => offset + direction);
      return;
    }

    setMes(prev => {
      const [y, m] = prev.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [statusPeriod]);

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
    const isWeekMode = (isStatusView && statusPeriod === 'week') ||
                       (isProgramView && (programPeriod === 'week' || (progSubTab === 'calendario' && calView === 'week')));
    if (isWeekMode && weekDays && weekDays[0]) {
      const weekMonth = weekDays[0].slice(0, 7);
      if (weekMonth !== mes) {
        setMes(weekMonth);
      }
    }
  }, [isStatusView, statusPeriod, isProgramView, programPeriod, progSubTab, calView, currentWeekOffset, weekDays, mes]);

  const programasPeriodo = useMemo(() => {
    // "Ver todos": sin filtro de período, devuelve todos los programas.
    if (programPeriod === 'all') return programas;

    const rangeStart = programPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = programPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);

    return programas.filter((programa) => {
      const desde = programa.vigenciaDesde ? new Date(programa.vigenciaDesde) : null;
      const hasta = programa.vigenciaHasta ? new Date(programa.vigenciaHasta) : null;
      return desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
    });
  }, [mes, programPeriod, programas, weekDays]);


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

  useEffect(() => {
    // Esperar a que loading haya terminado Y a que los datos hayan cargado.
    // tratosAcordados.length > 0 asegura que el fetch de /tratos-acordados completó;
    // si es vacío pero loading=false, puede ser un race condition en React 18 donde
    // setLoading(false) se procesó antes de setTratosAcordados([...]).
    // Solo disparamos el error "Trato no disponible" si la lista ya tiene datos
    // (indicando que el endpoint respondió) y el trato no está en ella.
    if ((prefillTratoId || prefillProgramaId) && !loading && !hasHandledPrefill && tratosAcordados && programas) {
      // Si tenemos prefillTratoId pero tratosAcordados está vacío, puede ser un race.
      // Dejamos que el efecto se vuelva a disparar cuando tratosAcordados tenga datos.
      if (prefillTratoId && tratosAcordados.length === 0 && programas.length === 0) {
        return; // datos aún no disponibles, esperar próximo render
      }

      setHasHandledPrefill(true);
      const search = new URLSearchParams(searchParams);
      search.delete('tratoId');
      search.delete('programaId');
      setSearchParams(search, { replace: true });

      const existingProgram = prefillProgramaId
        ? programas.find(p => String(p._id) === String(prefillProgramaId))
        : programas.find(p => String(p.tratoId) === String(prefillTratoId) && p.estado === 'activo');

      if (existingProgram) {
        if (!prefillProgramaId) {
          addToast({ title: 'Programa existente', message: 'Este trato ya tiene un programa activo.', type: 'info' });
        }
        if (existingProgram.proveedorNombre) {
          setFilterProveedor(existingProgram.proveedorNombre);
          if (progSubTab !== 'calendario') {
            setProgSubTab('calendario');
          }
        }
      } else if (prefillTratoId) {
        const t = tratosAcordados.find(x => String(x._id) === String(prefillTratoId));
        if (t) {
          if (progSubTab !== 'programa') setProgSubTab('programa');
          handleOpenModal(null, prefillTratoId);
        } else {
          addToast({ title: 'Trato no disponible', message: 'El trato solicitado no se puede programar (falta saldo o no está acordado).', type: 'warning' });
        }
      }
    }
  }, [prefillTratoId, prefillProgramaId, loading, tratosAcordados, programas, hasHandledPrefill, handleOpenModal, setSearchParams, searchParams, setFilterProveedor, addToast, progSubTab, setProgSubTab]);

  const {
    handleStatusChange,
    handlePauseConfirm,
    handleDelete,
    handleSegSave,
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
  } = useProgramaActions({
    addToast,
    load,
    confirmDelete,
    pauseModal,
    pauseForm,
    adjustProgram,
    segNota,
    segEstado,
    segProg,
    finalizingProgram,
    finalizeForm,
    setConfirmDelete,
    setPauseModal,
    setSuspendPopover,
    setNotaPopover,
    setShowSegModal,
    setSegNota,
    setSegEstado,
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
  });

  const recentDailyAdjustments = useMemo(() => {
    const weekSet = new Set(weekDays);
    return programas
      .flatMap((programa) => (programa.ajustesDiarios || []).map((ajuste) => ({
        ...ajuste,
        programaId: programa._id,
        proveedorNombre: programa.proveedorNombre,
        centroNombre: programa.centroNombre,
      })))
      .filter((ajuste) => {
        const dateKey = ajuste.fecha ? new Date(ajuste.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(dateKey) : dateKey.startsWith(mes);
      })
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))
      .slice(0, followupPeriod === 'week' ? 12 : 20);
  }, [followupPeriod, mes, programas, weekDays]);

  const followupPrograms = useMemo(() => {
    const rangeStart = followupPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = followupPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);
    const weekSet = new Set(weekDays);

    return programas
      .filter((programa) => {
        if (programa.estado !== 'activo') return false;
        const desde = programa.vigenciaDesde ? new Date(programa.vigenciaDesde) : null;
        const hasta = programa.vigenciaHasta ? new Date(programa.vigenciaHasta) : null;
        const overlapsVigencia = desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
        const hasAdjustmentInPeriod = (programa.diasEspeciales || []).some((item) => {
          const key = item?.fecha ? new Date(item.fecha).toISOString().slice(0, 10) : '';
          return followupPeriod === 'week' ? weekSet.has(key) : key.startsWith(mes);
        });
        return overlapsVigencia || hasAdjustmentInPeriod;
      });
  }, [followupPeriod, mes, programas, weekDays]);

  const followupSummary = useMemo(() => {
    const netDelta = recentDailyAdjustments.reduce((sum, ajuste) => sum + Number(ajuste.camionesDelta || 0), 0);
    const todayItems = (calData[todayKey()]?.items || []).map(enrichCalendarItem);
    return {
      activePrograms: followupPrograms.length,
      adjustments: recentDailyAdjustments.length,
      netDelta,
      todayCamiones: todayItems.reduce((sum, item) => sum + Number(item.camiones || 0), 0),
    };
  }, [calData, enrichCalendarItem, followupPrograms.length, recentDailyAdjustments]);

  const getLatestProgramNovelty = useCallback((programa) => {
    const weekSet = new Set(weekDays);
    const latestAdjustment = [...(programa?.ajustesDiarios || [])]
      .filter((ajuste) => {
        const dateKey = ajuste.fecha ? new Date(ajuste.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(dateKey) : dateKey.startsWith(mes);
      })
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))[0];
    if (latestAdjustment) return formatDailyAdjustmentText(latestAdjustment);
    return programa?.seguimientos?.[0]?.nota || 'Sin novedades registradas recientemente.';
  }, [followupPeriod, mes, weekDays]);

  const getProgramDayCamiones = useCallback((programa, dateKey = todayKey()) => {
    const base = Number(programa?.camionesDefault || 0);
    const calendarItem = (calData[dateKey]?.items || []).find(dayItem => String(dayItem.programaId) === String(programa?._id));
    if (calendarItem) return Number(calendarItem.camiones ?? base);

    const specialDay = (programa?.diasEspeciales || []).find((item) => toChileDateKey(item?.fecha) === dateKey);
    if (specialDay) return Number(specialDay.camiones ?? base);

    const latestAdjustment = [...(programa?.ajustesDiarios || [])]
      .filter((ajuste) => toChileDateKey(ajuste?.fecha) === dateKey)
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))[0];
    if (latestAdjustment) return Number(latestAdjustment.camionesDespues ?? base);

    return base;
  }, [calData]);

  const getTodayProgramCamiones = useCallback((programa) => (
    getProgramDayCamiones(programa, todayKey())
  ), [getProgramDayCamiones]);

  const getProgramCamionesStatus = useCallback((programa) => {
    const base = Number(programa?.camionesDefault || 0);
    const today = getTodayProgramCamiones(programa);
    return {
      base,
      today,
      adjusted: today !== base,
    };
  }, [getTodayProgramCamiones]);

  const kpis = useMemo(() => {
    const disponible = disp.reduce((s, i) => s + (i.tons || 0), 0);
    const totalAsignado = asig.reduce((s, i) => s + Number(i.tons || 0), 0);
    const pct = disponible > 0 ? (totalAsignado / disponible) * 100 : 0;
    return { disponible, totalAsignado, saldo: disponible - totalAsignado, pct };
  }, [disp, asig]);

  const getSituacionBiomasaLabel = (item) => {
    const raw = asText(item?.situacionBiomasa || item?.estado, '').toLowerCase();
    if (raw === 'en_conversacion' || raw === 'negociando') return 'En conversación';
    if (raw === 'reservada' || raw === 'semi_acordado' || raw === 'semi_cerrado') return 'Reservada';
    if (raw === 'acordada' || raw === 'acordado' || raw === 'cerrado' || raw === 'compra_efectuada') return 'Acordada';
    return asText(item?.situacionBiomasa || item?.estado, 'Sin definir');
  };

  const getProgramaLabel = (item) => {
    const raw = asText(item?.programaEstado, '').toLowerCase();
    if (raw === 'activo') return 'Programada';
    if (raw === 'pausado') return 'Programada pausada';
    if (raw === 'finalizado') return 'Ejecutada';
    return 'Sin programa';
  };

  const isDateInActiveWeek = useCallback((dateValue) => {
    if (!dateValue) return false;
    const dateStr = new Date(dateValue).toISOString().slice(0, 10);
    return weekDays.includes(dateStr);
  }, [weekDays]);

  const visibleTratosBiomasa = useMemo(() => {
    if (statusPeriod === 'month') return tratosBiomasa;
    return tratosBiomasa.filter(item => {
      const date = item?.fechaCierre || item?.updatedAt || item?.ultimaActividadAt || item?.fecha;
      return isDateInActiveWeek(date);
    });
  }, [statusPeriod, tratosBiomasa, isDateInActiveWeek]);

  const visiblePerdidasBiomasa = useMemo(() => {
    if (statusPeriod === 'month') return perdidasBiomasa;
    return perdidasBiomasa.filter(item => {
      const date = item?.fechaCierre || item?.updatedAt || item?.ultimaActividadAt || item?.fecha;
      return isDateInActiveWeek(date);
    });
  }, [statusPeriod, perdidasBiomasa, isDateInActiveWeek]);

  const visibleBiomasaPendiente = useMemo(
    () => visibleTratosBiomasa.filter((item) => !asText(item?.programaEstado, '').trim()),
    [visibleTratosBiomasa]
  );

  const visibleBiomasaVinculada = useMemo(
    () => visibleTratosBiomasa.filter((item) => asText(item?.programaEstado, '').trim()),
    [visibleTratosBiomasa]
  );

  const visibleNegociacionKpis = useMemo(() => {
    const sumTons = (items) => items.reduce((acc, item) => acc + (Number(item?.tonsAcordadas || item?.tons || item?.biomasaEstimacion || 0)), 0);
    const enConversacion = visibleBiomasaPendiente.filter((item) => getSituacionBiomasaLabel(item) === 'En conversación');
    const acordadas = visibleTratosBiomasa.filter((item) => getSituacionBiomasaLabel(item) === 'Acordada');
    return {
      enConversacionTons: sumTons(enConversacion),
      acordadasTons: sumTons(acordadas),
      perdidasTons: sumTons(visiblePerdidasBiomasa),
    };
  }, [visibleBiomasaPendiente, visiblePerdidasBiomasa, visibleTratosBiomasa]);

  if (!isStatusView && !isTratosView && !isProgramView && !isMuestreosView) return <Navigate to="/biomasa/status" replace />;

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Operaciones · Biomasa</p>
          <h1>Biomasa</h1>
        </div>
      </header>

      <div className={`mx-content-frame biomasa-content-frame ${isMuestreosView ? 'biomasa-content-frame--muestreos' : ''}`}>
        <div className="mx-toolbar">
          <div className="mx-toggle-group">
            <button className={`mx-toggle-btn ${isStatusView ? 'active' : ''}`} onClick={() => navigate('/biomasa/status')}><Inbox size={14} /> Disponibilidad</button>
            <button className={`mx-toggle-btn ${isTratosView ? 'active' : ''}`} onClick={() => navigate('/biomasa/tratos')}><Handshake size={14} /> Tratos</button>
            <button className={`mx-toggle-btn ${isProgramView ? 'active' : ''}`} onClick={() => navigate('/biomasa/programa')}><ShoppingCart size={14} /> Prog. de Cosecha</button>
            <button className={`mx-toggle-btn ${isMuestreosView ? 'active' : ''}`} onClick={() => navigate('/biomasa/muestreos')}><TestTube2 size={14} /> Muestreos</button>
          </div>
        </div>
        {isProgramView && (
        <div className="mx-toolbar">
          <div className="mx-toggle-group" data-tour="programa-vistas">
            <button className={`mx-toggle-btn ${progSubTab === 'programa' ? 'active' : ''}`} onClick={() => setProgSubTab('programa')}><ListIcon size={14} /> Programa</button>
            <button className={`mx-toggle-btn ${progSubTab === 'calendario' ? 'active' : ''}`} onClick={() => setProgSubTab('calendario')}><LayoutGrid size={14} /> Calendario cosechas</button>
            <button className={`mx-toggle-btn ${progSubTab === 'seguimiento' ? 'active' : ''}`} onClick={() => setProgSubTab('seguimiento')}><Activity size={14} /> Seguimiento</button>
          </div>
          {progSubTab === 'programa' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpTourButton tourId="biomasa" />
              <button className="mx-btn mx-btn-primary" onClick={() => handleOpenModal()} data-tour="programa-crear">
                <Plus size={18} /> Crear Programa
              </button>
            </div>
          )}
          {progSubTab !== 'programa' && <HelpTourButton tourId="biomasa" />}
        </div>
        )}

        <div className="tab-content-area">
          {isStatusView && <DisponibilidadView items={disp} loading={loading} mes={mes} setMes={setMes} reload={load} />}
          {isTratosView && (
            <Suspense fallback={<div className="mx-loading-placeholder"><div className="mx-spinner"></div><p>Cargando tratos...</p></div>}>
              <Tratos />
            </Suspense>
          )}

          {isProgramView && (
            <ProgramaCosechaView
              progSubTab={progSubTab}
              setProgSubTab={setProgSubTab}
              programPeriod={programPeriod}
              setProgramPeriod={setProgramPeriod}
              followupPeriod={followupPeriod}
              setFollowupPeriod={setFollowupPeriod}
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
              followupPrograms={followupPrograms}
              recentDailyAdjustments={recentDailyAdjustments}
              followupSummary={followupSummary}
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
              setSegProg={setSegProg}
              setShowSegModal={setShowSegModal}
              setPauseModal={setPauseModal}
              setPauseForm={setPauseForm}
              setConfirmDelete={setConfirmDelete}
              moveProgramPeriod={moveProgramPeriod}
              moveFollowupPeriod={moveFollowupPeriod}
              getTodayProgramCamiones={getTodayProgramCamiones}
              getLatestProgramNovelty={getLatestProgramNovelty}
              enrichCalendarItem={enrichCalendarItem}
              tonsPerTruck={tonsPerTruck}
              tiposTransporte={tiposTransporte}
              handleQuickAdjustTipo={handleQuickAdjustTipo}
              getProgramCamionesStatus={getProgramCamionesStatus}
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
        showSegModal={showSegModal}
        setShowSegModal={setShowSegModal}
        segNota={segNota}
        setSegNota={setSegNota}
        segEstado={segEstado}
        setSegEstado={setSegEstado}
        handleSegSave={handleSegSave}
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
