import React, { useState, useMemo, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useMuestreosData } from '../../../hooks/useMuestreosData';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import { useQueryClient } from '@tanstack/react-query';
import MuestreosHeaderControls from './MuestreosHeaderControls';
import MuestreoModalShell from './MuestreoModalShell';
import MuestreoImagePreview from './MuestreoImagePreview';
import MuestreoResultModal from './MuestreoResultModal';
import MuestreoShareModal from './MuestreoShareModal';
import MuestreoStepAnalisis from './MuestreoStepAnalisis';
import MuestreoStepContext from './MuestreoStepContext';
import MuestreoStepResultado from './MuestreoStepResultado';
import MuestreosTable from './MuestreosTable';
import useMuestreoDirectory from './useMuestreoDirectory';
import useMuestreoEdit from './useMuestreoEdit';
import useMuestreoEvidence from './useMuestreoEvidence';
import useMuestreoReport from './useMuestreoReport';
import useMuestreoSave from './useMuestreoSave';
import './muestreos.css';
import {
  computeSamplingTotals,
  filterMuestreos,
  getAvailableCats,
  getCurrentMonthKey,
  getSelectedCatsForTab,
  getWeekDays,
  getWeekLabel,
  groupMuestreosByProvider,
} from './muestreos.helpers';
import {
  deleteMuestreo,
} from './muestreos.api';

