import { useCallback } from 'react';
import { apiClient } from '../../../api/apiClient';
import { todayKey } from '../utils/fechasChile';

export function useProgramaActions({
  addToast,
  load,
  // State values
  confirmDelete,
  pauseModal,
  pauseForm,
  adjustForm,
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

  const handleOpenAdjustModal = useCallback((programa, fecha = todayKey(), currentCamiones = null, accion = 'sumar', currentTons = 0, composicionDia = []) => {
    if (!programa) return;
    const current = currentCamiones != null ? Number(currentCamiones || 0) : Number(programa.camionesDefault || 0);
    setAdjustProgram(programa);
    setAdjustForm({
      fecha,
      accion: accion,
      camiones: current,
      currentTons: currentTons,
      // Composición real del día (por tipo) para validar la resta en el modal.
      composicionDia: Array.isArray(composicionDia) ? composicionDia : [],
      motivo: 'Planta',
      nota: '',
      tipoTransporteId: '',
      tipoTransporteNombre: '',
      toneladasPorCamion: '',
    });
    setShowAdjustModal(true);
  }, []);

  const handleAdjustSave = useCallback(async (e) => {
    e.preventDefault();
    if (!adjustProgram?._id || !adjustForm.fecha) return;
    try {
      // Los botones +/- ajustan de a 1 camión: para 'sumar'/'suspender' el backend
      // espera el DELTA (siempre 1), no el total actual del día (que solo sirve al preview).
      const esIncremento = adjustForm.accion === 'sumar' || adjustForm.accion === 'suspender';
      const payload = { ...adjustForm, camiones: esIncremento ? 1 : Number(adjustForm.camiones || 0) };
      // composicionDia es solo estado de UI para validar la resta; no se envía al backend.
      delete payload.composicionDia;
      await apiClient.post(`/programa-cosecha/${adjustProgram._id}/ajuste-diario`, payload);
      addToast({
        title: 'Ajuste diario registrado',
        message: 'El calendario y el seguimiento fueron actualizados.',
        type: 'success',
      });
      setShowAdjustModal(false);
      setAdjustProgram(null);
      setSelectedDay(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [adjustForm, adjustProgram, addToast, load]);

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
    handleAdjustSave,
  };
}
