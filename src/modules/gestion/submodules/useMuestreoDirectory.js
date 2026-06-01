import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildProviderDirectory, filterContacts, filterProviders } from './muestreos.helpers';
import { getMuestreoDirectorySources } from './muestreos.api';

export default function useMuestreoDirectory({ isModalOpen, addToast, setForm }) {
  const [searchProviders, setSearchProviders] = useState('');
  const [directory, setDirectory] = useState([]);
  const [allCentros, setAllCentros] = useState([]);
  const [allContactos, setAllContactos] = useState([]);
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
        setAllContactos(rawContactos);
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

  const rawProviders = useMemo(
    () => filterProviders(directory, searchProviders),
    [directory, searchProviders]
  );

  const rawContacts = useMemo(
    () => filterContacts(allContactos, searchProviders),
    [allContactos, searchProviders]
  );

  // Enrich provider rows with matched contacts; hide contacts already represented by a visible provider.
  const { filteredProviders, filteredContacts } = useMemo(() => {
    if (!rawProviders.length && !rawContacts.length) {
      return { filteredProviders: rawProviders, filteredContacts: rawContacts };
    }

    // Keys of companies already visible in the Empresas section (already lowercase from buildProviderDirectory)
    const visibleKeys = new Set(rawProviders.map((p) => p.proveedorKey).filter(Boolean));

    // Group matched contacts by their company key
    const contactsByKey = new Map();
    rawContacts.forEach((c) => {
      const key = (c.proveedorKey || '').trim().toLowerCase();
      if (key && visibleKeys.has(key)) {
        if (!contactsByKey.has(key)) contactsByKey.set(key, []);
        contactsByKey.get(key).push(c);
      }
    });

    // Attach matchedContacts to each provider that has them
    const enriched = rawProviders.map((provider) => {
      const matched = contactsByKey.get(provider.proveedorKey);
      return matched ? { ...provider, matchedContacts: matched } : provider;
    });

    // Only show contacts whose company is NOT already visible in Empresas
    const visible = rawContacts.filter((c) => {
      const key = (c.proveedorKey || '').trim().toLowerCase();
      return !key || !visibleKeys.has(key);
    });

    return { filteredProviders: enriched, filteredContacts: visible };
  }, [rawProviders, rawContacts]);

  const clearSelectedProvider = useCallback(() => {
    setSelectedProvider(null);
    setProviderCenters([]);
  }, []);

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setSearchProviders('');

    // Contacto existente: heredar empresa del contacto (puede estar vacía)
    const nombre = provider.isContact
      ? (provider.proveedorNombre || provider.nombre || '')
      : provider.proveedorNombre;
    const key = provider.isContact
      ? (provider.proveedorKey || '')
      : provider.proveedorKey;

    setForm((prev) => ({
      ...prev,
      proveedorNombre: nombre,
      proveedorKey: key,
      centroId: '',
      centroCodigo: '',
    }));

    const provKey = (key || '').toLowerCase();
    const centers = provider.isNew
      ? allCentros
      : provKey
        ? allCentros.filter((centro) => (centro.proveedorKey || '').toLowerCase() === provKey)
        : [];

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
    allContactos,
    selectedProvider,
    setSelectedProvider,
    providerCenters,
    setProviderCenters,
    filteredProviders,
    filteredContacts,
    clearSelectedProvider,
    handleSelectProvider,
  };
}
