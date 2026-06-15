import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function usePrefillHandler({
  loading,
  tratosAcordados,
  programas,
  handleOpenModal,
  addToast,
  progSubTab,
  setProgSubTab,
  setFilterProveedor,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [hasHandledPrefill, setHasHandledPrefill] = useState(false);

  const prefillTratoId = searchParams.get('tratoId');
  const prefillProgramaId = searchParams.get('programaId');

  useEffect(() => {
    if (!(prefillTratoId || prefillProgramaId) || loading || hasHandledPrefill || !tratosAcordados || !programas) return;

    if (prefillTratoId && tratosAcordados.length === 0 && programas.length === 0) return;

    setHasHandledPrefill(true);
    const search = new URLSearchParams(searchParams);
    search.delete('tratoId');
    search.delete('programaId');
    setSearchParams(search, { replace: true });

    const existingProgram = prefillProgramaId
      ? programas.find((p) => String(p._id) === String(prefillProgramaId))
      : programas.find((p) => String(p.tratoId) === String(prefillTratoId) && p.estado === 'activo');

    if (existingProgram) {
      if (!prefillProgramaId) {
        addToast({ title: 'Programa existente', message: 'Este trato ya tiene un programa activo.', type: 'info' });
      }
      if (existingProgram.proveedorNombre) {
        setFilterProveedor(existingProgram.proveedorNombre);
        if (progSubTab !== 'calendario') setProgSubTab('calendario');
      }
    } else if (prefillTratoId) {
      const t = tratosAcordados.find((x) => String(x._id) === String(prefillTratoId));
      if (t) {
        if (progSubTab !== 'programa') setProgSubTab('programa');
        handleOpenModal(null, prefillTratoId);
      } else {
        addToast({ title: 'Trato no disponible', message: 'El trato solicitado no se puede programar (falta saldo o no está acordado).', type: 'warning' });
      }
    }
  }, [prefillTratoId, prefillProgramaId, loading, tratosAcordados, programas, hasHandledPrefill,
      handleOpenModal, setSearchParams, searchParams, setFilterProveedor, addToast, progSubTab, setProgSubTab]);
}
