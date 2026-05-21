import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildProviderDirectory, filterProviders } from './muestreos.helpers';
import { getMuestreoDirectorySources } from './muestreos.api';

export default function useMuestreoDirectory({ isModalOpen, addToast, setForm }) {
  const [searchProviders, setSearchProviders] = useState('');
  const [directory, setDirectory] = useState([]);
  const [allCentros, setAllCentros] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerCenters, setProviderCenters] = useState([]);

  useEffect(() => {
    if (!isModalOpen || directory.length > 0) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    async function loadDirectory() {
      try {
        const [centrosRes, contactosRes] = await getMuestreoDirectorySources({ signal: controller.signal });
        if (cancelled) return;

        const rawCentros = Array.isArray(centrosRes) ? centrosRes : (centrosRes.items || []);
        const rawContactos = Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || []);

        setAllCentros(rawCentros);
        setDirectory(buildProviderDirectory(rawCentros, rawContactos));
      } catch (error) {
        if (error.name === 'AbortError') return;
        addToast({ title: 'Error', message: 'No se pudo cargar el directorio de proveedores.', type: 'error' });
      }
    }

    loadDirectory();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isModalOpen, directory.length, addToast]);

  const filteredProviders = useMemo(
    () => filterProviders(directory, searchProviders),
    [directory, searchProviders]
  );

  const clearSelectedProvider = useCallback(() => {
    setSelectedProvider(null);
    setProviderCenters([]);
  }, []);

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setForm((prev) => ({
      ...prev,
      proveedorNombre: provider.proveedorNombre,
      proveedorKey: provider.proveedorKey,
      centroId: '',
      centroCodigo: '',
    }));
    setSearchProviders('');

    const centers = provider.isNew
      ? allCentros
      : allCentros.filter((centro) => (
        (centro.proveedorKey || '').toLowerCase() === (provider.proveedorKey || '').toLowerCase()
      ));

    setProviderCenters(centers);

    if (centers.length === 1) {
      setForm((prev) => ({
        ...prev,
        centroId: centers[0]._id,
        centroCodigo: centers[0].code,
      }));
    }
  }, [allCentros, setForm]);

  return {
    searchProviders,
    setSearchProviders,
    directory,
    setDirectory,
    allCentros,
    selectedProvider,
    setSelectedProvider,
    providerCenters,
    setProviderCenters,
    filteredProviders,
    clearSelectedProvider,
    handleSelectProvider,
  };
}