export default function Muestreos() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'

  // â”€â”€ Calendario navegador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [calView, setCalView] = useState('month'); // 'month' | 'week' | 'all'
  const [mes, setMes] = useState(getCurrentMonthKey);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => getWeekLabel(weekDays), [weekDays]);

  const { muestreos, maestros, loading, page, setPage, pagination, refresh: loadData } = useMuestreosData(
    viewMode,
    calView === 'month' ? { mes } : calView === 'week' ? { weekRange: weekDays } : {}
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMuestreo(deleteTarget._id);
      addToast({ title: 'Ã‰xito', message: 'Muestreo eliminado.', type: 'success' });
      loadData(page);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo eliminar.', type: 'error' });
    } finally {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, page, addToast, loadData]);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState(null); // { url, message, proveedor }

  // Formulario
  const [form, setForm] = useState({
    proveedorNombre: '',
    proveedorKey: '',
    centroId: '',
    centroCodigo: '',
    linea: '',
    fecha: new Date().toISOString().slice(0, 10),
    origen: 'abastecimiento',
    responsable: '',
    uxkg: '',
    pesoVivo: '',
    pesoCocida: '',
    cats: {},
    unidadPeso: 'kg',
    comentarios: '',
  });

  const [activeTab, setActiveTab] = useState('procesable'); // 'procesable', 'rechazo', 'defecto'
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const {
    catDetails,
    setCatDetails,
    generalPhotos,
    deletedPhotoKeys,
    previewImage,
    setPreviewImage,
    resetEvidence,
    loadEvidence,
    handleFileUpload,
    removePhoto,
    handleGeneralFileUpload,
    removeGeneralPhoto,
  } = useMuestreoEvidence({ editingId, addToast });

  const {
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
  } = useMuestreoDirectory({ isModalOpen, addToast, setForm });

  const resetForm = useCallback(() => {
    setForm({
      proveedorNombre: '',
      proveedorKey: '',
      centroId: '',
      centroCodigo: '',
      linea: '',
      fecha: new Date().toISOString().slice(0, 10),
      origen: 'abastecimiento',
      responsable: user?.nombre || '',
      uxkg: '',
      pesoVivo: '',
      pesoCocida: '',
      cats: {},
      unidadPeso: 'kg',
      comentarios: ''
    });
    resetEvidence();
    setEditingId(null);
    setStep(1);
    setSelectedProvider(null);
    setProviderCenters([]);
    setSearchProviders('');
    
    // Al resetear para un NUEVO muestreo, seleccionamos por defecto los procesables activos
    const defaultCats = maestros.cats
      .filter(c => c.tipoCat === 'procesable')
      .map(c => c._id);
    setSelectedCats(new Set(defaultCats));
    
    setIsModalOpen(true);
  }, [user, maestros.cats, resetEvidence, setProviderCenters, setSearchProviders, setSelectedProvider]);

  // Bloquear scroll y ocultar sidebar en mobile cuando el modal estÃ¡ abierto
  React.useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('mu-modal-open');
    } else {
      document.body.classList.remove('mu-modal-open');
    }
    return () => document.body.classList.remove('mu-modal-open');
  }, [isModalOpen]);

  const filteredAvailableCats = useMemo(
    () => getAvailableCats(maestros.cats, activeTab, selectedCats),
    [maestros.cats, activeTab, selectedCats]
  );

  const filteredSelectedCats = useMemo(() => getSelectedCatsForTab({
    selectedCats,
    cats: maestros.cats,
    activeTab,
    formCats: form.cats,
    catDetails,
  }), [selectedCats, maestros.cats, activeTab, form.cats, catDetails]);

  const totals = useMemo(
    () => computeSamplingTotals({ form, selectedCats, cats: maestros.cats }),
    [form, selectedCats, maestros.cats]
  );

  const filtered = useMemo(() => filterMuestreos(muestreos, searchTerm), [muestreos, searchTerm]);
  const groupedData = useMemo(() => groupMuestreosByProvider(filtered), [filtered]);

  // Handlers
  const handleAdvanceOnEnter = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const container = e.target.closest('.mu-step-container');
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll('input:not([disabled]):not([readonly]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])'));
      const index = focusable.indexOf(e.target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  }, []);

  const handleEdit = useMuestreoEdit({
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
  });

  const handleSave = useMuestreoSave({
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
  });

  const toggleCatSelection = useCallback((id) => {
    const next = new Set(selectedCats);
    if (next.has(id)) {
      const cat = maestros.cats.find(c => c._id === id);
      if (cat?.tipoCat !== 'procesable') {
        next.delete(id);
        const nextCats = { ...form.cats };
        delete nextCats[id];
        setForm({ ...form, cats: nextCats });
      }
    } else {
      next.add(id);
    }
    setSelectedCats(next);
  }, [selectedCats, maestros.cats, form]);

  const toggleGroup = useCallback((key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  }, [expandedGroups]);
  const { verReporte, compartirReporte, generarInformePDF } = useMuestreoReport({
    addToast,
    maestros,
    user,
    setIsLoadingDetails,
    setShareData,
    setIsShareModalOpen,
  });

  const activeTenant = localStorage.getItem('selected_tenant_db');
  const reporteId = new URLSearchParams(window.location.search).get('reporteId');
  const isEnabled = !!activeTenant || !!reporteId;

  if (!isEnabled) {
    return (
      <div className="muestreos-container am-p-24 mu-empty-tenant">
        <div className="am-text-center mu-empty-tenant-card">
          <div className="mu-empty-tenant-icon">
            <MapPin size={32} />
          </div>
          <h2>Empresa no seleccionada</h2>
          <p>
            Como administrador global, debes seleccionar una empresa en el panel superior para visualizar y gestionar sus registros de muestreo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="muestreos-container muestreos-compact muestreos-screen">

      <MuestreosHeaderControls
        calView={calView}
        mes={mes}
        onCalViewChange={(nextView) => { setCalView(nextView); setPage(1); }}
        onMesChange={(updater) => { setMes(updater); setPage(1); }}
        weekOffset={weekOffset}
        onWeekOffsetChange={(updater) => { setWeekOffset(updater); setPage(1); }}
        weekLabel={weekLabel}
        viewMode={viewMode}
        onViewModeChange={(nextView) => { setViewMode(nextView); setPage(1); }}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onRefresh={() => { setPage(1); loadData(1); }}
        onNewMuestreo={resetForm}
      />

      {loading ? (
        <div className="am-p-64 am-text-center"><div className="mx-loader"></div></div>
      ) : (
        <MuestreosTable
          viewMode={viewMode}
          filtered={filtered}
          groupedData={groupedData}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          pagination={pagination}
          page={page}
          onPageChange={setPage}
          isLoadingDetails={isLoadingDetails}
          editingId={editingId}
          onShare={compartirReporte}
          onReport={verReporte}
          onEdit={handleEdit}
          onDelete={(item) => { setDeleteTarget(item); setDeleteOpen(true); }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm}
        title="Â¿Eliminar este muestreo?"
        itemName={deleteTarget?.proveedorNombre || deleteTarget?.proveedor}
        description={deleteTarget ? `EstÃ¡s por eliminar el muestreo del ${new Date(deleteTarget.fecha).toLocaleDateString('es-CL')}${deleteTarget.centroCodigo ? ` en el centro ${deleteTarget.centroCodigo}` : ''}. Esta acciÃ³n no se puede deshacer.` : ''}
      />

      {isModalOpen && (
        <MuestreoModalShell
          editingId={editingId}
          step={step}
          onStepChange={setStep}
          onClose={() => setIsModalOpen(false)}
          isLoadingDetails={isLoadingDetails}
          onSave={handleSave}
          totals={totals}
        >
          {step === 1 && (
            <MuestreoStepContext
              form={form}
              setForm={setForm}
              selectedProvider={selectedProvider}
              onClearProvider={clearSelectedProvider}
              searchProviders={searchProviders}
              onSearchProvidersChange={setSearchProviders}
              filteredProviders={filteredProviders}
              onSelectProvider={handleSelectProvider}
              providerCenters={providerCenters}
            />
              )}

              {step === 2 && (
            <MuestreoStepAnalisis
              form={form}
              setForm={setForm}
              maestros={maestros}
              selectedCats={selectedCats}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isDropdownOpen={isDropdownOpen}
              setIsDropdownOpen={setIsDropdownOpen}
              filteredAvailableCats={filteredAvailableCats}
              filteredSelectedCats={filteredSelectedCats}
              toggleCatSelection={toggleCatSelection}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              totals={totals}
              catDetails={catDetails}
              setCatDetails={setCatDetails}
              generalPhotos={generalPhotos}
              setPreviewImage={setPreviewImage}
              handleAdvanceOnEnter={handleAdvanceOnEnter}
              handleFileUpload={handleFileUpload}
              removePhoto={removePhoto}
              handleGeneralFileUpload={handleGeneralFileUpload}
              removeGeneralPhoto={removeGeneralPhoto}
            />
          )}

          {step === 3 && <MuestreoStepResultado form={form} totals={totals} />}
        </MuestreoModalShell>
      )}

      <MuestreoResultModal
        isOpen={isResultOpen}
        resultData={resultData}
        onClose={() => setIsResultOpen(false)}
        onReport={generarInformePDF}
      />
      <MuestreoImagePreview image={previewImage} onClose={() => setPreviewImage(null)} />
      <MuestreoShareModal
        isOpen={isShareModalOpen}
        shareData={shareData}
        onClose={() => setIsShareModalOpen(false)}
        addToast={addToast}
      />
    </div>
  );
}





