import React, { useState, useMemo, useCallback } from 'react';
import { generarHTMLReporte } from '../../reportes/renderMuestreoReport';
import { 
  Plus, 
  Search, 
  X,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronDown,
  Check,
  Printer,
  User,
  MapPin,
  Layers,
  ArrowRight,
  ArrowLeft,
  Settings2,
  Target,
  Camera,
  Loader,
  Copy
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useMuestreosData } from '../../../hooks/useMuestreosData';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import { useQueryClient } from '@tanstack/react-query';
import MuestreosHeaderControls from './MuestreosHeaderControls';
import MuestreosTable from './MuestreosTable';
import {
  buildProviderDirectory,
  computeSamplingTotals,
  filterMuestreos,
  filterProviders,
  fmtNum,
  getAvailableCats,
  getCurrentMonthKey,
  getSelectedCatsForTab,
  getWeekDays,
  getWeekLabel,
  groupMuestreosByProvider,
} from './muestreos.helpers';
import {
  createPublicMuestreoShare,
  createMuestreoDirectoryContact,
  deleteMuestreo,
  deleteMuestreoEvidence,
  getMuestreoDetail,
  getMuestreoDirectorySources,
  getMuestreoReportDetail,
  saveMuestreo,
  uploadMuestreoEvidence,
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

  const [catDetails, setCatDetails] = useState({}); // { [id]: { obs: '', fotos: [] } }
  const [activeTab, setActiveTab] = useState('procesable'); // 'procesable', 'rechazo', 'defecto'
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [generalPhotos, setGeneralPhotos] = useState([]);
  const [deletedPhotoKeys, setDeletedPhotoKeys] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [previewImage]);

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
    setCatDetails({});
    setGeneralPhotos([]);
    setDeletedPhotoKeys([]);
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
  }, [user, maestros.cats]);

  // Buscador de Proveedor (PatrÃ³n Registro RÃ¡pido)
  const [searchProviders, setSearchProviders] = useState('');
  const [directory, setDirectory] = useState([]);
  const [allCentros, setAllCentros] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerCenters, setProviderCenters] = useState([]);

  // Carga de directorio (al abrir modal)
  React.useEffect(() => {
    if (!isModalOpen || directory.length > 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadDirectory() {
      try {
        const [centrosRes, contactosRes] = await getMuestreoDirectorySources({ signal: controller.signal });

        if (!cancelled) {
          const rawCentros = Array.isArray(centrosRes) ? centrosRes : (centrosRes.items || []);
          const rawContactos = Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || []);
          setAllCentros(rawCentros);
          setDirectory(buildProviderDirectory(rawCentros, rawContactos));
        }
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

  // Bloquear scroll y ocultar sidebar en mobile cuando el modal estÃ¡ abierto
  React.useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('mu-modal-open');
    } else {
      document.body.classList.remove('mu-modal-open');
    }
    return () => document.body.classList.remove('mu-modal-open');
  }, [isModalOpen]);

  const filteredProviders = useMemo(() => filterProviders(directory, searchProviders), [directory, searchProviders]);

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

  const handleSelectProvider = (provider) => {
    setSelectedProvider(provider);
    setForm(prev => ({
      ...prev,
      proveedorNombre: provider.proveedorNombre,
      proveedorKey: provider.proveedorKey,
      centroId: '',
      centroCodigo: ''
    }));
    setSearchProviders('');

    // Filtrar centros de este proveedor (si es nuevo, permitimos todos los centros del sistema)
    const centers = provider.isNew
      ? allCentros
      : allCentros.filter(c => (c.proveedorKey || '').toLowerCase() === (provider.proveedorKey || '').toLowerCase());
    setProviderCenters(centers);

    // AutoselecciÃ³n si hay solo uno
    if (centers.length === 1) {
      setForm(prev => ({
        ...prev,
        centroId: centers[0]._id,
        centroCodigo: centers[0].code
      }));
    }
  };

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

  const handleEdit = useCallback(async (summaryItem) => {
    const id = summaryItem._id || summaryItem.id;
    if (!id) return;

    setEditingId(id);
    setIsModalOpen(true);
    setStep(1);
    setIsLoadingDetails(true);

    try {
      const m = await getMuestreoDetail(id);

      const mCats = m.cats || {};
      
      setForm({
        proveedorKey: m.proveedorKey || '',
        proveedorNombre: m.proveedorNombre || m.proveedor || '',
        centroId: m.centroId || '',
        centroCodigo: m.centroCodigo || m.centro || '',
        centroNombre: m.centroNombre || '',
        linea: m.linea || '',
        fecha: (m.fecha || '').slice(0, 10),
        origen: m.origen || 'abastecimiento',
        responsable: m.responsable || '',
        uxkg: m.uXKg || m.uxkg || '',
        pesoVivo: m.pesoVivo || '',
        pesoCocida: m.pesoCocida || m.pesoCarne || '',
        cats: mCats,
        unidadPeso: m.unidadPeso || 'kg',
        comentarios: m.comentarios || m.observaciones || ''
      });

      const normalizedCatDetails = { ...(m.catDetails || {}) };
      setCatDetails(normalizedCatDetails);
      setGeneralPhotos(Array.isArray(m.generalPhotos) ? m.generalPhotos : []);
      setDeletedPhotoKeys([]);

      const catIds = new Set();
      // 1. AÃ±adir procesables del maestro (siempre visibles)
      maestros.cats.filter(c => c.tipoCat === 'procesable').forEach(c => catIds.add(c._id));
      
      // 2. AÃ±adir categorÃ­as guardadas en m.cats
      Object.keys(m.cats || {}).forEach(cId => {
        catIds.add(cId);
      });

      // 3. AÃ±adir categorÃ­as que tienen detalles (fotos/obs)
      Object.entries(normalizedCatDetails).forEach(([cId, data]) => {
        if (data.obs || (data.photos && data.photos.length > 0)) {
          catIds.add(cId);
        }
      });

      setSelectedCats(catIds);

      const pKey = (m.proveedorKey || '').toLowerCase();
      let p = directory.find(it => (it.proveedorKey || '').toLowerCase() === pKey);
      
      if (!p && (m.proveedorNombre || m.proveedor)) {
        p = {
          proveedorKey: m.proveedorKey,
          proveedorNombre: m.proveedorNombre || m.proveedor,
          contactoNombre: 'Legacy',
          comuna: ''
        };
      }
      
      if (p) {
        setSelectedProvider(p);
        const pCenters = allCentros.filter(c => (c.proveedorKey || '').toLowerCase() === (p.proveedorKey || '').toLowerCase());
        
        if (m.centroId && !pCenters.some(c => c._id === m.centroId)) {
          pCenters.push({
            _id: m.centroId,
            code: m.centroCodigo || m.centro || 'N/A',
            comuna: 'Legacy',
            proveedorKey: p.proveedorKey
          });
        }
        
        setProviderCenters(pCenters);
      } else {
        setSelectedProvider(null);
        setProviderCenters([]);
      }
    } catch {
      addToast('Error al cargar muestreo completo', 'error');
      setIsModalOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [maestros.cats, directory, allCentros, addToast]);

  const handleSave = useCallback(async () => {
    const isG = form.unidadPeso === 'g';
    const mult = isG ? 0.001 : 1;

    const finalCats = {};
    selectedCats.forEach(id => {
      finalCats[id] = (Number(form.cats[id]) || 0) * mult;
    });

    const payload = { 
      ...form,
      uxkg: Number(form.uxkg) || 0,
      pesoVivo: Number(form.pesoVivo) || 0,
      pesoCocida: Number(form.pesoCocida) || 0,
      rendimiento: Number(totals.rend) || 0, 
      total: Number(totals.totalMuestra) || 0, 
      procesable: Number(totals.procesable) || 0, 
      rechazos: Number(totals.rechazos) || 0, 
      defectos: Number(totals.defectos) || 0, 
      cats: finalCats,
      comentarios: form.comentarios,
      catDetails,
      generalPhotos,
      deletedPhotoKeys
    };

    if (payload.fecha && payload.fecha.length === 10) {
      payload.fecha = new Date(payload.fecha + 'T12:00:00Z').toISOString();
    }
    
    delete payload.unidadPeso;

    try {
      // 1. Resolver el proveedor (ya sea desde el estado o buscÃ¡ndolo en el directorio)
      const currentProviderKey = String(form.proveedorKey || '').trim().toLowerCase();
      const currentProviderNombre = String(form.proveedorNombre || '').trim().toLowerCase();
      
      const resolvedProvider = selectedProvider || directory.find(p => 
        (p.proveedorKey && String(p.proveedorKey).trim().toLowerCase() === currentProviderKey) ||
        (p.proveedorNombre && String(p.proveedorNombre).trim().toLowerCase() === currentProviderNombre)
      );

      // 2. Determinar si requiere creaciÃ³n de contacto
      const hasProviderName = String(form.proveedorNombre || '').trim().length > 0;
      const needsContact = hasProviderName && (selectedProvider?.isNew || !resolvedProvider || !resolvedProvider.contactoId);

      if (needsContact) {
        const selectedCenter = allCentros.find(c => c._id === form.centroId) || null;
        const newContactPayload = {
          nombre: form.responsable || 'Contacto de Muestreo',
          entidad: form.proveedorNombre,
          contactoNombre: form.responsable || 'Contacto de Muestreo',
          contactoEmail: '',
          contactoTelefono: '',
          proveedorKey: form.proveedorKey,
          proveedorNombre: form.proveedorNombre,
          centroId: form.centroId || '',
          centroCodigo: form.centroCodigo || '',
          centroComuna: selectedCenter?.comuna || '',
        };
        try {
          await createMuestreoDirectoryContact(newContactPayload);
          queryClient.invalidateQueries({ queryKey: ['contactos'] });
          addToast({ title: 'Directorio', message: 'Se ha creado automÃ¡ticamente el nuevo proveedor en el directorio.', type: 'info' });
        } catch {
          addToast({ title: 'Directorio', message: 'El muestreo se guardara, pero no se pudo crear el contacto automaticamente.', type: 'warning' });
        }
      }

      const data = await saveMuestreo(editingId, payload);
      setResultData(data.item || data);
      setIsModalOpen(false);
      setDirectory([]); // Limpiar cachÃ© para recargar directorio con el nuevo contacto al abrir modal
      queryClient.invalidateQueries({ queryKey: ['muestreos'] });
      queryClient.invalidateQueries({ queryKey: ['contactos'] });
      setIsResultOpen(true);
      loadData(page);
      addToast({ title: 'Ã‰xito', message: `Muestreo ${editingId ? 'actualizado' : 'guardado'} correctamente.`, type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo guardar el muestreo.', type: 'error' });
    }
  }, [selectedCats, form, totals, editingId, page, addToast, loadData, catDetails, generalPhotos, deletedPhotoKeys, selectedProvider, allCentros, directory, queryClient]);

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

  const handleFileUpload = useCallback(async (id, files) => {
    if (!files) return;
    
    const fileList = Array.from(files);
    
    for (const file of fileList) {
      try {
        const res = await uploadMuestreoEvidence({ file, category: id, samplingId: editingId || 'temp' });

        if (res.ok) {
          setCatDetails(prev => {
            const current = prev[id] || { obs: '', photos: [], fotos: [] };
            return {
              ...prev,
              [id]: {
                ...current,
                photos: [...(current.photos || []), res.metadata]
              }
            };
          });
        }
      } catch {
        addToast('Error al subir imagen', 'error');
      }
    }
  }, [editingId, addToast]);

  const removePhoto = useCallback(async (id, idx, isLegacy = false) => {
    setCatDetails(prev => {
      const current = prev[id];
      if (!current) return prev;
      
      const nextDetails = { ...current };
      
      if (isLegacy) {
        const nextFotos = [...(current.fotos || [])];
        nextFotos.splice(idx, 1);
        nextDetails.fotos = nextFotos;
      } else {
        const nextPhotos = [...(current.photos || [])];
        const photoToDelete = nextPhotos[idx];
        
        if (photoToDelete?.key) {
          setDeletedPhotoKeys(prevKeys => [...prevKeys, photoToDelete.key]);
          
          deleteMuestreoEvidence(photoToDelete.key).catch(() => {});
        }
        
        nextPhotos.splice(idx, 1);
        nextDetails.photos = nextPhotos;
      }
      
      return { ...prev, [id]: nextDetails };
    });
  }, []);

  const handleGeneralFileUpload = useCallback(async (files) => {
    if (!files) return;
    const fileList = Array.from(files);
    
    for (const file of fileList) {
      try {
        const res = await uploadMuestreoEvidence({ file, category: 'general', samplingId: editingId || 'temp' });

        if (res.ok) {
          setGeneralPhotos(prev => [...prev, res.metadata]);
        }
      } catch {
        addToast('Error al subir imagen', 'error');
      }
    }
  }, [editingId, addToast]);

  const removeGeneralPhoto = useCallback(async (idx) => {
    setGeneralPhotos(prev => {
      const nextPhotos = [...prev];
      const photoToDelete = nextPhotos[idx];
      if (photoToDelete?.key) {
        setDeletedPhotoKeys(prevKeys => [...prevKeys, photoToDelete.key]);
        
        deleteMuestreoEvidence(photoToDelete.key).catch(() => {});
      }
      nextPhotos.splice(idx, 1);
      return nextPhotos;
    });
  }, []);

  // El generador de HTML se ha movido a src/modules/reportes/renderMuestreoReport.js para ser compartido con la vista pÃºblica.

  const verReporte = useCallback(async (m) => {
    const id = m._id || m.id;
    try {
      if (!id) return;

      setIsLoadingDetails(true);
      const detalle = await getMuestreoReportDetail(id);
      
      const logoUrl    = user?.empresaId?.config?.logo || localStorage.getItem('selected_tenant_logo') || '';
      const empresaNom = user?.empresaId?.nombre || 'Mitynex';
      const html = generarHTMLReporte(detalle, {
        logoUrl,
        empresaNom,
        maestros
      });
      if (!html) return;

      const win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) {
        addToast({ title: 'Bloqueo Detectado', message: 'Habilita ventanas emergentes para generar el informe', type: 'warning' });
        return;
      }
      
      win.document.write(html);
      win.document.close();

      // PequeÃ±o delay para asegurar que el DOM de la nueva ventana estÃ© listo
      setTimeout(() => {
        const btn = win.document.getElementById('btnCopiarEnlace');
        if (btn) {
          btn.addEventListener('click', async () => {
            try {
              btn.innerText = 'â³...';
              const res = await createPublicMuestreoShare(id);
              
              const doc = win.document;
              const textarea = doc.createElement('textarea');
              textarea.value = res.url;
              doc.body.appendChild(textarea);
              textarea.select();
              doc.execCommand('copy');
              doc.body.removeChild(textarea);

              btn.innerText = 'âœ… Â¡Copiado!';
              setTimeout(() => { btn.innerText = 'ðŸ”— Copiar enlace'; }, 2500);
            } catch {
              btn.innerText = 'âŒ Error';
              setTimeout(() => { btn.innerText = 'ðŸ”— Copiar enlace'; }, 2500);
            }
          });
        }

        const btnShare = win.document.getElementById('btnCompartirPublico');
        if (btnShare) {
          btnShare.addEventListener('click', async () => {
            try {
              btnShare.innerText = 'â³ Generando...';
              const res = await createPublicMuestreoShare(id);
              
              const doc = win.document;
              const textarea = doc.createElement('textarea');
              textarea.value = res.url;
              doc.body.appendChild(textarea);
              textarea.select();
              doc.execCommand('copy');
              doc.body.removeChild(textarea);

              btnShare.innerText = 'âœ… Â¡Copiado!';
              setTimeout(() => { btnShare.innerText = 'ðŸ“¤ Compartir'; }, 2500);
            } catch {
              btnShare.innerText = 'âŒ Error';
              setTimeout(() => { btnShare.innerText = 'ðŸ“¤ Compartir'; }, 2500);
            }
          });
        }
      }, 300);

    } catch {
      addToast({ title: 'Error', message: 'No se pudo cargar el detalle del reporte.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [addToast, maestros, user?.empresaId?.config?.logo, user?.empresaId?.nombre]);

  const compartirReporte = useCallback(async (m) => {
    try {
      const id = m._id || m.id;
      if (!id) return;

      setIsLoadingDetails(true);
      const res = await createPublicMuestreoShare(id);

      const proveedor = m.proveedorNombre || 'Proveedor';
      const centro = m.centroCodigo || m.centroNombre || 'Sin Centro';
      const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const linea = m.linea ? `\nLinea: ${m.linea}` : '';
      const responsable = m.responsable ? `\nResponsable: ${m.responsable}` : '';

      const shareText =
        `*Mitynex | Informe publico de muestreo*\n` +
        `Proveedor: ${proveedor}\n` +
        `Centro: ${centro}${linea}\n` +
        `Fecha muestreo: ${fecha}${responsable}\n\n` +
        `Ver informe tecnico:\n${res.url}`;

      setShareData({
        url: res.url,
        message: shareText,
        proveedor: proveedor
      });
      setIsShareModalOpen(true);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo generar el enlace para compartir.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [addToast]);

  // Deep link para abrir un reporte puntual desde URL privada.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reporteId = params.get('reporteId');
    const tenantUrl = params.get('tenant');

    if (!reporteId) return;
    if (tenantUrl) localStorage.setItem('selected_tenant_db', tenantUrl);

    verReporte({ _id: reporteId });
  }, [verReporte]);

  // Alias para compatibilidad con el modal de resultado
  const generarInformePDF = verReporte;

  const activeTenant = localStorage.getItem('selected_tenant_db');
  const reporteId = new URLSearchParams(window.location.search).get('reporteId');
  const isEnabled = !!activeTenant || !!reporteId;

  if (!isEnabled) {
    return (
      <div className="muestreos-container am-p-24" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="am-text-center" style={{ maxWidth: '400px' }}>
          <div style={{ background: '#f1f5f9', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <MapPin size={32} style={{ color: '#64748b' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Empresa no seleccionada</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Como administrador global, debes seleccionar una empresa en el panel superior para visualizar y gestionar sus registros de muestreo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="muestreos-container muestreos-compact" style={{ animation: 'fadeIn 0.3s ease-out' }}>

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
        <div className="mx-modal-overlay mu-modal-overlay">
          <div className="mx-modal mu-main-modal">
            <div className="mx-modal-header" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 20px', minHeight: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                <h3 className="mx-modal-title" style={{ fontSize: '1rem', whiteSpace: 'nowrap' }}>
                  {editingId ? 'Editar' : 'Nuevo'} Muestreo TÃ©cnico
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '3px 10px', borderRadius: '16px' }}>
                  {[1, 2, 3].map(n => (
                    <React.Fragment key={n}>
                      <div 
                        onClick={() => n < step && setStep(n)}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '4px', cursor: n < step ? 'pointer' : 'default',
                          opacity: step === n ? 1 : 0.6
                        }}
                      >
                        <div style={{ 
                          width: '16px', height: '16px', borderRadius: '50%', background: step === n ? 'var(--color-primary)' : step > n ? '#22c55e' : '#cbd5e1',
                          color: 'white', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900
                        }}>
                          {step > n ? <Check size={10} /> : n}
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: step === n ? 'var(--color-primary)' : '#64748b' }}>
                          {n === 1 ? 'Contexto' : n === 2 ? 'AnÃ¡lisis' : 'Resultado'}
                        </span>
                      </div>
                      {n < 3 && <div style={{ width: '8px', height: '1px', background: '#cbd5e1' }} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <button className="mx-btn-icon" onClick={() => setIsModalOpen(false)} style={{ width: '28px', height: '28px' }}><X size={16} /></button>
            </div>

            <div className="mx-modal-body" style={{ flex: 1, padding: 0, overflowY: 'auto', boxSizing: 'border-box' }}>
              
              {isLoadingDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', width: '100%', padding: '64px', color: '#64748b' }}>
                  <Loader className="am-icon-spin" size={32} style={{ marginBottom: '16px', color: 'var(--color-primary)' }} />
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Cargando muestreo...</p>
                </div>
              ) : (
                <>
                  {step === 1 && (
                <div className="mu-step-container" style={{ animation: 'slideInRight 0.3s ease-out', padding: '24px', boxSizing: 'border-box' }}>
                  <div className="mx-form-row">
                    <div className="mx-form-group" style={{ flex: 1 }}>
                      <label className="mx-label"><User size={14} /> 1. Proveedor</label>
                      {!selectedProvider ? (
                        <div className="mx-search-box">
                          <Search size={16} />
                          <input 
                            className="mx-input" 
                            placeholder="Buscar proveedor..." 
                            value={searchProviders} 
                            onChange={e => setSearchProviders(e.target.value)} 
                          />
                          {(filteredProviders.length > 0 || searchProviders.trim().length > 0) && (
                            <div className="mu-dropdown shadow-lg">
                              {filteredProviders.map(p => (
                                <button key={p.id} type="button" onClick={() => handleSelectProvider(p)} className="mu-opt">
                                  <strong>{p.proveedorNombre}</strong>
                                  <span>{p.comuna} Â· {p.contactoNombre}</span>
                                </button>
                              ))}
                              {searchProviders.trim().length > 0 && (
                                <button 
                                  type="button" 
                                  onClick={() => handleSelectProvider({
                                    id: 'new-provider',
                                    proveedorNombre: searchProviders,
                                    proveedorKey: searchProviders.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
                                    comuna: 'Nuevo Registro',
                                    contactoNombre: 'Creado al guardar',
                                    isNew: true
                                  })} 
                                  className="mu-opt"
                                  style={{ borderTop: '1px dashed var(--color-border)', color: 'var(--color-primary)', fontWeight: 'var(--weight-bold)' }}
                                >
                                  <strong>+ Crear proveedor: {searchProviders}</strong>
                                  <span>Registrar automÃ¡ticamente en el directorio</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mu-selected-pill">
                          <div>
                            <strong>{selectedProvider.proveedorNombre}</strong>
                            <span>{selectedProvider.comuna}</span>
                          </div>
                          <button type="button" className="mx-btn-icon" onClick={() => { setSelectedProvider(null); setProviderCenters([]); }}><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mx-form-row am-mt-16">
                    <div className="mx-form-group" style={{ flex: 1.5 }}>
                      <label className="mx-label"><MapPin size={14} /> 2. Centro</label>
                      <select className="mx-select" value={form.centroId} onChange={e => { const c = providerCenters.find(it => it._id === e.target.value); setForm(prev => ({ ...prev, centroId: e.target.value, centroCodigo: c?.code || '' })); }} disabled={!selectedProvider}>
                        <option value="">Selecciona centro...</option>
                        {providerCenters.map(c => <option key={c._id} value={c._id}>{c.code} - {c.comuna}</option>)}
                      </select>
                    </div>
                    <div className="mx-form-group" style={{ flex: 1 }}>
                      <label className="mx-label">LÃ­nea</label>
                      <input className="mx-input" placeholder="NÂ°" value={form.linea} onChange={e => setForm({...form, linea: e.target.value})} />
                    </div>
                  </div>

                  <div className="mx-form-row am-mt-16">
                    <div className="mx-form-group" style={{ flex: 1 }}>
                      <label className="mx-label">Fecha</label>
                      <input type="date" className="mx-input" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                    </div>
                    <div className="mx-form-group" style={{ flex: 1.5 }}>
                      <label className="mx-label">Responsable</label>
                      <input className="mx-input" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="mu-step-container" style={{ animation: 'slideInRight 0.3s ease-out', padding: '20px', display: 'flex', gap: '20px', boxSizing: 'border-box' }}>
                  <div style={{ flex: '0 0 200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--color-primary)' }}>
                      <Target size={14} />
                      <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>ParÃ¡metros</h4>
                    </div>

                    <div className="mx-form-group">
                      <label className="mx-label" style={{ fontSize: '0.75rem' }}>U x Kg</label>
                      <input type="number" className="mx-input" style={{ height: '32px', fontSize: '0.9rem' }} value={form.uxkg} onChange={e => setForm({...form, uxkg: e.target.value})} onKeyDown={handleAdvanceOnEnter} placeholder="0" />
                    </div>

                    <div className="mx-form-group am-mt-10">
                      <label className="mx-label" style={{ fontSize: '0.75rem' }}>Peso Vivo</label>
                      <input type="number" className="mx-input" style={{ height: '32px', fontSize: '0.9rem' }} value={form.pesoVivo} onChange={e => setForm({...form, pesoVivo: e.target.value})} onKeyDown={handleAdvanceOnEnter} placeholder="0.00" />
                    </div>

                    <div className="mx-form-group am-mt-10">
                      <label className="mx-label" style={{ fontSize: '0.75rem' }}>Peso Carne</label>
                      <input type="number" className="mx-input" style={{ height: '32px', fontSize: '0.9rem' }} value={form.pesoCocida} onChange={e => setForm({...form, pesoCocida: e.target.value})} onKeyDown={handleAdvanceOnEnter} placeholder="0.00" />
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                      <label className="mx-label" style={{ marginBottom: '4px', fontSize: '0.7rem' }}>Obs. Muestreo</label>
                      <textarea 
                        className="mx-input" 
                        style={{ minHeight: '100px', resize: 'none', fontSize: '0.75rem', padding: '6px' }}
                        placeholder="Notas..."
                        value={form.comentarios}
                        onChange={e => setForm({...form, comentarios: e.target.value})}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a' }}>
                        <Layers size={14} />
                        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>AnÃ¡lisis TÃ©cnico</h4>
                      </div>
                      <select 
                        className="mx-select" 
                        value={form.unidadPeso || 'kg'} 
                        onChange={e => setForm({...form, unidadPeso: e.target.value})} 
                        style={{ width: 'auto', border: 'none', background: '#f8fafc', padding: '2px 8px', fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.7rem', height: '24px', borderRadius: '6px' }}
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', padding: '2px', background: '#f1f5f9', borderRadius: '8px', marginBottom: '12px' }}>
                      {['procesable', 'rechazo', 'defecto'].map(type => {
                        const count = maestros.cats.filter(c => c.tipoCat === type && selectedCats.has(c._id)).length;
                        const isActive = activeTab === type;
                        return (
                          <button key={type} type="button" onClick={() => setActiveTab(type)} style={{ flex: 1, padding: '5px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: isActive ? 'white' : 'transparent', color: isActive ? 'var(--color-primary)' : '#64748b', boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                            <span style={{ textTransform: 'capitalize' }}>{type}s</span>
                            {count > 0 && <span style={{ fontSize: '8px', background: isActive ? 'var(--color-primary)' : '#cbd5e1', color: 'white', padding: '0 4px', borderRadius: '6px' }}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {activeTab !== 'procesable' && (
                      <div style={{ marginBottom: '10px', position: 'relative' }}>
                        <button 
                          type="button"
                          className="mx-btn mx-btn-outline"
                          style={{ width: '100%', height: '32px', fontSize: '0.8rem', justifyContent: 'space-between', padding: '0 12px' }}
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                          <span>+ AÃ±adir {activeTab}s...</span>
                          <ChevronDown size={14} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {isDropdownOpen && (
                          <>
                            <div 
                              style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                              onClick={() => setIsDropdownOpen(false)} 
                            />
                            <div style={{ 
                              position: 'absolute', top: '100%', left: 0, width: '100%', 
                              background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', 
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 100,
                              marginTop: '4px', maxHeight: '200px', overflowY: 'auto', padding: '4px'
                            }}>
                              {filteredAvailableCats.length === 0 ? (
                                <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                                  No hay mÃ¡s Ã­tems disponibles
                                </div>
                              ) : (
                                filteredAvailableCats.map(c => (
                                  <button 
                                    key={c._id} 
                                    type="button"
                                    onClick={() => toggleCatSelection(c._id)}
                                    style={{ 
                                      width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', 
                                      background: 'transparent', cursor: 'pointer', borderRadius: '6px',
                                      fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <Plus size={12} color="var(--color-primary)" />
                                    {c.nombre}
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '4px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 30px 30px', gap: '4px', padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Item</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Peso</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>%</span>
                        <span /><span />
                      </div>

                      <div style={{ marginTop: '4px' }}>
                        {filteredSelectedCats.map(cat => {
                            const id = cat._id;
                            const val = Number(form.cats[id]) || 0;
                            const pct = totals.totalMuestra > 0 ? (val / totals.totalMuestra) * 100 : 0;
                            const isExpanded = expandedItems.has(id);

                            return (
                              <div key={id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 30px 30px', gap: '6px', alignItems: 'center', padding: '8px 10px', background: isExpanded ? '#f8fafc' : 'transparent', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.nombre}</span>
                                  <input type="number" className="mx-input" style={{ height: '28px', textAlign: 'right', fontWeight: 800, padding: '0 6px', fontSize: '0.9rem' }} value={form.cats[id] || ''} onChange={e => setForm({ ...form, cats: { ...form.cats, [id]: e.target.value } })} onKeyDown={handleAdvanceOnEnter} placeholder="0" />
                                  <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>{fmtNum(pct, 1)}%</div>
                                  <button type="button" className="mx-btn-icon" style={{ width: '26px', height: '26px' }} onClick={() => { const next = new Set(expandedItems); if (next.has(id)) next.delete(id); else next.add(id); setExpandedItems(next); }}><Settings2 size={12} /></button>
                                  {activeTab !== 'procesable' ? <button type="button" className="mx-btn-icon" style={{ width: '26px', height: '26px', color: '#ef4444' }} onClick={() => toggleCatSelection(id)}><X size={12} /></button> : <div />}
                                </div>
                                {isExpanded && (
                                  <div style={{ padding: '0 10px 10px 10px', animation: 'fadeIn 0.2s ease-out' }}>
                                    <textarea 
                                      className="mx-input" 
                                      style={{ height: '40px', fontSize: '0.8rem', padding: '8px', marginBottom: '8px' }} 
                                      placeholder="Observaciones de calidad..." 
                                      value={catDetails[id]?.obs || ''} 
                                      onChange={e => setCatDetails({...catDetails, [id]: { ...catDetails[id], obs: e.target.value }})} 
                                    />
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <label style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1.5px dashed #cbd5e1', transition: 'all 0.2s' }}>
                                        <Camera size={18} color="#64748b" />
                                        <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(id, e.target.files)} />
                                      </label>
                                      {(() => {
                                        const legacyFotos = catDetails[id]?.fotos || [];
                                        const s3Photos = catDetails[id]?.photos || [];
                                        return (
                                          <>
                                            {legacyFotos.map((foto, fIdx) => (
                                              <div 
                                                key={`legacy-${fIdx}`} 
                                                style={{ position: 'relative', width: '46px', height: '46px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                                              >
                                                <img 
                                                  src={foto} 
                                                  onClick={() => setPreviewImage(foto)}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} 
                                                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                />
                                                <button 
                                                  type="button" 
                                                  onClick={(e) => { e.stopPropagation(); removePhoto(id, fIdx, true); }}
                                                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(15, 23, 42, 0.6)', color: 'white', border: 'none', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                                                >
                                                  <X size={10} strokeWidth={3} />
                                                </button>
                                              </div>
                                            ))}
                                            {s3Photos.map((photo, pIdx) => (
                                              <div 
                                                key={`s3-${pIdx}`} 
                                                style={{ position: 'relative', width: '46px', height: '46px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                                              >
                                                <img 
                                                  src={photo.url} 
                                                  onClick={() => setPreviewImage(photo.url)}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} 
                                                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                />
                                                <button 
                                                  type="button" 
                                                  onClick={(e) => { e.stopPropagation(); removePhoto(id, pIdx, false); }}
                                                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(15, 23, 42, 0.6)', color: 'white', border: 'none', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                                                >
                                                  <X size={10} strokeWidth={3} />
                                                </button>
                                              </div>
                                            ))}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* EVIDENCIAS GENERALES */}
                    <div style={{ marginTop: '16px', background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', marginBottom: '12px' }}>Evidencias generales del muestreo</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1.5px dashed #cbd5e1', transition: 'all 0.2s' }}>
                          <Camera size={20} color="#64748b" />
                          <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleGeneralFileUpload(e.target.files)} />
                        </label>
                        {generalPhotos.map((photo, pIdx) => (
                          <div 
                            key={`gen-${pIdx}`} 
                            style={{ position: 'relative', width: '46px', height: '46px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                          >
                            <img 
                              src={photo.url} 
                              onClick={() => setPreviewImage(photo.url)}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} 
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            />
                            <button 
                              type="button" 
                              onClick={(e) => { e.stopPropagation(); removeGeneralPhoto(pIdx); }}
                              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(15, 23, 42, 0.6)', color: 'white', border: 'none', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                            >
                              <X size={10} strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="mu-step-container am-text-center am-py-32" style={{ animation: 'slideInRight 0.3s ease-out', padding: '24px' }}>
                  <div className="mu-result-hero">
                    <Target size={48} color="var(--color-primary)" />
                    <h3 className="am-mt-16">Resumen del AnÃ¡lisis</h3>
                    <p className="am-mb-32">Verifica los datos antes de guardar la calificaciÃ³n oficial.</p>
                  </div>

                  <div className="mu-result-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: '800px' }}>
                    <div className="mu-res-item">
                      <label>Rendimiento Carne</label>
                      <div className="val">{fmtNum(totals.rend, 1)}%</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Unidades por kilo</label>
                      <div className="val">{form.uxkg || 0}</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Muestra Total</label>
                      <div className="val">{fmtNum(totals.totalMuestra, 2)} kg</div>
                    </div>
                    <div className="mu-res-item">
                      <label>Procesable</label>
                      <div className="val success">{fmtNum(totals.totalMuestra > 0 ? (totals.procesable / totals.totalMuestra * 100) : 0, 1)}%</div>
                    </div>
                    <div className="mu-res-item">
                      <label>% Rechazo</label>
                      <div className="val error">{fmtNum(totals.totalMuestra > 0 ? (totals.rechazos / totals.totalMuestra * 100) : 0, 1)}%</div>
                    </div>
                    <div className="mu-res-item">
                      <label>% Defectos</label>
                      <div className="val warning">{fmtNum(totals.totalMuestra > 0 ? (totals.defectos / totals.totalMuestra * 100) : 0, 1)}%</div>
                    </div>
                  </div>

                  <div className="mu-confirm-msg am-mt-32">
                    <AlertTriangle size={16} />
                    <span>Este muestreo serÃ¡ registrado por <strong>{form.responsable || 'Usuario Sistema'}</strong> para el proveedor <strong>{form.proveedorNombre}</strong>.</span>
                  </div>
                </div>
              )}
              </>
              )}
            </div>

            <div className="mx-modal-footer" style={{ justifyContent: 'space-between', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <button 
                className="mx-btn mx-btn-outline" 
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1 || isLoadingDetails}
              >
                <ArrowLeft size={16} /> AtrÃ¡s
              </button>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                {step < 3 ? (
                  <button className="mx-btn mx-btn-primary" onClick={() => setStep(s => s + 1)} disabled={isLoadingDetails}>
                    Siguiente <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="mx-btn mx-btn-primary" onClick={handleSave} disabled={isLoadingDetails}>
                    <CheckCircle2 size={16} /> Guardar CalificaciÃ³n
                  </button>
                )}
              </div>
            </div>
          </div>

          {step === 2 && (
            <div className="mu-side-car">
              <div className="mu-side-car-header">MÃ©tricas Resumen</div>
              
              <div className="mu-side-car-item primary">
                <div className="label">R% Carne</div>
                <div className="val">{fmtNum(totals.rend, 1)}%</div>
              </div>

              <div className="mu-side-car-item">
                <div className="label">Muestra Total</div>
                <div className="val">{fmtNum(totals.totalMuestra, 2)}<span className="unit">kg</span></div>
              </div>

              <div className="mu-side-car-item success">
                <div className="label">Procesable</div>
                <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.procesable / totals.totalMuestra * 100) : 0, 1)}%</div>
              </div>

              <div className="mu-side-car-item error">
                <div className="label">Rechazo</div>
                <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.rechazos / totals.totalMuestra * 100) : 0, 1)}%</div>
              </div>

              <div className="mu-side-car-item warning">
                <div className="label">Defectos</div>
                <div className="val">{fmtNum(totals.totalMuestra > 0 ? (totals.defectos / totals.totalMuestra * 100) : 0, 1)}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {isResultOpen && resultData && (
        <div className="mx-modal-overlay">
          <div className="mx-modal shadow-2xl" style={{ maxWidth: '400px', textAlign: 'center', borderRadius: '24px', padding: '24px' }}>
            <div className="mu-result-success-animation">
              {resultData.clasificaciones?.[0] ? (
                <div className="mu-icon-pulse success"><Award size={64} /></div>
              ) : (
                <div className="mu-icon-pulse error"><AlertTriangle size={64} /></div>
              )}
            </div>
            
            <h2 style={{ marginTop: '24px', fontWeight: 900, color: 'var(--color-text)' }}>
              {resultData.clasificaciones?.[0]?.nombre || 'Sin ClasificaciÃ³n'}
            </h2>
            <p style={{ color: 'var(--color-text-subtle)', marginTop: '8px' }}>
              La materia prima ha sido analizada y calificada segÃºn los parÃ¡metros vigentes.
            </p>

            <div className="mu-result-mini-kpis am-mt-24">
              <div className="kpi"><span>R%</span><strong>{Number(resultData.rendimiento).toFixed(1)}%</strong></div>
              <div className="kpi"><span>UxKg</span><strong>{resultData.uxkg}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="mx-btn mx-btn-outline" style={{ flex: 1 }} onClick={() => setIsResultOpen(false)}>Cerrar</button>
              <button className="mx-btn mx-btn-primary" style={{ flex: 1 }} onClick={() => generarInformePDF(resultData)}>
                <Printer size={16} /> Informe
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .mu-modal-overlay { 
          display: flex !important; align-items: center; justify-content: center; gap: 8px; 
          z-index: 2500; position: fixed; inset: 0 !important; left: 0 !important; top: 0 !important; 
          background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px);
          padding: 12px; box-sizing: border-box;
        }
        .mu-main-modal { 
          max-width: 800px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; 
          position: relative; margin: 0; flex-shrink: 0; border-radius: 24px; overflow: hidden;
          background: white; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }
        
        .mu-side-car { 
          width: 190px; flex-shrink: 0; display: flex !important; flex-direction: column !important; gap: 12px;
          animation: slideInRight 0.4s ease-out; z-index: 10;
        }
        .mu-side-car-header { font-size: 0.7rem; font-weight: 900; color: white; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; text-align: center; opacity: 0.8; }
        
        .mu-side-car-item { 
          background: white; padding: 14px; border-radius: 16px; border: 1px solid #e2e8f0; 
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: all 0.2s;
        }
        .mu-side-car-item .label { font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
        .mu-side-car-item .val { font-size: 1.4rem; font-weight: 900; color: #1e293b; line-height: 1; }
        .mu-side-car-item .unit { font-size: 12px; margin-left: 2px; color: #94a3b8; }
        
        .mu-side-car-item.primary { border-top: 4px solid var(--color-primary); }
        .mu-side-car-item.primary .val { color: var(--color-primary); }
        
        .mu-side-car-item.success { border-top: 4px solid #22c55e; }
        .mu-side-car-item.success .val { color: #16a34a; }
        
        .mu-side-car-item.error { border-top: 4px solid #ef4444; }
        .mu-side-car-item.error .val { color: #dc2626; }
        
        .mu-side-car-item.warning { border-top: 4px solid #f59e0b; }
        .mu-side-car-item.warning .val { color: #d97706; }

        .mu-steps-header { display: flex; align-items: center; justify-content: space-between; position: relative; width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden; }
        .mu-step-item { display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1; cursor: pointer; flex: 1; position: relative; }
        .mu-step-circle { width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #64748b; transition: all 0.3s; }
        .mu-step-item.active .mu-step-circle { background: var(--color-primary); color: white; transform: scale(1.1); box-shadow: 0 0 15px var(--color-primary-bg); }
        .mu-step-item.completed .mu-step-circle { background: var(--color-success); color: white; }
        .mu-step-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
        .mu-step-item.active .mu-step-label { color: var(--color-primary); }
        .mu-step-line { position: absolute; top: 16px; left: 50%; width: 100%; height: 2px; background: #e2e8f0; z-index: -1; }
        
        .mu-origen-group { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .mu-origen-btn { flex: 1; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; }
        .mu-origen-btn.active { background: white; color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

        .mu-cat-group-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: white; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.2s; }
        .mu-cat-group-btn .count { background: currentColor; color: white; font-size: 10px; padding: 2px 6px; border-radius: 20px; }

        .mu-cat-table { width: 100%; border-collapse: collapse; }
        .mu-cat-table th { font-size: 11px; text-transform: uppercase; color: #94a3b8; padding: 12px; border-bottom: 1px solid #f1f5f9; }
        .mu-cat-table td { padding: 8px 12px; border-bottom: 1px solid #f8fafc; }
        .mu-cat-name { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; }
        .mu-cat-input { width: 100px; height: 32px; border: 1.5px solid #e2e8f0; border-radius: 8px; text-align: right; padding: 0 8px; font-weight: 700; font-size: 14px; }

        .mu-result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 800px; margin: 0 auto; }
        .mu-res-item { background: white; border: 1.5px solid #f1f5f9; padding: 16px; border-radius: 16px; text-align: center; }
        .mu-res-item label { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .mu-res-item .val { font-size: 20px; font-weight: 900; color: var(--color-text); }
        .mu-res-item .val.success { color: #16a34a; }
        .mu-res-item .val.error { color: #ef4444; }
        .mu-res-item .val.warning { color: #f59e0b; }

        .mu-result-mini-kpis { display: flex; justify-content: center; gap: 24px; background: #f8fafc; padding: 16px; border-radius: 16px; }
        .mu-result-mini-kpis .kpi strong { font-size: 18px; color: var(--color-primary); }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* RESPONSIVE FIXES */
        @media (max-width: 768px) {
          /* Ocultar sidebar y elementos externos */
          body.mu-modal-open { overflow: hidden; }
          body.mu-modal-open .mx-sidebar, 
          body.mu-modal-open .sidebar-overlay,
          body.mu-modal-open .mx-header { 
            display: none !important; 
          }
          body.mu-modal-open .mx-main-content { margin-left: 0 !important; padding: 0 !important; }

          .mu-modal-overlay { 
            align-items: flex-start; padding: 8px; overflow-y: auto; 
            justify-content: flex-start;
          }
          .mu-main-modal { 
            width: 100%; max-width: 100%; border-radius: 16px; margin: 0;
            max-height: none; height: auto;
          }
          
          .mu-step-container { flex-direction: column !important; padding: 12px !important; gap: 16px !important; }
          .mu-step-container > div { flex: none !important; width: 100% !important; }
          
          /* KPI Sidecar as Top Bar */
          .mu-side-car { 
            width: 100% !important; flex-direction: row !important; overflow-x: auto; 
            padding: 8px; gap: 8px; background: #f8fafc; border-radius: 0;
            border-left: none; border-right: none; border-top: 1px solid #e2e8f0;
            position: sticky; bottom: 0; z-index: 20; box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
          }
          .mu-side-car-header { display: none; }
          .mu-side-car-item { 
            flex: 0 0 110px; padding: 8px; border-radius: 10px; border-top-width: 3px;
          }
          .mu-side-car-item .val { font-size: 1rem; }
          
          /* Categories Table as Cards */
          .mu-cat-table thead { display: none; }
          .mu-cat-table tbody { display: flex; flex-direction: column; gap: 8px; padding: 4px; }
          .mu-cat-table tr { 
            display: grid; grid-template-columns: 1fr auto; 
            background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
            padding: 12px; gap: 8px; align-items: center;
          }
          .mu-cat-table td { padding: 0 !important; border: none !important; }
          .mu-cat-input { width: 90px !important; height: 38px !important; }
          
          /* Step 3 Grid */
          .mu-result-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .mu-res-item { padding: 12px; }
          .mu-res-item .val { font-size: 1.1rem; }
          
          .mu-modal-header { padding: 12px; }
          .mu-modal-header h3 { font-size: 0.85rem !important; }
          .mx-modal-footer { padding: 12px; flex-direction: column; gap: 8px; }
          .mx-modal-footer button { width: 100%; }
        }
        
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
      {previewImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}
          onClick={() => setPreviewImage(null)}
        >
          <button 
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', backdropFilter: 'blur(4px)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={previewImage} 
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} 
            onClick={(e) => e.stopPropagation()}
            alt="Preview"
          />
        </div>
      )}


      {/* â”€â”€ Mini-Tarjeta Flotante de Compartir (Ultra Minimalista) â”€â”€ */}
      {isShareModalOpen && (
        <div className="am-modal-overlay" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="am-modal-content" style={{ maxWidth: '280px', padding: '20px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compartir</span>
              <button className="mx-btn-icon sm" onClick={() => setIsShareModalOpen(false)} style={{ background: '#f1f5f9' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              <button 
                className="mx-btn" 
                style={{ background: '#25D366', color: 'white', border: 'none', height: '44px', borderRadius: '12px', fontSize: '14px', fontWeight: 600 }}
                onClick={() => {
                  const encoded = encodeURIComponent(shareData?.url);
                  window.open(`https://wa.me/?text=${encoded}`, '_blank');
                  setIsShareModalOpen(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.996-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.222-4.032c1.503.893 3.129 1.364 4.799 1.365 5.228 0 9.482-4.254 9.484-9.483 0-2.535-1.011-4.917-2.812-6.721-1.801-1.804-4.181-2.815-6.724-2.815-5.231 0-9.482 4.254-9.484 9.483 0 1.742.476 3.441 1.378 4.912l-.934 3.412 3.493-.916zm11.233-6.24c-.11-.183-.404-.293-.845-.513-.441-.22-2.603-1.285-3.007-1.431-.403-.147-.697-.22-.991.22-.293.441-1.138 1.431-1.395 1.724-.257.293-.513.33-.954.11-.441-.22-1.862-.686-3.547-2.189-1.311-1.17-2.196-2.614-2.453-3.054-.257-.441-.027-.679.193-.898.198-.197.441-.513.661-.77.22-.256.293-.44.441-.733.146-.293.073-.55-.037-.77-.11-.22-.991-2.388-1.358-3.267-.358-.856-.723-.74-.991-.754l-.844-.015c-.293 0-.77.11-1.174.55-.404.44-1.541 1.503-1.541 3.666 0 2.163 1.578 4.252 1.798 4.545.22.293 3.107 4.744 7.527 6.65.1.04.19.07.28.1.1.03.19.05.28.08.31.09.61.12.91.12.51-.01.99-.12 1.41-.33.56-.28 1.14-.65 1.51-1.03.37-.38.6-.83.69-1.29.09-.46.05-.88-.04-1.07z"/></svg>
                  WhatsApp
                </div>
              </button>

              <button 
                className="mx-btn mx-btn-outline" 
                style={{ height: '44px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, border: '1.5px solid #e2e8f0' }}
                onClick={async () => {
                  if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(shareData?.url);
                    addToast({ title: 'Copiado', message: 'Enlace listo para abrir en navegador.', type: 'success' });
                    setIsShareModalOpen(false);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Copy size={16} /> Copiar enlace
                </div>
              </button>

              <button 
                className="mx-btn" 
                disabled
                style={{ height: '44px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'not-allowed', opacity: 0.7 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Target size={16} /> Ping (PrÃ³ximamente)
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

