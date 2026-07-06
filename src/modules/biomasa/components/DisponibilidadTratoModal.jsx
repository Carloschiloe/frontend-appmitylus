import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { crearTratoDesdeDisponibilidad } from '../../../api/api-mmpp';
import { maestrosApi } from '../../../api/api-maestros';
import { useContactos, useCentros } from '../../gestion/hooks/useGestionQueries';
import TratoFormModal from '../../gestion/submodules/TratoFormModal';
import '../../gestion/submodules/tratos.css';
import {
  buildInitialConditions,
  buildProviderDirectory,
  calcularFechaTerminoEstimadaTrato,
  createEmptyForm,
  deriveCamionesXDia,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  isCondicionCamionesDia,
  normalizeText,
  parseNumberOrNull,
} from '../../gestion/submodules/tratos.helpers';

export default function DisponibilidadTratoModal({ open, item, onClose, onSuccess }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const currentResponsable = user?.nombre || user?.name || user?.username || user?.email || '';

  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm());

  const { data: tiposTransporte = [] } = useQuery({
    queryKey: ['maestros', 'tipo_transporte'],
    queryFn: () => maestrosApi.getMaestrosActivos('tipo_transporte'),
    staleTime: 10 * 60 * 1000,
  });

  const { data: maestrosCondiciones = [] } = useQuery({
    queryKey: ['maestros', 'condicion_negociacion', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('condicion_negociacion'),
    staleTime: 10 * 60 * 1000,
  });

  const { data: centrosRaw, isLoading: loadingCentros } = useCentros({ enabled: open });
  const { data: contactosRaw, isLoading: loadingContactos } = useContactos({ conEmpresa: 1 }, { enabled: open });

  const providers = useMemo(() => {
    if (!open) return [];
    const centros = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    const contactos = Array.isArray(contactosRaw) ? contactosRaw : (contactosRaw?.items || []);
    return buildProviderDirectory(centros, contactos);
  }, [open, centrosRaw, contactosRaw]);

  const centrosProveedor = useMemo(() => {
    const provKey = selectedProvider?.proveedorKey || '';
    if (!provKey) return [];
    const all = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    return all.filter(c => c.proveedorKey === provKey);
  }, [centrosRaw, selectedProvider]);

  const loadingProviders = loadingCentros || loadingContactos;

  const filteredProviders = useMemo(() => {
    const query = providerSearch.trim().toLowerCase();
    return providers
      .filter((p) => {
        if (!query) return true;
        const provText = `${p.proveedorNombre || ''} ${p.proveedorKey || ''} ${p.comuna || ''}`.toLowerCase();
        const contactText = `${p.contactoNombre || ''} ${p.contactoTelefono || ''} ${p.contactoEmail || ''}`.toLowerCase();
        return provText.includes(query) || contactText.includes(query);
      })
      .slice(0, 10);
  }, [providers, providerSearch]);

  // Pre-cargar proveedor desde el item de disponibilidad
  useEffect(() => {
    if (!open || !item) return;
    const preselected = {
      id: `prov-${item.proveedorKey || ''}`,
      contactoId: item.proveedorId || '',
      proveedorKey: item.proveedorKey || '',
      proveedorNombre: item.proveedorNombre || item.proveedorNombreNorm || item.empresaNombre || '',
      contactoNombre: item.contactoNombre || '',
      contactoTelefono: item.contactoTelefono || '',
      contactoEmail: item.contactoEmail || '',
      comuna: item.comuna || '',
      centros: item.centroCodigo ? 1 : 0,
    };
    setSelectedProvider(preselected);
    setProviderSearch(preselected.proveedorNombre);
    setForm({
      ...createEmptyForm(buildInitialConditions(maestrosCondiciones)),
      responsableNombre: currentResponsable,
      tonsAcordadas: String(item.tons || item.tonsDisponible || ''),
      fechaInicioCosecha: item.mesKey ? `${item.mesKey}-01` : '',
    });
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializar condiciones cuando cargan los maestros
  useEffect(() => {
    if (!open || !maestrosCondiciones.length) return;
    setForm((prev) => ({
      ...prev,
      responsableNombre: prev.responsableNombre || currentResponsable,
      condiciones: prev.condiciones?.length ? prev.condiciones : buildInitialConditions(maestrosCondiciones),
    }));
  }, [open, maestrosCondiciones, currentResponsable]);

  // Auto-seleccionar tipo de transporte por defecto
  useEffect(() => {
    if (!open || !tiposTransporte.length || form.transporteTrato) return;
    const cCamiones = form.condiciones?.find((c) => isCondicionCamionesDia(c.nombre));
    if (!cCamiones) return;
    const tSimple = tiposTransporte.find((t) => normalizeText(t.nombre || t.label).includes('simple')) || tiposTransporte[0];
    if (tSimple) {
      setForm((prev) => ({
        ...prev,
        transporteTrato: {
          tipoTransporteId: tSimple._id || tSimple.id,
          nombre: tSimple.nombre || tSimple.label,
          cantidadDiaria: cCamiones.valor ? Number(cCamiones.valor) : null,
          maxisPorUnidad: tSimple.maxisPorUnidad,
          kgPorMaxiRef: tSimple.kgPorMaxiRef,
          capacidadToneladas: tSimple.totalRef || (tSimple.maxisPorUnidad && tSimple.kgPorMaxiRef
            ? (tSimple.maxisPorUnidad * tSimple.kgPorMaxiRef) / 1000
            : 11),
        },
      }));
    }
  }, [open, tiposTransporte, form.condiciones, form.transporteTrato]);

  const fechaTerminoEstimada = useMemo(
    () => calcularFechaTerminoEstimadaTrato({
      fechaInicioCosecha: form.fechaInicioCosecha,
      tonsAcordadas: form.tonsAcordadas,
      condiciones: form.condiciones,
      transporte: form.transporteTrato,
    }),
    [form.fechaInicioCosecha, form.tonsAcordadas, form.condiciones, form.transporteTrato],
  );

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setProviderSearch(provider.proveedorNombre || '');
    setForm((prev) => ({ ...prev, proveedorNombre: provider.proveedorNombre || '' }));
  }, []);

  const handleTransporteChange = useCallback((transporteUpdate) => {
    setForm((prev) => ({ ...prev, transporteTrato: transporteUpdate }));
  }, []);

  const handleConditionModeChange = useCallback((idx, modoCondicion) => {
    setForm((prev) => {
      const nextCond = [...prev.condiciones];
      nextCond[idx] = { ...nextCond[idx], modoCondicion, valor: modoCondicion === 'normal' ? '' : nextCond[idx].valor };
      return { ...prev, condiciones: nextCond };
    });
  }, []);

  const handleConditionValueChange = useCallback((idx, valor) => {
    setForm((prev) => {
      const nextCond = [...prev.condiciones];
      nextCond[idx] = { ...nextCond[idx], valor };
      return { ...prev, condiciones: nextCond };
    });
  }, []);

  const toggleCondicionStatus = useCallback((idx, status) => {
    setForm((prev) => {
      const nextCond = [...prev.condiciones];
      nextCond[idx] = { ...nextCond[idx], estado: status };
      return { ...prev, condiciones: nextCond };
    });
  }, []);

  const handleClose = useCallback(() => {
    setProviderSearch('');
    setSelectedProvider(null);
    setForm(createEmptyForm());
    onClose();
  }, [onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedProvider?.proveedorKey || !selectedProvider?.proveedorNombre) {
      addToast({ title: 'Falta proveedor', message: 'Selecciona un proveedor del listado antes de guardar.', type: 'warning' });
      return;
    }
    try {
      const volumenDesdeCondiciones = deriveVolumenDesdeCondiciones(form.condiciones);
      const condicionesFinales = (form.condiciones || []).map((c) => ({ ...c, valor: c.valor === '' ? null : c.valor }));

      // Crea el trato Y cierra la disponibilidad atómicamente
      const created = await crearTratoDesdeDisponibilidad(item._id, {
        tonsAcordadas: parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones,
        precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
        producto: item.producto || 'sin_definir',
        vigenciaDesde: form.fechaInicioCosecha || null,
        notasTrato: form.notas || '',
        condiciones: condicionesFinales,
      });

      const newId = created?._id || created?.item?._id;
      if (newId) {
        // Patchear camiones y transportes (no los maneja el endpoint crear-trato)
        await apiClient.patch(`/oportunidades/${newId}/trato`, {
          camionesXDia: deriveCamionesXDia(form.condiciones),
          transportes: form.transporteTrato ? [form.transporteTrato] : [],
        });
        const todasAcordadas = condicionesFinales.length > 0 && condicionesFinales.every((c) => c.estado === 'acordado');
        if (todasAcordadas) {
          await apiClient.patch(`/oportunidades/${newId}/estado`, { estado: 'acordado', observacion: form.notas || '' });
        }
      }

      await queryClient.refetchQueries({ queryKey: ['tratos'] });
      addToast({
        title: 'Trato creado',
        message: `${selectedProvider.proveedorNombre}: trato registrado correctamente.`,
        type: 'success',
      });
      handleClose();
      onSuccess?.();
    } catch (error) {
      const detalle = error?.data?.details?.[0]?.message || error?.data?.error || error?.message;
      addToast({
        title: 'Error al crear trato',
        message: detalle || 'Revisa los datos e intenta nuevamente.',
        type: 'error',
      });
    }
  };

  return (
    <TratoFormModal
      isOpen={open}
      editingId={null}
      form={form}
      fechaTerminoEstimada={fechaTerminoEstimada}
      selectedProvider={selectedProvider}
      providerSearch={providerSearch}
      loadingProviders={loadingProviders}
      filteredProviders={filteredProviders}
      tiposTransporte={tiposTransporte}
      centrosProveedor={centrosProveedor}
      loadingCentros={loadingCentros}
      onClose={handleClose}
      onSubmit={handleSave}
      onFormChange={setForm}
      onProviderSearchChange={setProviderSearch}
      onClearSelectedProvider={() => setSelectedProvider(null)}
      onSelectProvider={handleSelectProvider}
      onTransporteChange={handleTransporteChange}
      onConditionModeChange={handleConditionModeChange}
      onConditionValueChange={handleConditionValueChange}
      onConditionStatusChange={toggleCondicionStatus}
    />
  );
}
