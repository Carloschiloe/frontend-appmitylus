import { useCallback } from 'react';
import { getMuestreoDetail } from './muestreos.api';

function buildEditableForm(muestreo) {
  return {
    proveedorKey: muestreo.proveedorKey || '',
    proveedorNombre: muestreo.proveedorNombre || muestreo.proveedor || '',
    centroId: muestreo.centroId || '',
    centroCodigo: muestreo.centroCodigo || muestreo.centro || '',
    centroNombre: muestreo.centroNombre || '',
    linea: muestreo.linea || '',
    fecha: (muestreo.fecha || '').slice(0, 10),
    origen: muestreo.origen || 'abastecimiento',
    responsable: muestreo.responsable || '',
    uxkg: muestreo.uXKg || muestreo.uxkg || '',
    pesoVivo: muestreo.pesoVivo || '',
    pesoCocida: muestreo.pesoCocida || muestreo.pesoCarne || '',
    cats: muestreo.cats || {},
    unidadPeso: muestreo.unidadPeso || 'kg',
    comentarios: muestreo.comentarios || muestreo.observaciones || '',
  };
}

function buildSelectedCatIds({ muestreo, maestros }) {
  const catIds = new Set();
  const details = muestreo.catDetails || {};

  maestros.cats
    .filter((cat) => cat.tipoCat === 'procesable')
    .forEach((cat) => catIds.add(cat._id));

  Object.keys(muestreo.cats || {}).forEach((catId) => {
    catIds.add(catId);
  });

  Object.entries(details).forEach(([catId, data]) => {
    if (data.obs || (data.photos && data.photos.length > 0)) {
      catIds.add(catId);
    }
  });

  return catIds;
}

function resolveProviderForMuestreo({ muestreo, directory }) {
  const providerKey = (muestreo.proveedorKey || '').toLowerCase();
  const provider = directory.find((item) => (item.proveedorKey || '').toLowerCase() === providerKey);

  if (provider) return provider;
  if (!muestreo.proveedorNombre && !muestreo.proveedor) return null;

  return {
    proveedorKey: muestreo.proveedorKey,
    proveedorNombre: muestreo.proveedorNombre || muestreo.proveedor,
    contactoNombre: 'Legacy',
    comuna: '',
  };
}

function buildProviderCenters({ muestreo, provider, allCentros }) {
  const centers = allCentros.filter((centro) => (
    (centro.proveedorKey || '').toLowerCase() === (provider.proveedorKey || '').toLowerCase()
  ));

  if (muestreo.centroId && !centers.some((centro) => centro._id === muestreo.centroId)) {
    centers.push({
      _id: muestreo.centroId,
      code: muestreo.centroCodigo || muestreo.centro || 'N/A',
      comuna: 'Legacy',
      proveedorKey: provider.proveedorKey,
    });
  }

  return centers;
}

export default function useMuestreoEdit({
  maestros,
  directory,
  allCentros,
  addToast,
  loadEvidence,
  setEditingId,
  setIsModalOpen,
  setStep,
  setIsLoadingDetails,
  setForm,
  setSelectedCats,
  setSelectedProvider,
  setProviderCenters,
}) {
  return useCallback(async (summaryItem) => {
    const id = summaryItem._id || summaryItem.id;
    if (!id) return;

    setEditingId(id);
    setIsModalOpen(true);
    setStep(1);
    setIsLoadingDetails(true);

    try {
      const muestreo = await getMuestreoDetail(id);

      setForm(buildEditableForm(muestreo));
      loadEvidence(muestreo);
      setSelectedCats(buildSelectedCatIds({ muestreo, maestros }));

      const provider = resolveProviderForMuestreo({ muestreo, directory });
      if (!provider) {
        setSelectedProvider(null);
        setProviderCenters([]);
        return;
      }

      setSelectedProvider(provider);
      setProviderCenters(buildProviderCenters({ muestreo, provider, allCentros }));
    } catch {
      addToast('Error al cargar muestreo completo', 'error');
      setIsModalOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [
    maestros,
    directory,
    allCentros,
    addToast,
    loadEvidence,
    setEditingId,
    setIsModalOpen,
    setStep,
    setIsLoadingDetails,
    setForm,
    setSelectedCats,
    setSelectedProvider,
    setProviderCenters,
  ]);
}
