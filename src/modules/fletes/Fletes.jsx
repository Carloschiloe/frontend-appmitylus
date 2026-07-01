import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, Truck, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { useToast } from '../../context/ToastContext';
import { downloadXlsx } from '../../utils/downloadXlsx';
import TransportistasTable from './components/TransportistasTable';
import TransportistaModal from './components/TransportistaModal';
import TarifaModal from './components/TarifaModal';
import ImportTransportistasModal from './components/ImportTransportistasModal';
import { useTransportistaMutations, useTransportistas } from './hooks/useTransportistas';
import './fletes.css';

const getErrorMessage = (error, fallback) => (
  error?.data?.error || error?.data?.message || error?.message || fallback
);

export default function Fletes() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [transportistaModal, setTransportistaModal] = useState({ open: false, item: null });
  const [tarifaModal, setTarifaModal] = useState({ open: false, transportista: null });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: transportistas = [], isLoading } = useTransportistas();

  const mutations = useTransportistaMutations({
    onSuccess: (message) => addToast({ type: 'success', title: 'Listo', message }),
    onError: (error) => addToast({
      type: 'error',
      title: 'Error',
      message: getErrorMessage(error, 'No se pudo completar la acción.'),
    }),
  });

  const filteredTransportistas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transportistas;
    return transportistas.filter((transportista) => [
      transportista.nombre,
      transportista.rut,
      transportista.contacto,
      transportista.telefono,
      transportista.email,
      ...(transportista.tarifas || []).map((tarifa) => `${tarifa.comuna} ${tarifa.tipoCamion}`),
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [search, transportistas]);

  const resumen = useMemo(() => ({
    total: transportistas.length,
    activos: transportistas.filter((item) => item.activo !== false).length,
    inactivos: transportistas.filter((item) => item.activo === false).length,
    tarifas: transportistas.reduce((sum, item) => sum + (item.tarifas?.length || 0), 0),
  }), [transportistas]);

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveTransportista = (payload) => {
    if (transportistaModal.item?._id) {
      mutations.updateTransportista.mutate(
        { id: transportistaModal.item._id, payload },
        { onSuccess: () => setTransportistaModal({ open: false, item: null }) },
      );
      return;
    }

    mutations.createTransportista.mutate(payload, {
      onSuccess: () => setTransportistaModal({ open: false, item: null }),
    });
  };

  const handleAddTarifa = (payload) => {
    const transportista = tarifaModal.transportista;
    if (!transportista?._id) return;
    const tarifas = [...(transportista.tarifas || []), payload];
    mutations.updateTarifas.mutate(
      { id: transportista._id, tarifas },
      { onSuccess: () => setTarifaModal({ open: false, transportista: null }) },
    );
  };

  const handleDelete = () => {
    if (!confirmDelete?._id) return;
    mutations.deleteTransportista.mutate(confirmDelete._id, {
      onSuccess: () => setConfirmDelete(null),
    });
  };

  const handleDownload = async () => {
    try {
      await downloadXlsx('/exportar/transportistas', `transportistas-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: error.message || 'No se pudo descargar el Excel.' });
    }
  };

  return (
    <div className="mx-page fletes-page">
      <header className="mx-hero fletes-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Operaciones · Fletes</p>
          <h1>Transportistas y tarifas</h1>
          <p>Administra transportistas y sus tarifas embebidas por comuna y tipo de camión.</p>
        </div>
        <div className="fletes-hero-actions">
          <button type="button" className="mx-btn mx-btn-outline" onClick={handleDownload}>
            <Download size={16} />
            Descargar Excel
          </button>
          <button type="button" className="mx-btn mx-btn-outline" onClick={() => setImportModalOpen(true)}>
            <Upload size={16} />
            Subir Excel
          </button>
          <button type="button" className="mx-btn mx-btn-primary" onClick={() => setTransportistaModal({ open: true, item: null })}>
            <Plus size={16} />
            Nuevo transportista
          </button>
        </div>
      </header>

      <section className="fletes-summary-grid">
        <div className="fletes-summary-card">
          <Truck size={18} />
          <span>Total</span>
          <strong>{resumen.total}</strong>
        </div>
        <div className="fletes-summary-card success">
          <Truck size={18} />
          <span>Activos</span>
          <strong>{resumen.activos}</strong>
        </div>
        <div className="fletes-summary-card muted">
          <Truck size={18} />
          <span>Inactivos</span>
          <strong>{resumen.inactivos}</strong>
        </div>
        <div className="fletes-summary-card info">
          <Truck size={18} />
          <span>Tarifas</span>
          <strong>{resumen.tarifas}</strong>
        </div>
      </section>

      <section className="fletes-toolbar">
        <div className="fletes-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar transportista, RUT, contacto, comuna o tipo de camión..."
          />
        </div>
      </section>

      {isLoading ? (
        <div className="mx-card fletes-loading">Cargando transportistas...</div>
      ) : (
        <TransportistasTable
          transportistas={filteredTransportistas}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onAddTarifa={(transportista) => setTarifaModal({ open: true, transportista })}
          onEditTransportista={(transportista) => setTransportistaModal({ open: true, item: transportista })}
          onDeleteTransportista={setConfirmDelete}
        />
      )}

      <TransportistaModal
        open={transportistaModal.open}
        initialValue={transportistaModal.item}
        isSaving={mutations.createTransportista.isPending || mutations.updateTransportista.isPending}
        onClose={() => setTransportistaModal({ open: false, item: null })}
        onSubmit={handleSaveTransportista}
      />

      <TarifaModal
        open={tarifaModal.open}
        transportista={tarifaModal.transportista}
        isSaving={mutations.updateTarifas.isPending}
        onClose={() => setTarifaModal({ open: false, transportista: null })}
        onSubmit={handleAddTarifa}
      />

      <ImportTransportistasModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        addToast={addToast}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['transportistas'] })}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDelete)}
        title="Desactivar transportista"
        itemName={confirmDelete?.nombre}
        description={confirmDelete ? `Se marcará "${confirmDelete.nombre}" como inactivo. Sus tarifas se conservarán para historial.` : ''}
        confirmLabel={mutations.deleteTransportista.isPending ? 'Desactivando...' : 'Desactivar'}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
