import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
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
  parseNumberOrNull,
  getEstadoCierreFromApi,
} from '../../gestion/submodules/tratos.helpers';

export default function DisponibilidadEditTratoModal({ open, tratoId, onClose, onSuccess }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const currentResponsable = user?.nombre || user?.name || user?.username || user?.email || '';

  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm());
  const [editingEstadoApi, setEditingEstadoApi] = useState('');
  const [loadingTrato, setLoadingTrato] = useState(false);

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
    const all = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    if (!all.length) return [];
    const provKey = String(selectedProvider?.proveedorKey || '').toLowerCase();
    const codigoOrigen = String(form?.centroCodigo || '');
    return all.filter(c =>
      (provKey && String(c.proveedorKey || '').toLowerCase() === provKey) ||
      (codigoOrigen && String(c.code || '').toUpperCase() === codigoOrigen.toUpperCase())
    );
  }, [centrosRaw, selectedProvider, form]);

  const loadingProviders = loadingCentros || loadingContactos || loadingTrato;

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

  // Cargar el trato
  useEffect(() => {
    if (!open || !tratoId || !maestrosCondiciones.length) return;
    let active = true;
    setLoadingTrato(true);
    apiClient.get(`/oportunidades/${tratoId}`)
      .then((item) => {
        if (!active) return;
        setEditingEstadoApi(item.estado || '');
        const preselected = item.proveedorNombre ? {
          id: item.proveedorKey || item._id,
          contactoId: item.proveedorId || '',
          proveedorKey: item.proveedorKey || '',
          proveedorNombre: item.proveedorNombre || '',
          contactoNombre: item.meta?.contactoNombre || '',
          contactoTelefono: item.meta?.contactoTelefono || '',
          contactoEmail: item.meta?.contactoEmail || '',
          comuna: item.meta?.comuna || '',
          centros: item.centroCodigo ? 1 : 0,
        } : null;
        setSelectedProvider(preselected);
        setProviderSearch(item.proveedorNombre || '');
        setForm({
          proveedorNombre: item.proveedorNombre || '',
          responsableNombre: item.responsableNombre || currentResponsable,
          tonsAcordadas: item.tonsAcordadas || '',
          fechaInicioCosecha: item.vigenciaDesde
            ? item.vigenciaDesde.slice(0, 10)
            : (item.fechaCierre ? item.fechaCierre.slice(0, 10) : ''),
          estadoCierre: getEstadoCierreFromApi(item.estado),
          motivoCierre: item.motivoPerdida || item.motivoCierre || '',
          notas: item.notasTrato || item.notas || '',
          condiciones: buildInitialConditions(maestrosCondiciones, item.condiciones || []),
          transporteTrato: item.transportes?.[0] || null,
          centroCodigo: item.centroCodigo || '',
        });
      })
      .catch(() => {
        if (active) addToast({ title: 'Error', message: 'No se pudo cargar el trato', type: 'error' });
      })
      .finally(() => {
        if (active) setLoadingTrato(false);
      });
      
    return () => { active = false; };
  }, [open, tratoId, maestrosCondiciones, currentResponsable, addToast]);


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

  const handleConditionStatusChange = useCallback((idx, status) => {
    setForm((prev) => {
      const nextCond = [...prev.condiciones];
      nextCond[idx] = { ...nextCond[idx], estado: status };
      return { ...prev, condiciones: nextCond };
    });
  }, []);

  const handleClose = useCallback(() => {
    setProviderSearch('');
    setSelectedProvider(null);
    setForm(createEmptyForm(buildInitialConditions(maestrosCondiciones)));
    onClose();
  }, [maestrosCondiciones, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const volumenDesdeCondiciones = deriveVolumenDesdeCondiciones(form.condiciones);
      const tonsGuardadas = parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones;
      const tratoPayload = {
        tonsAcordadas: tonsGuardadas,
        precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
        notasTrato: form.notas || '',
        camionesXDia: deriveCamionesXDia(form.condiciones),
        vigenciaDesde: form.fechaInicioCosecha || null,
        condiciones: (form.condiciones || []).map((c) => ({
          ...c,
          valor: c.valor === '' ? null : c.valor,
        })),
        transportes: form.transporteTrato ? [form.transporteTrato] : [],
        centroCodigo: form.centroCodigo || '',
      };

      await apiClient.patch(`/oportunidades/${tratoId}/trato`, tratoPayload);

      // Estado automático según condiciones
      const todasAcordadas =
        form.condiciones.length > 0 &&
        form.condiciones.every(c => c.estado === 'acordado');
      const estadoCierreExplicito = form.estadoCierre; // perdido / descartado / cerrado_ok

      let nextEstadoCierre = estadoCierreExplicito;
      if (!nextEstadoCierre) {
        if (todasAcordadas) {
          nextEstadoCierre = 'acordado';
        } else if (editingEstadoApi === 'acordado') {
          // Si estaba acordado pero hay condiciones pendientes, vuelve a semi_acordado (pendiente)
          nextEstadoCierre = 'semi_acordado';
        }
      }

      if (nextEstadoCierre) {
        const apiEstado = nextEstadoCierre === 'cerrado_ok' ? 'compra_efectuada' : nextEstadoCierre;
        if (apiEstado !== editingEstadoApi) {
          if ((nextEstadoCierre === 'perdido' || nextEstadoCierre === 'descartado') && !form.motivoCierre?.trim()) {
            addToast({ title: 'Falta motivo', message: 'Indica el motivo del cierre antes de guardar.', type: 'warning' });
            return;
          }
          await apiClient.patch(`/oportunidades/${tratoId}/estado`, {
            estado: apiEstado,
            observacion: form.motivoCierre || form.notas || '',
          });
        }
      }

      addToast({ title: 'Trato guardado', message: 'Los cambios fueron aplicados.', type: 'success' });
      await queryClient.invalidateQueries(['tratos']);
      await queryClient.invalidateQueries(['oportunidades']);
      
      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      addToast({ title: 'Error', message: error.message || 'No se pudo guardar el trato.', type: 'error' });
    }
  };

  return (
    <TratoFormModal
      isOpen={open}
      editingId={tratoId}
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
      onSubmit={handleSubmit}
      onFormChange={setForm}
      onProviderSearchChange={setProviderSearch}
      onClearSelectedProvider={() => setSelectedProvider(null)}
      onSelectProvider={handleSelectProvider}
      onTransporteChange={handleTransporteChange}
      onConditionModeChange={handleConditionModeChange}
      onConditionValueChange={handleConditionValueChange}
      onConditionStatusChange={handleConditionStatusChange}
    />
  );
}
