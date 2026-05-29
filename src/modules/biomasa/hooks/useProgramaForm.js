import { useCallback } from 'react';
import { apiClient } from '../../../api/apiClient';
import { finMes } from '../utils/fechasChile';
import { fmtNumber, calcTerminoProgramaISO } from '../utils/programaCalculos';

export function useProgramaForm({
  addToast,
  load,
  mes,
  tratosAcordados,
  programas,
  formData,
  tratoSaldo,
  editingId,
  continuitySource,
  // Setters
  setTratoSaldo,
  setTratoLimites,
  setEditingId,
  setFormData,
  setSubmitAttempted,
  setShowModal,
  setShowConfirm,
  setShowContinuityModal,
}) {
  const fetchTratoSaldo = useCallback(async (tratoId, excludeId = null) => {
    if (!tratoId) { setTratoSaldo(null); return; }
    try {
      const params = excludeId ? `?excludeId=${excludeId}` : '';
      const data = await apiClient.get(`/programa-cosecha/saldo-trato/${tratoId}${params}`);
      setTratoSaldo({ tonsAcordadas: data.tonsAcordadas, tonsYaProgramadas: data.tonsYaProgramadas, tonsDisponibles: data.tonsDisponibles });
    } catch {
      setTratoSaldo(null);
    }
  }, []);

  const computeTratoLimites = useCallback((trato) => {
    if (!trato) return { vigenciaDesde: '', vigenciaHasta: '', maxCamionesDia: null };
    const maxCamionesDia = Array.isArray(trato.transportes) && trato.transportes.length > 0
      ? trato.transportes.reduce((s, tr) => s + (Number(tr.cantidadDiaria) || 0), 0)
      : (Number(trato.camionesXDia) || null);
    return {
      vigenciaDesde: trato.vigenciaDesde?.split('T')[0] || '',
      vigenciaHasta: (trato.fechaTerminoCosecha || trato.vigenciaHasta)?.split('T')[0] || '',
      maxCamionesDia,
    };
  }, []);

  const handleOpenModal = useCallback((item = null) => {
    if (item) {
      // Editing existing program
      const trato = tratosAcordados.find(x => String(x._id) === String(item.tratoId));
      setTratoLimites(computeTratoLimites(trato));
      setEditingId(item._id);
      fetchTratoSaldo(item.tratoId, item._id);

      // Convertir todos los transportes a filas (compatibilidad con programas legacy)
      const transportRows = Array.isArray(item.transportes) && item.transportes.length > 0
        ? item.transportes.map(t => {
            const tTpc = Number(t.toneladasPorCamion) || 0;
            const tCam = t.camionesTotales != null
              ? t.camionesTotales
              : (tTpc > 0 && item.tonsEstimadas ? Math.round(item.tonsEstimadas / tTpc) : '');
            return {
              tipoTransporteId: t.tipoTransporteId ? String(t.tipoTransporteId) : '',
              tipoTransporteNombre: t.tipoTransporteNombre || '',
              camionesTotales: tCam,
              cantidadDia: t.cantidadDia ?? item.camionesDefault ?? '',
              toneladasPorCamion: t.toneladasPorCamion ?? '',
            };
          })
        : [{ tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }];

      setFormData({
        tratoId: item.tratoId || '',
        vigenciaDesde: item.vigenciaDesde ? item.vigenciaDesde.split('T')[0] : '',
        vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.split('T')[0] : '',
        tipoProducto: item.tipoProducto || item.tipoProductoSugerido || 'sin_definir',
        diasSemana: item.diasSemana || [0, 1, 2, 3, 4],
        modoProgramacion: 'camiones',
        camionesTotales: '',
        tonsAProgramar: '',
        tipoTransporteId: '',
        tipoTransporteNombre: '',
        toneladasPorCamion: '',
        camionesPorDia: '',
        modoAvanzado: true,
        transportesAvanzados: transportRows,
        notas: item.notas || '',
        diasEspeciales: item.diasEspeciales || [],
        condicionContinuidad: item.condicionContinuidad || '',
        camionesDefault: item.camionesDefault || 1,
      });
    } else {
      // New program
      const t = tratosAcordados.length > 0 ? tratosAcordados[0] : null;
      const limites = computeTratoLimites(t);
      setTratoLimites(limites);
      setEditingId(null);
      setFormData({
        tratoId: t?._id || '',
        vigenciaDesde: limites.vigenciaDesde || `${mes}-01`,
        vigenciaHasta: limites.vigenciaHasta || finMes(mes),
        tipoProducto: t?.tipoProducto || t?.tipoProductoSugerido || 'sin_definir',
        diasSemana: [0, 1, 2, 3, 4],
        modoProgramacion: 'camiones',
        camionesTotales: '',
        tonsAProgramar: '',
        tipoTransporteId: '',
        tipoTransporteNombre: '',
        toneladasPorCamion: '',
        camionesPorDia: '',
        modoAvanzado: true,
        transportesAvanzados: [{ tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }],
        notas: '',
        diasEspeciales: [],
        condicionContinuidad: '',
        camionesDefault: 1,
      });
      fetchTratoSaldo(t?._id);
    }
    setSubmitAttempted(false);
    setShowModal(true);
  }, [tratosAcordados, mes, computeTratoLimites, fetchTratoSaldo]);

  const handleSave = useCallback(async (e) => {
    e?.preventDefault?.();
    const selectedTrato = tratosAcordados.find(t => t._id === formData.tratoId);

    // Build transport payload and derive tonsEstimadas
    let tonsEstimadas, transportesPayload, totalToneladasDia;
    const tpc = Number(formData.toneladasPorCamion) || 0;
    const cpd = Number(formData.camionesPorDia) || 0;

    if (formData.modoAvanzado) {
      transportesPayload = formData.transportesAvanzados.map(t => ({
        tipoTransporteId: t.tipoTransporteId || null,
        tipoTransporteNombre: t.tipoTransporteNombre || '',
        camionesTotales: Number(t.camionesTotales) || 0,
        cantidadDia: Number(t.cantidadDia) || 1,
        toneladasPorCamion: t.toneladasPorCamion !== '' && t.toneladasPorCamion != null ? Number(t.toneladasPorCamion) : null,
        costoFlete: null,
      }));
      tonsEstimadas = transportesPayload.reduce((s, t) => s + (t.camionesTotales || 0) * (t.toneladasPorCamion || 0), 0);
      totalToneladasDia = transportesPayload.reduce((s, t) => s + (t.cantidadDia || 0) * (t.toneladasPorCamion || 0), 0);
    } else if (formData.modoProgramacion === 'toneladas') {
      tonsEstimadas = Number(formData.tonsAProgramar) || 0;
      totalToneladasDia = cpd * tpc;
      transportesPayload = [{
        tipoTransporteId: formData.tipoTransporteId || null,
        tipoTransporteNombre: formData.tipoTransporteNombre || '',
        camionesTotales: tpc > 0 ? Math.ceil(tonsEstimadas / tpc) : null,
        cantidadDia: cpd,
        toneladasPorCamion: tpc || null,
        costoFlete: null,
      }];
    } else {
      // modo camiones (default)
      const camionesTotales = Number(formData.camionesTotales) || 0;
      tonsEstimadas = camionesTotales * tpc;
      totalToneladasDia = cpd * tpc;
      transportesPayload = [{
        tipoTransporteId: formData.tipoTransporteId || null,
        tipoTransporteNombre: formData.tipoTransporteNombre || '',
        camionesTotales,
        cantidadDia: cpd,
        toneladasPorCamion: tpc || null,
        costoFlete: null,
      }];
    }

    // Validar: total programa vs disponible del trato
    const disponible = tratoSaldo?.tonsDisponibles;
    if (disponible != null && tonsEstimadas > disponible) {
      addToast({
        title: 'Saldo insuficiente',
        message: `No puedes programar ${fmtNumber(tonsEstimadas, 0)} t. Disponible del trato: ${fmtNumber(disponible, 0)} t.`,
        type: 'error',
      });
      return;
    }

    // Validar: ritmo diario no puede superar total del programa
    if (totalToneladasDia > 0 && tonsEstimadas > 0 && totalToneladasDia > tonsEstimadas) {
      const diasRes = Math.ceil(tonsEstimadas / totalToneladasDia);
      addToast({
        title: 'Ritmo excesivo',
        message: `El ritmo diario (${fmtNumber(totalToneladasDia, 0)} t/día) supera el total del programa (${fmtNumber(tonsEstimadas, 0)} t). Solo ${diasRes} día efectivo. Reduce los camiones por día.`,
        type: 'error',
      });
      return;
    }

    const syntheticTpts = transportesPayload.map(t => ({ cantidadDia: t.cantidadDia, toneladasPorCamion: t.toneladasPorCamion }));
    const terminoISO = calcTerminoProgramaISO(formData.vigenciaDesde, tonsEstimadas, syntheticTpts, formData.diasSemana);
    const camionesDefault = transportesPayload.reduce((s, t) => s + (Number(t.cantidadDia) || 0), 0) || 1;

    const payload = {
      tratoId: formData.tratoId,
      vigenciaDesde: formData.vigenciaDesde,
      vigenciaHasta: terminoISO || formData.vigenciaHasta || undefined,
      camionesDefault,
      tipoProducto: formData.tipoProducto,
      diasSemana: formData.diasSemana,
      modoProgramacion: formData.modoAvanzado ? 'camiones' : formData.modoProgramacion,
      tonsEstimadas: tonsEstimadas || null,
      transportes: transportesPayload,
      notas: formData.notas,
      diasEspeciales: formData.diasEspeciales || [],
      condicionContinuidad: formData.condicionContinuidad || '',
      proveedorNombre: selectedTrato?.proveedorNombre || programas.find(p => p._id === editingId)?.proveedorNombre || '',
      centroNombre: selectedTrato?.centroNombre || selectedTrato?.centroCodigo || programas.find(p => p._id === editingId)?.centroNombre || '',
    };

    try {
      const endpoint = editingId ? `/programa-cosecha/${editingId}` : '/programa-cosecha';
      const method = editingId ? 'put' : 'post';
      await apiClient[method](endpoint, payload);
      addToast({ title: editingId ? 'Programa Actualizado' : 'Programa Creado', message: editingId ? 'Los cambios fueron guardados.' : 'El programa de cosecha fue creado.', type: 'success' });
      setShowModal(false);
      setShowConfirm(false);
      load();
    } catch (err) {
      if (err?.data?.code === 'TONS_EXCEED_TRATO') {
        const d = err.data?.details || {};
        addToast({ title: 'Saldo insuficiente', message: `No puedes programar ${d.tonsSolicitadas} t. El trato tiene solo ${d.tonsDisponibles} t disponibles.`, type: 'error' });
      } else if (err?.data?.code === 'ERR_CAPACITY_EXCEEDS_OBJETIVO') {
        const d = err.data?.details || {};
        addToast({ title: 'Ritmo excesivo', message: `Ritmo: ${fmtNumber(d.totalTDia || 0, 0)} t/día vs total ${fmtNumber(d.tonsEstimadas || 0, 0)} t (${d.diasResultantes ?? 1} día). Reduce camiones/día.`, type: 'error' });
      } else {
        addToast({ title: 'Error', message: err.message, type: 'error' });
      }
    }
  }, [formData, tratoSaldo, tratosAcordados, programas, editingId, addToast, load]);

  const handleCrearContinuidad = useCallback(() => {
    if (!continuitySource) return;
    setShowContinuityModal(false);
    setEditingId(null);
    const firstT = continuitySource.transportes?.[0] || {};
    const modo = continuitySource.modoProgramacion || (firstT.camionesTotales != null ? 'camiones' : 'toneladas');
    const isAvanzado = Array.isArray(continuitySource.transportes) && continuitySource.transportes.length > 1;
    setFormData({
      tratoId: continuitySource.tratoId || '',
      vigenciaDesde: '',
      vigenciaHasta: '',
      tipoProducto: continuitySource.tipoProducto || 'sin_definir',
      diasSemana: continuitySource.diasSemana || [0, 1, 2, 3, 4],
      modoProgramacion: modo,
      camionesTotales: '',
      tonsAProgramar: '',
      tipoTransporteId: firstT.tipoTransporteId ? String(firstT.tipoTransporteId) : '',
      tipoTransporteNombre: firstT.tipoTransporteNombre || '',
      toneladasPorCamion: firstT.toneladasPorCamion ?? '',
      camionesPorDia: firstT.cantidadDia ?? continuitySource.camionesDefault ?? '',
      modoAvanzado: isAvanzado,
      transportesAvanzados: isAvanzado
        ? continuitySource.transportes.map(t => ({
            tipoTransporteId: t.tipoTransporteId ? String(t.tipoTransporteId) : '',
            tipoTransporteNombre: t.tipoTransporteNombre || '',
            camionesTotales: '',
            cantidadDia: t.cantidadDia ?? 1,
            toneladasPorCamion: t.toneladasPorCamion ?? '',
          }))
        : [],
      notas: '',
      diasEspeciales: [],
      condicionContinuidad: 'Sin Condición',
      camionesDefault: continuitySource.camionesDefault || 1,
    });
    setTratoLimites({ vigenciaDesde: '', vigenciaHasta: '', maxCamionesDia: null });
    fetchTratoSaldo(continuitySource.tratoId);
    setSubmitAttempted(false);
    setShowModal(true);
  }, [continuitySource, fetchTratoSaldo]);

  return {
    fetchTratoSaldo,
    computeTratoLimites,
    handleOpenModal,
    handleSave,
    handleCrearContinuidad,
  };
}
