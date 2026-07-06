import { useCallback } from 'react';
import { apiClient } from '../../../api/apiClient';
import { todayKey } from '../utils/fechasChile';
import { buildImpactoAjuste, esFechaEnVigencia } from '../utils/programaImpacto';
import { getProgramVolumeProgress, getEffectiveTonsPerTruck } from '../utils/programaCalculos';

export function useProgramaActions({
  addToast,
  load,
  tiposTransporte,
  // State values
  confirmDelete,
  pauseModal,
  pauseForm,
  adjustProgram,
  segNota,
  segEstado,
  segProg,
  finalizingProgram,
  finalizeForm,
  // State setters
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
}) {
  const handleStatusChange = useCallback(async (id, nuevoEstado) => {
    try {
      await apiClient.patch(`/programa-cosecha/${id}/estado`, { estado: nuevoEstado });
      addToast({ title: nuevoEstado === 'activo' ? 'Programa Reanudado' : 'Programa Pausado', message: `El estado fue cambiado a ${nuevoEstado}.`, type: 'success' });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handlePauseConfirm = useCallback(async () => {
    if (!pauseModal) return;
    try {
      await apiClient.patch(`/programa-cosecha/${pauseModal.id}/estado`, {
        estado: 'pausado',
        pausadoDesde: pauseForm.pausadoDesde,
        motivoPausa: pauseForm.motivoPausa,
      });
      addToast({ title: 'Programa Pausado', message: `${pauseModal.proveedorNombre} pausado desde ${pauseForm.pausadoDesde}.`, type: 'success' });
      setPauseModal(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [pauseModal, pauseForm, addToast, load]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const nombre = confirmDelete.proveedorNombre;
    try {
      await apiClient.delete(`/programa-cosecha/${confirmDelete._id}`);
      addToast({ title: 'Programa Eliminado', message: `El programa de ${nombre} fue eliminado.`, type: 'success' });
      setConfirmDelete(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [confirmDelete, addToast, load]);

  const handleSegSave = useCallback(async (e) => {
    e.preventDefault();
    if (!segNota.trim() || !segEstado) return;
    try {
      await apiClient.post(`/programa-cosecha/${segProg._id}/seguimiento`, { estado: segEstado, nota: segNota });
      addToast({ title: 'Éxito', message: 'Novedad registrada con éxito', type: 'success' });
      setShowSegModal(false);
      setSegNota('');
      setSegEstado('');
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [segNota, segEstado, segProg, addToast, load]);

  const handleOpenFinalizeModal = useCallback((programa) => {
    setFinalizingProgram(programa);
    setFinalizeForm({ motivoCierre: '', nota: '', fechaCierre: todayKey() });
    setShowFinalizeModal(true);
  }, []);

  const handleFinalizarConfirm = useCallback(async (e) => {
    e.preventDefault();
    if (!finalizingProgram || !finalizeForm.motivoCierre) return;
    try {
      await apiClient.post(`/programa-cosecha/${finalizingProgram._id}/cerrar`, {
        motivoCierre: finalizeForm.motivoCierre,
        nota: finalizeForm.nota,
        fechaCierre: finalizeForm.fechaCierre,
      });
      addToast({ title: 'Programa finalizado', message: `El programa de ${finalizingProgram.proveedorNombre} fue cerrado.`, type: 'success' });
      setShowFinalizeModal(false);
      setContinuitySource(finalizingProgram);
      setShowContinuityModal(true);
      setFinalizingProgram(null);
      load();
    } catch (err) {
      addToast({ title: 'Error', message: err.message, type: 'error' });
    }
  }, [finalizingProgram, finalizeForm, addToast, load]);

  const handleQuickAdjust = useCallback(async (programa, fecha, delta, currentCamiones) => {
    if (!programa?._id) return;
    const base = currentCamiones != null ? Number(currentCamiones) : Number(programa.camionesDefault || 0);
    const nuevo = Math.max(0, base + delta);

    if (delta > 0 && programa.tonsEstimadas) {
      const tpp = getEffectiveTonsPerTruck(programa, 10, tiposTransporte);
      const vol = getProgramVolumeProgress(programa, tpp);
      if (tpp > 0 && (vol.consumed + tpp) > Number(programa.tonsEstimadas)) {
        addToast({
          title: '⚠️ Sobrepaso de biomasa acordada',
          message: `${programa.proveedorNombre}: quedarían ${Math.round(vol.consumed + tpp)} t programadas vs ${programa.tonsEstimadas} t acordadas.`,
          type: 'warning',
        });
      }
    }

    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha,
        accion: nuevo === 0 ? 'suspender_dia' : delta > 0 ? 'sumar' : 'set_total',
        camiones: delta > 0 ? 1 : nuevo,
        motivo: '',
        nota: '',
      });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  // Ajuste diario por tipo de transporte. accion: 'sumar' (+1 del tipo) | 'suspender' (-1 del tipo).
  const handleQuickAdjustTipo = useCallback(async (programa, fecha, accion, tipo) => {
    if (!programa?._id || !tipo?.tipoTransporteId) return;
    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha,
        accion,
        camiones: 1,
        motivo: '',
        nota: '',
        tipoTransporteId: tipo.tipoTransporteId,
        tipoTransporteNombre: tipo.tipoTransporteNombre || '',
        toneladasPorCamion: tipo.toneladasPorCamion ?? null,
      });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleSuspendDay = useCallback(async (programa, fecha, motivo, nota = '') => {
    if (!programa?._id) return;
    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha, accion: 'suspender_dia', camiones: 0, motivo, nota,
      });
      setSuspendPopover(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleReactivateDay = useCallback(async (programa, fecha) => {
    if (!programa?._id) return;
    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha, accion: 'set_total', camiones: programa.camionesDefault || 1, motivo: '', nota: '',
      });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleUpsertNotaDia = useCallback(async (fechaKey, nota) => {
    if (!fechaKey || !String(nota || '').trim()) return;
    try {
      await apiClient.post('/notas-dia', { fechaKey, nota });
      setNotaPopover(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleDeleteNotaDia = useCallback(async (fechaKey) => {
    try {
      await apiClient.delete(`/notas-dia/${fechaKey}`);
      setNotaPopover(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  // Abre el modal único "Ajustar día". accion: 'sumar' | 'restar' | 'suspender'.
  // composicionDia = desglose real del día (por tipo) para mostrar estado y validar la resta.
  const handleOpenAdjustModal = useCallback((programa, fecha = todayKey(), _currentCamiones = null, accion = 'sumar', _currentTons = 0, composicionDia = []) => {
    if (!programa) return;
    // Bloqueo defensivo: no abrir el modal en días sin programa activo (fuera de vigencia).
    // El backend es la fuente final, pero evitamos abrir el flujo en una fecha inválida.
    if (!esFechaEnVigencia(programa, fecha)) {
      addToast({ title: 'Sin programa', message: 'No hay programa activo para esta fecha.', type: 'error' });
      return;
    }
    setAdjustProgram(programa);
    setAdjustForm({
      fecha,
      accion,
      composicionDia: Array.isArray(composicionDia) ? composicionDia : [],
    });
    setShowAdjustModal(true);
  }, [addToast]);

  // Aplica un ajuste diario (sumar / descontar / suspender día) desde el modal único.
  // El backend valida y recalcula vigencia; con su respuesta se arma el impacto a mostrar.
  const handleAplicarAjusteDia = useCallback(async (payload) => {
    const programa = adjustProgram;
    if (!programa?._id || !payload?.fecha) return;
    try {
      const res = await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, payload);
      const after = res?.item || null;
      setShowAdjustModal(false);
      setAdjustProgram(null);
      setSelectedDay(null);
      if (after) setImpactoAjuste(buildImpactoAjuste(programa, after, payload));
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
      throw e; // el modal reactiva el botón Confirmar y se mantiene abierto
    }
  }, [adjustProgram, addToast, load, setShowAdjustModal, setAdjustProgram, setSelectedDay, setImpactoAjuste]);

  const handleAplicarSemana = useCallback(async (programa, diasConf) => {
    if (!programa?._id || !diasConf?.length) return;
    // Secuencial: el backend usa optimistic locking — si se envían en paralelo,
    // el primero sube la versión y los demás fallan con 409.
    try {
      for (const { fecha, accion, camiones } of diasConf) {
        await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
          fecha, accion, camiones, motivo: '', nota: '',
        });
      }
      load();
    } catch (e) {
      addToast({ title: 'Error al planificar semana', message: e.message, type: 'error' });
      throw e;
    }
  }, [addToast, load]);

  return {
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
    handleAplicarSemana,
  };
}
