import { useCallback } from 'react';
import { createMuestreoDirectoryContact, saveMuestreo } from './muestreos.api';

function buildMuestreoPayload({
  form,
  selectedCats,
  totals,
  catDetails,
  generalPhotos,
  deletedPhotoKeys,
}) {
  const multiplier = form.unidadPeso === 'g' ? 0.001 : 1;
  const finalCats = {};

  selectedCats.forEach((id) => {
    finalCats[id] = (Number(form.cats[id]) || 0) * multiplier;
  });

  let fecha = form.fecha || '';
  if (fecha.length === 10) {
    fecha = new Date(`${fecha}T12:00:00Z`).toISOString();
  }

  return {
    proveedorNombre: form.proveedorNombre || '',
    proveedorKey: form.proveedorKey || undefined,
    centroId: form.centroId || undefined,
    centroCodigo: form.centroCodigo || undefined,
    linea: form.linea || '',
    fecha,
    origen: form.origen || 'abastecimiento',
    responsable: form.responsable || '',
    uxkg: Number(form.uxkg) || 0,
    pesoVivo: Number(form.pesoVivo) || 0,
    pesoCocida: Number(form.pesoCocida) || 0,
    rendimiento: Number(totals.rend) || 0,
    total: Number(totals.totalMuestra) || 0,
    procesable: Number(totals.procesable) || 0,
    rechazos: Number(totals.rechazos) || 0,
    defectos: Number(totals.defectos) || 0,
    cats: finalCats,
    comentarios: form.comentarios || '',
    catDetails,
    generalPhotos,
    deletedPhotoKeys,
  };
}

function resolveProvider({ form, selectedProvider, directory }) {
  const currentProviderKey = String(form.proveedorKey || '').trim().toLowerCase();
  const currentProviderNombre = String(form.proveedorNombre || '').trim().toLowerCase();

  return selectedProvider || directory.find((provider) => (
    (provider.proveedorKey && String(provider.proveedorKey).trim().toLowerCase() === currentProviderKey) ||
    (provider.proveedorNombre && String(provider.proveedorNombre).trim().toLowerCase() === currentProviderNombre)
  ));
}

function buildDirectoryContactPayload({ form, allCentros, selectedProvider }) {
  const selectedCenter = allCentros.find((centro) => centro._id === form.centroId) || null;
  const contactName = selectedProvider?.pendingContact
    ? form.proveedorNombre
    : form.responsable || 'Contacto de Muestreo';

  return {
    nombre: contactName,
    entidad: form.proveedorNombre,
    contactoNombre: contactName,
    contactoEmail: '',
    contactoTelefono: '',
    proveedorKey: form.proveedorKey,
    proveedorNombre: form.proveedorNombre,
    centroId: form.centroId || '',
    centroCodigo: form.centroCodigo || '',
    centroComuna: selectedCenter?.comuna || '',
  };
}

export default function useMuestreoSave({
  form,
  selectedCats,
  totals,
  editingId,
  page,
  addToast,
  loadData,
  catDetails,
  generalPhotos,
  deletedPhotoKeys,
  selectedProvider,
  allCentros,
  directory,
  queryClient,
  setResultData,
  setIsModalOpen,
  setDirectory,
  setIsResultOpen,
}) {
  return useCallback(async () => {
    const payload = buildMuestreoPayload({
      form,
      selectedCats,
      totals,
      catDetails,
      generalPhotos,
      deletedPhotoKeys,
    });

    try {
      const resolvedProvider = resolveProvider({ form, selectedProvider, directory });
      const hasProviderName = String(form.proveedorNombre || '').trim().length > 0;
      const isExistingContact = selectedProvider?.isContact && !!selectedProvider?.contactoId;
      const needsContact = !isExistingContact && hasProviderName && (
        selectedProvider?.isNew ||
        selectedProvider?.pendingContact ||
        !resolvedProvider ||
        !resolvedProvider.contactoId
      );

      if (needsContact) {
        try {
          await createMuestreoDirectoryContact(buildDirectoryContactPayload({ form, allCentros, selectedProvider }));
          queryClient.invalidateQueries({ queryKey: ['contactos'] });
          addToast({ title: 'Directorio', message: 'Se ha creado automaticamente el nuevo proveedor en el directorio.', type: 'info' });
        } catch {
          addToast({ title: 'Directorio', message: 'El muestreo se guardara, pero no se pudo crear el contacto automaticamente.', type: 'warning' });
        }
      }

      const data = await saveMuestreo(editingId, payload);
      setResultData(data.item || data);
      setIsModalOpen(false);
      setDirectory([]);
      queryClient.invalidateQueries({ queryKey: ['muestreos'] });
      queryClient.invalidateQueries({ queryKey: ['contactos'] });
      setIsResultOpen(true);
      loadData(page);
      addToast({ title: 'Exito', message: `Muestreo ${editingId ? 'actualizado' : 'guardado'} correctamente.`, type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo guardar el muestreo.', type: 'error' });
    }
  }, [
    form,
    selectedCats,
    totals,
    editingId,
    page,
    addToast,
    loadData,
    catDetails,
    generalPhotos,
    deletedPhotoKeys,
    selectedProvider,
    allCentros,
    directory,
    queryClient,
    setResultData,
    setIsModalOpen,
    setDirectory,
    setIsResultOpen,
  ]);
}
