import React, { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  X,
  CheckCircle2,
  AlertTriangle,
  Award,
  Edit,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Check,
  ChevronRight,
  Printer,
  Calendar,
  User,
  MapPin,
  Layers,
  ArrowRight,
  ArrowLeft,
  Settings2,
  RotateCcw,
  Target,
  Trash2,
  Camera,
  Image as ImageIcon,
  Loader
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useMuestreosData } from '../../../hooks/useMuestreosData';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';

const fmtNum = (v, d = 2) => (Number(v) || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

function buildProviderDirectory(centros = [], contactos = []) {
  const firstContactByKey = new Map();
  contactos.forEach((item) => {
    const key = String(item.proveedorKey || '').trim().toLowerCase();
    if (!key || firstContactByKey.has(key)) return;
    firstContactByKey.set(key, item);
  });

  const providers = new Map();
  centros.forEach((centro, index) => {
    const proveedorNombre = String(centro.proveedor || '').trim() || 'Proveedor sin nombre';
    const proveedorKey = String(centro.proveedorKey || proveedorNombre).trim().toLowerCase();
    if (!proveedorKey) return;

    const linkedContact = firstContactByKey.get(proveedorKey);
    const existing = providers.get(proveedorKey);

    if (!existing) {
      providers.set(proveedorKey, {
        id: `prov-${proveedorKey || index}`,
        contactoId: linkedContact?._id || '',
        proveedorKey,
        proveedorNombre,
        contactoNombre: linkedContact?.contactoNombre || '',
        contactoTelefono: linkedContact?.contactoTelefono || '',
        contactoEmail: linkedContact?.contactoEmail || '',
        comuna: centro.comuna || '',
        centros: 1,
      });
      return;
    }

    existing.centros += 1;
    if (!existing.contactoNombre && linkedContact?.contactoNombre) existing.contactoNombre = linkedContact.contactoNombre;
    if (!existing.contactoTelefono && linkedContact?.contactoTelefono) existing.contactoTelefono = linkedContact.contactoTelefono;
    if (!existing.contactoEmail && linkedContact?.contactoEmail) existing.contactoEmail = linkedContact.contactoEmail;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

export default function Muestreos() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
  const { muestreos, maestros, loading, page, setPage, pagination, refresh: loadData } = useMuestreosData(viewMode);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/muestreos/${deleteTarget._id}`);
      addToast({ title: 'Éxito', message: 'Muestreo eliminado.', type: 'success' });
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
  const [activeDropdown, setActiveDropdown] = useState(null); // 'procesable' | 'rechazo' | 'defecto'

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

  // === Efecto para Deep Linking del Reporte ===
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reporteId = params.get('reporteId');
    const tenantUrl = params.get('tenant'); // slug o dbName

    console.log('[ACTIVE TENANT]:', localStorage.getItem('selected_tenant_db') || 'Ninguno');
    console.log('[REPORTE ID]:', reporteId || 'Ninguno');

    if (reporteId) {
      // Si viene un tenant en la URL, lo priorizamos para SuperAdmins
      if (tenantUrl) {
        console.log('[TENANT FROM URL]:', tenantUrl);
        localStorage.setItem('selected_tenant_db', tenantUrl);
      }

      const fetchReport = async () => {
        try {
          setIsLoadingDetails(true);
          // verReporte ahora se encarga de hacer el fetch si se le pasa el ID
          await verReporte({ _id: reporteId });
        } catch (err) {
          console.error('[REPORT FETCH ERROR]:', err);
          addToast({ title: 'Error', message: 'No se pudo cargar el reporte. Verifique su acceso.', type: 'error' });
        } finally {
          setIsLoadingDetails(false);
        }
      };
      fetchReport();
    }
  }, []); // Solo al montar

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

  // Buscador de Proveedor (Patrón Registro Rápido)
  const [searchProviders, setSearchProviders] = useState('');
  const [directory, setDirectory] = useState([]);
  const [allCentros, setAllCentros] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerCenters, setProviderCenters] = useState([]);

  // Carga de directorio (al abrir modal)
  React.useEffect(() => {
    if (!isModalOpen || directory.length > 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadDirectory() {
      setLoadingProviders(true);
      try {
        const [centrosRes, contactosRes] = await Promise.all([
          apiClient.get('/centros', { signal: controller.signal }),
          apiClient.get('/contactos?conEmpresa=1', { signal: controller.signal }),
        ]);

        if (!cancelled) {
          const rawCentros = Array.isArray(centrosRes) ? centrosRes : (centrosRes.items || []);
          const rawContactos = Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || []);
          setAllCentros(rawCentros);
          setDirectory(buildProviderDirectory(rawCentros, rawContactos));
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        addToast({ title: 'Error', message: 'No se pudo cargar el directorio de proveedores.', type: 'error' });
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    }

    loadDirectory();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isModalOpen, directory.length, addToast]);

  // Bloquear scroll y ocultar sidebar en mobile cuando el modal está abierto
  React.useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('mu-modal-open');
    } else {
      document.body.classList.remove('mu-modal-open');
    }
    return () => document.body.classList.remove('mu-modal-open');
  }, [isModalOpen]);

  const filteredProviders = useMemo(() => {
    if (!searchProviders.trim()) return [];
    const q = searchProviders.toLowerCase();
    return directory.filter(p => 
      (p.proveedorNombre || '').toLowerCase().includes(q) ||
      (p.proveedorKey || '').toLowerCase().includes(q) ||
      (p.contactoNombre || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [directory, searchProviders]);

  const filteredAvailableCats = useMemo(() => {
    // 1. Solo categorías de muestreo del tab activo
    // 2. Que estén activas (ya vienen filtradas del hook, pero por seguridad)
    // 3. Que NO estén ya seleccionadas
    const res = maestros.cats.filter(c => 
      c.tipoCat === activeTab && 
      !selectedCats.has(c._id)
    );
    
    console.log('[MUESTREO CATS RAW]', maestros.cats);
    console.log('[MUESTREO ACTIVE TAB]', activeTab);
    console.log('[MUESTREO AVAILABLE CATS]', res);
    console.log('[MUESTREO SELECTED CATS IDS]', Array.from(selectedCats));
    
    return res;
  }, [maestros.cats, activeTab, selectedCats]);

  const filteredSelectedCats = useMemo(() => {
    // Reconstruimos la lista de objetos seleccionados para el tab activo.
    // Importante: Si un ítem está en selectedCats pero NO en maestros.cats (ej: desactivado o legacy),
    // debemos intentar mostrarlo igual si tiene datos en el formulario.
    
    const selectedList = [];
    selectedCats.forEach(id => {
      let cat = maestros.cats.find(c => c._id === id);
      
      // Si no está en el maestro, creamos un placeholder para no perder los datos del formulario
      if (!cat) {
        const val = Number(form.cats[id]) || 0;
        const details = catDetails[id];
        // Solo lo incluimos si tiene datos reales (peso, obs o fotos)
        if (val > 0 || details?.obs || details?.photos?.length > 0) {
          cat = { _id: id, nombre: `(Inactivo) ${id.slice(-4)}`, tipoCat: 'unknown' };
          // Intentar adivinar el tipoCat si es posible, o dejarlo visible en todos los tabs si es unknown
        }
      }

      if (cat && (cat.tipoCat === activeTab || cat.tipoCat === 'unknown')) {
        selectedList.push(cat);
      }
    });

    console.log('[MUESTREO FILTERED SELECTED CATS]', selectedList);
    return selectedList;
  }, [selectedCats, maestros.cats, activeTab, form.cats, catDetails]);

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

    // Filtrar centros de este proveedor
    const centers = allCentros.filter(c => c.proveedorKey === provider.proveedorKey);
    setProviderCenters(centers);

    // Autoselección si hay solo uno
    if (centers.length === 1) {
      setForm(prev => ({
        ...prev,
        centroId: centers[0]._id,
        centroCodigo: centers[0].code
      }));
    }
  };

  const totals = useMemo(() => {
    const isG = form.unidadPeso === 'g';
    const mult = isG ? 0.001 : 1;
    const vivo = Number(form.pesoVivo) || 0;
    const cocida = Number(form.pesoCocida) || 0;
    const rend = vivo > 0 ? (cocida / vivo) * 100 : 0;

    let procesable = 0;
    let rechazos = 0;
    let defectos = 0;

    selectedCats.forEach(id => {
      const val = (Number(form.cats[id]) || 0) * mult;
      const cat = maestros.cats.find(c => c._id === id);
      if (cat?.tipoCat === 'procesable') procesable += val;
      else if (cat?.tipoCat === 'rechazo') rechazos += val;
      else if (cat?.tipoCat === 'defecto') defectos += val;
    });

    const totalMuestra = procesable + rechazos;
    return { rend, totalMuestra, procesable, rechazos, defectos };
  }, [form.pesoVivo, form.pesoCocida, form.cats, selectedCats, maestros.cats, form.unidadPeso]);

  const filtered = useMemo(() => {
    return muestreos.filter(m => 
      (m.proveedorNombre || m.proveedor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.centroCodigo || m.centro || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [muestreos, searchTerm]);

  const groupedData = useMemo(() => {
    const groups = {};
    filtered.forEach(m => {
      const key = m.proveedorNombre || m.proveedor || 'S/P';
      if (!groups[key]) {
        groups[key] = { 
          key,
          muestras: 0, 
          rendSum: 0, 
          uxkgSum: 0, 
          totalSum: 0,
          rechazosSum: 0,
          items: []
        };
      }
      groups[key].muestras++;
      groups[key].rendSum += Number(m.rendimiento) || 0;
      groups[key].uxkgSum += Number(m.uxkg) || 0;
      groups[key].totalSum += Number(m.total) || 0;
      groups[key].rechazosSum += Number(m.rechazos) || 0;
      groups[key].items.push(m);
    });
    return Object.values(groups).sort((a, b) => b.muestras - a.muestras);
  }, [filtered]);

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
      const m = await apiClient.get(`/muestreos/${id}`);

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
      // 1. Añadir procesables del maestro (siempre visibles)
      maestros.cats.filter(c => c.tipoCat === 'procesable').forEach(c => catIds.add(c._id));
      
      // 2. Añadir categorías guardadas en m.cats
      Object.keys(m.cats || {}).forEach(cId => {
        catIds.add(cId);
      });

      // 3. Añadir categorías que tienen detalles (fotos/obs)
      Object.entries(normalizedCatDetails).forEach(([cId, data]) => {
        if (data.obs || (data.photos && data.photos.length > 0)) {
          catIds.add(cId);
        }
      });

      console.log('[MUESTREO EDIT RECONSTRUCTED IDS]', Array.from(catIds));
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
    } catch (err) {
      console.error('Error al cargar muestreo completo:', err);
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

    console.log('[STATE CATDETAILS BEFORE SAVE]', catDetails);

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
      const endpoint = editingId ? `/muestreos/${editingId}` : '/muestreos';
      const method = editingId ? 'patch' : 'post';
      
      const data = await apiClient[method](endpoint, payload);
      setResultData(data.item || data);
      setIsModalOpen(false);
      setIsResultOpen(true);
      loadData(page);
      addToast({ title: 'Éxito', message: `Muestreo ${editingId ? 'actualizado' : 'guardado'} correctamente.`, type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo guardar el muestreo.', type: 'error' });
    }
  }, [selectedCats, form, totals, editingId, page, addToast, loadData, catDetails, generalPhotos]);

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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', id);
        formData.append('samplingId', editingId || 'temp');

        const res = await apiClient.post('/muestreos/evidencias/upload', formData);

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
      } catch (err) {
        console.error('Error al subir evidencia:', err);
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
          
          // Llamar al delete en background
          apiClient.delete(`/muestreos/evidencias?key=${encodeURIComponent(photoToDelete.key)}`)
            .catch(err => console.error('Error al eliminar del storage:', err));
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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'general');
        formData.append('samplingId', editingId || 'temp');

        const res = await apiClient.post('/muestreos/evidencias/upload', formData);

        if (res.ok) {
          setGeneralPhotos(prev => [...prev, res.metadata]);
        }
      } catch (err) {
        console.error('Error al subir evidencia general:', err);
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
        
        apiClient.delete(`/muestreos/evidencias?key=${encodeURIComponent(photoToDelete.key)}`)
          .catch(err => console.error('Error al eliminar del storage:', err));
      }
      nextPhotos.splice(idx, 1);
      return nextPhotos;
    });
  }, []);

  const generarHTMLReporte = useCallback((m) => {
    if (!m) return '';
    console.log('[REPORT RECEIVED]', {
      clasificacion: m.clasificacion,
      evaluacion: m.evaluacion,
      evaluacionCriterios: m.evaluacionCriterios,
      criterios: m.criterios
    });

    const clasificaciones = Array.isArray(m.clasificaciones) ? m.clasificaciones : [];
    const evaluacionCriterios = Array.isArray(m.evaluacionCriterios) ? m.evaluacionCriterios : [];
    const primary   = clasificaciones[0];
    const rend      = Number(m.rendimiento) || 0;
    const uxkg      = Number(m.uxkg)        || 0;
    const total     = Number(m.total)       || 0;
    const procesable= Number(m.procesable)  || 0;
    const rechazos  = Number(m.rechazos)    || 0;
    const defectos  = Number(m.defectos)    || 0;
    const pctProc   = fmtNum(total > 0 ? (procesable / total) * 100 : 0, 1);
    const pctRech   = fmtNum(total > 0 ? (rechazos   / total) * 100 : 0, 1);
    const pctDef    = fmtNum(total > 0 ? (defectos   / total) * 100 : 0, 1);
    const fecha     = (m.fecha || new Date().toISOString()).slice(0, 10);

    // Logo SOLO para encabezado — nunca para evidencias
    const logoUrl    = user?.empresaId?.config?.logo || localStorage.getItem('selected_tenant_logo') || '';
    const empresaNom = user?.empresaId?.nombre || 'Mitynex';
    const logoBlock  = logoUrl
      ? `<img src="${logoUrl}" alt="${empresaNom}" style="height:52px;max-width:180px;object-fit:contain;" />`
      : `<div style="font-size:20px;font-weight:900;color:#0f766e;letter-spacing:-0.5px;">${empresaNom}</div>`;

    // Origin embebido desde la app para copiar enlace (no depende de window.opener)
    const appOrigin = window.location.origin;

    // --- Análisis de auditoría técnica ---
    // El backend ya genera evaluacion[].razon con el texto de fallo completo.
    // Aquí lo presentamos de forma visual limpia sin textos hardcodeados.

    // Parsear el string del backend. Formato exacto del service:
    // "Nombre (valor%) excede el máximo (umbral)"
    // "Nombre (valor%) es menor al mínimo (umbral)"
    // También puede venir concatenado con ", " si hay varios fallos en un mismo criterio.
    const parsearFallo = (razon) => {
      if (!razon) return null;
      const mExcede = razon.match(/^(.+?)\s*\((.+?)\)\s+excede el m[áa]ximo\s*\((.+?)\)$/i);
      const mMenor  = razon.match(/^(.+?)\s*\((.+?)\)\s+es menor al m[íi]nimo\s*\((.+?)\)$/i);
      
      let p, v, t, u;
      if (mExcede) { p = mExcede[1].trim(); v = mExcede[2]; t = 'max'; u = mExcede[3]; }
      else if (mMenor) { p = mMenor[1].trim(); v = mMenor[2]; t = 'min'; u = mMenor[3]; }
      else { return { param: razon.trim(), valor: null, tipo: null, umbral: null }; }

      if (p.toLowerCase() === 'calibre') p = 'U x Kg';

      return { param: p, valor: v, tipo: t, umbral: u };
    };

    const fallosMap = new Map();
    const todosLosFallosRaw = evaluacionCriterios
      .filter(ev => !ev.cumple && ev.razon)
      .map(ev => ev.razon.split(', '))
      .flat();
      
    evaluacionCriterios
      .filter(ev => !ev.cumple && ev.razon)
      .forEach(ev => {
        ev.razon.split(', ').forEach(r => {
          const f = parsearFallo(r);
          if (!f) return;
          const key = `${f.param}|${f.tipo}|${f.umbral}`;
          if (!fallosMap.has(key)) fallosMap.set(key, f);
        });
      });
    const fallosUnicos = Array.from(fallosMap.values());

    const cumplidores = evaluacionCriterios.filter(ev => ev.cumple);

    let auditNoClasificaHTML = '';
    if (fallosUnicos.length > 0) {
      const filas = fallosUnicos.map(f => {
        let desc = '';
        if (f.tipo === 'max' && f.valor)        desc = `${f.valor} — rango permitido: <strong>${f.umbral}</strong>`;
        else if (f.tipo === 'min' && f.valor)   desc = `${f.valor} — rango permitido: <strong>${f.umbral}</strong>`;
        else if (f.valor)                        desc = `valor actual: ${f.valor}`;
        else                                     desc = f.param;
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid #fee2e2;">
          <div style="min-width:14px;height:14px;border-radius:50%;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0;margin-top:2px;">✗</div>
          <div style="font-size:12px;color:#7f1d1d;line-height:1.5;">
            <strong>${f.param}</strong> — ${desc}
          </div>
        </div>`;
      }).join('');
      auditNoClasificaHTML = `
        <div style="margin-top:10px;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#991b1b;margin-bottom:6px;">Parámetros fuera de rango</div>
          ${filas}
        </div>`;
    } else if (evaluacionCriterios.length > 0) {
      const razonesLiterales = evaluacionCriterios
        .filter(ev => !ev.cumple && ev.razon)
        .map(ev => `<div style="font-size:12px;color:#7f1d1d;padding:4px 0;border-bottom:1px solid #fee2e2;">• <strong>${ev.nombre}:</strong> ${ev.razon}</div>`)
        .join('');
      auditNoClasificaHTML = razonesLiterales
        ? `<div style="margin-top:10px;">${razonesLiterales}</div>`
        : `<div style="margin-top:8px;font-size:12px;color:#7f1d1d;font-style:italic;">No se encontraron criterios detallados. Revisar configuración del maestro de clasificación.</div>`;
    } else {
      auditNoClasificaHTML = `<div style="margin-top:8px;font-size:12px;color:#7f1d1d;font-style:italic;">No se encontraron criterios detallados. Revisar configuración del maestro de clasificación.</div>`;
    }

    const auditCumpleHTML = cumplidores.length > 0 ? `
      <div style="margin-top:10px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#166534;margin-bottom:6px;">Criterios aprobados</div>
        ${cumplidores.map(ev => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #dcfce7;">
            <div style="min-width:14px;height:14px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0;">✓</div>
            <div style="font-size:12px;color:#14532d;"><strong>${ev.nombre}</strong> — Todos los parámetros dentro del rango</div>
          </div>`).join('')}
      </div>` : '';

    let auditoriaHTML = '';
    if (primary) {
      auditoriaHTML = `
        <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:16px 18px;">
          <div style="font-size:14px;font-weight:800;color:#166534;margin-bottom:4px;">
            ✅ Clasifica como: ${primary.nombre}${primary.tipoPrincipal ? ` <span style="font-weight:600;font-size:12px;color:#15803d;">(${primary.tipoPrincipal})</span>` : ''}
          </div>
          <div style="font-size:12px;color:#16a34a;margin-bottom:12px;">
            La materia prima cumple los parámetros establecidos en el maestro vigente.
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">R% Carne</div>
              <div style="font-size:18px;font-weight:800;color:#16a34a;">${fmtNum(rend, 2)}%</div>
            </div>
            <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">U × Kg</div>
              <div style="font-size:18px;font-weight:800;color:#16a34a;">${fmtNum(uxkg, 0)}</div>
            </div>
            <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">% Rechazo</div>
              <div style="font-size:18px;font-weight:800;color:#16a34a;">${pctRech}%</div>
            </div>
          </div>
          ${auditCumpleHTML}
        </div>`;
    } else {
      auditoriaHTML = `
        <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:16px 18px;">
          <div style="font-size:14px;font-weight:800;color:#991b1b;margin-bottom:6px;">
            ❌ No clasifica en ninguna categoría del maestro vigente
          </div>
          ${auditNoClasificaHTML}
          <div style="margin-top:14px;font-size:12px;color:#7f1d1d;background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;line-height:1.7;">
            <strong>Recomendación:</strong> Revisar los parámetros fuera de rango indicados y evaluar una nueva toma de muestra antes de programar cosecha o tomar decisiones comerciales.
          </div>
        </div>`;
    }
    // Tabla de evaluación completa por clasificación (auditoría completa)
    const evalHTML = evaluacionCriterios.length ? evaluacionCriterios.map(ev => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="width:20px;height:20px;border-radius:50%;background:${ev.cumple ? '#22c55e' : '#ef4444'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;">${ev.cumple ? '✓' : '✗'}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${ev.nombre}</div>
          ${ev.razon
            ? ev.razon.split(', ').map(r => {
                const p = parsearFallo(r);
                if (p && p.tipo === 'max') return `<div style="font-size:11px;color:#ef4444;margin-top:2px;">• ${p.param}: ${p.valor} — rango permitido: ${p.umbral}</div>`;
                if (p && p.tipo === 'min') return `<div style="font-size:11px;color:#ef4444;margin-top:2px;">• ${p.param}: ${p.valor} — rango permitido: ${p.umbral}</div>`;
                return `<div style="font-size:11px;color:#ef4444;margin-top:2px;">• ${r}</div>`;
              }).join('')
            : '<div style="font-size:11px;color:#22c55e;margin-top:2px;">Todos los parámetros dentro del rango establecido</div>'}
        </div>
      </div>`).join('') : '<div style="color:#94a3b8;font-size:13px;">Sin criterios configurados.</div>';

    // --- Evidencias: SOLO fotos reales, NUNCA el logo ---
    // Resolver nombre de ítem desde maestros.cats por catId
    const catMap = {};
    (maestros?.cats || []).forEach(c => { catMap[String(c._id)] = c.nombre || 'Ítem sin nombre'; });

    const allPhotos = [];
    const mCatsWeights = m.cats || {};

    if (m.catDetails && typeof m.catDetails === 'object') {
      Object.entries(m.catDetails).forEach(([catId, data]) => {
        if (!data || !Array.isArray(data.photos)) return;
        const nombreCat = catMap[catId] || data.nombre || 'Ítem sin nombre';
        const pesoItem  = Number(mCatsWeights[catId]) || 0;
        const pctItem   = total > 0 && pesoItem > 0 ? `${fmtNum((pesoItem / total) * 100, 1)}%` : null;
        const sublabel  = pctItem ? `${nombreCat} — ${pctItem}` : nombreCat;
        data.photos.forEach(p => {
          const url = p?.url || p?.signedUrl;
          // Excluir explícitamente cualquier URL que sea el logo corporativo
          if (!url || url === logoUrl) return;
          allPhotos.push({ url, label: sublabel });
        });
      });
    }

    if (Array.isArray(m.generalPhotos)) {
      m.generalPhotos.forEach(p => {
        const url = p?.url || p?.signedUrl;
        if (!url || url === logoUrl) return;
        allPhotos.push({ url, label: 'Evidencia general' });
      });
    }

    const photosHTML = allPhotos.length > 0 ? `
      <div class="section">
        <div class="sec-title">Evidencias Fotográficas</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-top:10px;">
          ${allPhotos.map(p => `
            <div style="text-align:center;">
              <img src="${p.url}" alt="Evidencia" style="width:100%;height:130px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />
              <div style="font-size:11px;font-weight:600;color:#475569;margin-top:5px;">${p.label}</div>
            </div>`).join('')}
        </div>
      </div>` : '';

    const pdfFilename = `reporte-muestreo-${(m.proveedorNombre || m.proveedor || 'proveedor').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${(m.centroCodigo || m.centro || 'centro').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${fecha}.pdf`;
    const muestreoId  = m._id || m.id || '';
    const activeTenant = localStorage.getItem('selected_tenant_db') || '';
    const reportUrl   = muestreoId 
      ? `${appOrigin}/biomasa/muestreos?reporteId=${muestreoId}${activeTenant ? `&tenant=${activeTenant}` : ''}` 
      : `${appOrigin}/biomasa/muestreos`;
    const shareTitle  = `Informe de Muestreo — ${m.proveedorNombre || m.proveedor || 'Proveedor'} — ${fecha}`;
    const shareText   = encodeURIComponent(`Muestreo MMPP\nProveedor: ${m.proveedorNombre || m.proveedor || '—'}\nCentro: ${m.centroCodigo || m.centro || '—'}\nFecha: ${fecha}\n\n${reportUrl}`);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Muestreo — ${m.proveedorNombre || m.proveedor || ''}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;padding:32px;font-size:14px;line-height:1.5}
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #0f766e;margin-bottom:24px;}
  .header-title{font-size:20px;font-weight:800;color:#0f172a;}
  .header-sub{font-size:12px;color:#64748b;margin-top:2px;}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:22px;}
  .meta-item label{font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:2px;}
  .meta-item span{font-size:13px;font-weight:700;color:#0f172a;}
  .section{margin-bottom:22px}
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;letter-spacing:.06em;margin-bottom:10px;padding-bottom:5px;border-bottom:1.5px solid #e2e8f0}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:4px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-label{font-size:10px;color:#64748b;margin-bottom:4px}
  .kpi-val{font-size:20px;font-weight:800;color:#0f766e}
  .clas-box{border:2px solid #16a34a;border-radius:10px;padding:16px;text-align:center;background:#f0fdf4}
  .clas-box.fail{border-color:#ef4444;background:#fef2f2}
  .clas-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569}
  .clas-val{font-size:26px;font-weight:800;color:#16a34a;margin-top:4px}
  .clas-val.fail{color:#ef4444}
  .rec-box{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.7}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:10px;}
  .no-print{display:flex}
  @media print{body{padding:16px}.no-print{display:none!important}}
</style>
</head>
<body>
  <div class="no-print" style="background:#0f766e;color:#fff;padding:10px 14px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-weight:700;font-size:13px;">Informe de Muestreo MMPP &mdash; Vista preliminar</span>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button onclick="window.print()" title="Imprime o guarda como PDF desde el navegador" style="background:#fff;color:#0f766e;border:none;padding:6px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;">🖨️ Imprimir</button>
      <button id="btnCopiarEnlace" title="Copia el enlace de este reporte al portapapeles" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.4);padding:6px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;">🔗 Copiar enlace</button>
      <!-- PDF beta: oculto hasta resolver incrustación de evidencias -->
      <button id="btn-download" onclick="descargarPDFReal()" style="display:none;"></button>
    </div>
  </div>
  <div id="reporte-muestreo">

  <div class="header">
    <div>${logoBlock}</div>
    <div style="text-align:right;">
      <div class="header-title">Informe de Muestreo MMPP</div>
      <div class="header-sub">${empresaNom} · Generado el ${new Date().toLocaleDateString('es-CL')}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Proveedor</label><span>${m.proveedorNombre || m.proveedor || '—'}</span></div>
    <div class="meta-item"><label>Centro</label><span>${m.centroCodigo || m.centro || '—'}</span></div>
    <div class="meta-item"><label>Línea</label><span>${m.linea || '—'}</span></div>
    <div class="meta-item"><label>Fecha</label><span>${fecha}</span></div>
    <div class="meta-item"><label>Responsable</label><span>${m.responsable || '—'}</span></div>
    <div class="meta-item"><label>Origen</label><span>${m.origen || '—'}</span></div>
  </div>

  <div class="section">
    <div class="sec-title">Indicadores del Muestreo</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">R% Carne</div><div class="kpi-val">${fmtNum(rend, 2)}%</div></div>
      <div class="kpi"><div class="kpi-label">U × Kg (Calibre)</div><div class="kpi-val">${fmtNum(uxkg, 0)}</div></div>
      <div class="kpi"><div class="kpi-label">Procesable</div><div class="kpi-val">${pctProc}%</div></div>
      <div class="kpi"><div class="kpi-label">Rechazo</div><div class="kpi-val">${pctRech}%</div></div>
      <div class="kpi"><div class="kpi-label">Defectos</div><div class="kpi-val">${pctDef}%</div></div>
    </div>
  </div>
  <div class="section">
    <div class="sec-title">Clasificación</div>
    <div class="clas-box ${primary ? '' : 'fail'}">
      <div class="clas-label">Tipo de producto</div>
      <div class="clas-val ${primary ? '' : 'fail'}">${primary ? primary.nombre : 'S/C — No clasifica'}</div>
      ${primary?.tipoPrincipal ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">${primary.tipoPrincipal}</div>` : ''}
    </div>
  </div>
  <div class="section">
    <div class="sec-title">Evaluación por Criterio (Parámetros Maestro)</div>
    ${evalHTML}
  </div>
  <div class="section">
    <div class="sec-title">Resultado y Auditoría de Clasificación</div>
    ${auditoriaHTML}
  </div>
  ${photosHTML}
  <div class="footer">
    <span>${empresaNom}</span>
    <span>Generado el ${new Date().toLocaleDateString('es-CL')} · Sistema MMPP Abastecimiento</span>
  </div>
  </div><!-- /#reporte-muestreo -->
  <script>
    // === Descargar PDF (beta) — las imágenes externas pueden no incrustarse ===
    // TODO (Etapa 3): convertir imágenes a base64 antes de llamar html2pdf,
    // o generar el PDF en el backend con Puppeteer para garantizar evidencias.
    function descargarPDFReal() {
      const btn = document.getElementById('btn-download');
      if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
      const el = document.getElementById('reporte-muestreo');
      const opt = {
        margin: 8,
        filename: '${pdfFilename}',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(el).save().then(() => {
        if (btn) { btn.disabled = false; btn.textContent = '⬇️ PDF (beta)'; }
      }).catch(() => {
        if (btn) { btn.disabled = false; btn.textContent = '⬇️ PDF (beta)'; }
        alert('No se pudo generar el PDF.\nUsa \"Imprimir\" como alternativa (Ctrl+P → Guardar como PDF).');
      });
    }
  </script>
</body>
</html>`;
  }, [user, maestros]);

  const verReporte = useCallback(async (m) => {
    const id = m._id || m.id;
    try {
      if (!id) return;

      setIsLoadingDetails(true);
      const detalle = await apiClient.get(`/muestreos/${id}`);
      
      const html = generarHTMLReporte(detalle);
      if (!html) return;

      const activeTenant = localStorage.getItem('selected_tenant_db') || '';
      const publicBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL || (window.location.hostname === 'localhost' ? 'https://mitynex.cl' : window.location.origin);
      const reportUrl = `${publicBaseUrl}/biomasa/muestreos?reporteId=${id}${activeTenant ? `&tenant=${encodeURIComponent(activeTenant)}` : ''}`;

      const win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) {
        addToast({ title: 'Bloqueo Detectado', message: 'Habilita ventanas emergentes para generar el informe', type: 'warning' });
        return;
      }
      
      win.document.write(html);
      win.document.close();

      // Pequeño delay para asegurar que el DOM de la nueva ventana esté listo
      setTimeout(() => {
        const btn = win.document.getElementById('btnCopiarEnlace');
        if (btn) {
          btn.addEventListener('click', () => {
            const doc = win.document;
            const textarea = doc.createElement('textarea');
            textarea.value = reportUrl;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            doc.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            let ok = false;
            try {
              ok = doc.execCommand('copy');
            } catch (e) {
              ok = false;
            }

            doc.body.removeChild(textarea);

            if (ok) {
              const prevText = btn.innerText;
              btn.innerText = '✅ Enlace copiado';
              setTimeout(() => { btn.innerText = prevText; }, 2500);
            } else {
              win.prompt('Copia este enlace:', reportUrl);
            }
          });
        }
      }, 300);

    } catch (err) {
      console.error('Error al generar reporte:', err);
      addToast({ title: 'Error', message: 'No se pudo cargar el detalle del reporte.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [generarHTMLReporte, addToast]);

  const descargarPDF = useCallback(async (m) => {
    try {
      const id = m._id || m.id;
      if (!id) return;

      setIsLoadingDetails(true);
      const detalle = await apiClient.get(`/muestreos/${id}`);
      
      const html = generarHTMLReporte(detalle);
      if (!html) return;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const proveedor = (detalle.proveedorNombre || detalle.proveedor || 'proveedor').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const centro = (detalle.centroCodigo || detalle.centro || 'centro').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const fecha = (detalle.fecha || '').slice(0, 10);
      link.href = url;
      link.download = `reporte-muestreo-${proveedor}-${centro}-${fecha}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar reporte:', err);
      addToast({ title: 'Error', message: 'No se pudo descargar el reporte.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [generarHTMLReporte, addToast]);

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
    <div className="muestreos-container am-p-24" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      <div className="mx-toolbar am-mt-16">
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => { setViewMode('list'); setPage(1); }}><List size={14} /> Historial</button>
          <button className={`mx-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`} onClick={() => { setViewMode('grouped'); setPage(1); }}><LayoutGrid size={14} /> Agrupado</button>
        </div>
        <div className="mx-search-box" style={{ flex: 1 }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor o centro..." 
            className="mx-input" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <button className="mx-btn mx-btn-outline sm" onClick={() => { setPage(1); loadData(1); }}><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary sm" onClick={resetForm}>
          <Plus size={18} /> Muestreo
        </button>
      </div>

      {loading ? (
        <div className="am-p-64 am-text-center"><div className="mx-loader"></div></div>
      ) : (
        <div className="mx-table-card am-mt-16">
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  <th style={{ width: viewMode === 'grouped' ? '40px' : '100px' }}>{viewMode === 'grouped' ? '' : 'Fecha'}</th>
                  <th>Proveedor / Centro</th>
                  <th style={{ textAlign: 'center' }}>Muestras</th>
                  <th style={{ textAlign: 'center' }}>R% Prom.</th>
                  <th style={{ textAlign: 'center' }}>U x Kg</th>
                  <th style={{ textAlign: 'center' }}>Procesable %</th>
                  <th style={{ textAlign: 'center' }}>% Rechazo</th>
                  <th style={{ textAlign: 'center' }}>{viewMode === 'list' ? 'Calificación' : ''}</th>
                  <th style={{ textAlign: 'right' }}>{viewMode === 'list' ? 'Acciones' : ''}</th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'list' ? (
                  filtered.map(m => (
                    <tr key={m._id || m.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL') : '—'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{m.proveedorNombre || m.proveedor}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={10} /> {m.centroCodigo || 'Sin Centro'} {m.linea && `· L: ${m.linea}`}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>1</td>
                      <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-info" style={{ fontWeight: 700 }}>{Number(m.rendimiento || 0).toFixed(1)}%</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{m.uxkg || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>
                        {m.total > 0 ? (m.procesable / m.total * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: (m.total > 0 && m.rechazos/m.total > 0.05) ? 'var(--color-error)' : 'inherit' }}>
                          {m.total > 0 ? (m.rechazos / m.total * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {m.clasificaciones?.[0] ? <span className="mx-badge mx-badge-success">{m.clasificaciones[0].nombre}</span> : <span className="mx-badge mx-badge-muted">S/C</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="mx-action-btn print" title="Ver reporte" onClick={() => verReporte(m)}><Printer size={14} /></button>
                          <button className="mx-action-btn edit" title="Editar" onClick={() => handleEdit(m)}><Edit size={14} /></button>
                          <button className="mx-action-btn delete" title="Eliminar" onClick={() => { setDeleteTarget(m); setDeleteOpen(true); }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  groupedData.map(g => (
                    <React.Fragment key={g.key}>
                      <tr onClick={() => toggleGroup(g.key)} style={{ cursor: 'pointer', background: expandedGroups.has(g.key) ? 'var(--color-primary-bg)' : 'white' }}>
                        <td style={{ textAlign: 'center' }}>{expandedGroups.has(g.key) ? <ChevronUp size={16} color="var(--color-primary)" /> : <ChevronDown size={16} />}</td>
                        <td style={{ fontWeight: 800, color: 'var(--color-text)' }}>{g.key}</td>
                        <td style={{ textAlign: 'center' }}><span className="mx-badge mx-badge-muted" style={{ fontWeight: 700 }}>{g.muestras}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-primary)' }}>{(g.rendSum / g.muestras).toFixed(1)}%</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{(g.uxkgSum / g.muestras).toFixed(0)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>
                          {g.totalSum > 0 ? ( (g.totalSum - g.rechazosSum) / g.totalSum * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: (g.rechazosSum / g.totalSum * 100) > 5 ? 'var(--color-error)' : 'inherit' }}>
                          {(g.totalSum > 0 ? (g.rechazosSum / g.totalSum * 100).toFixed(1) : 0)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td style={{ textAlign: 'right' }}><ChevronRight size={14} style={{ opacity: 0.2 }} /></td>
                      </tr>
                      {expandedGroups.has(g.key) && g.items.map(m => (
                        <tr key={m._id} style={{ background: '#fafafa' }}>
                          <td style={{ textAlign: 'right', borderRight: '2px solid var(--color-primary)' }}></td>
                          <td style={{ paddingLeft: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>{new Date(m.fecha).toLocaleDateString('es-CL')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>{m.centroCodigo || 'Sin Centro'} {m.linea && `· L: ${m.linea}`}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>1</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{Number(m.rendimiento).toFixed(1)}%</td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{m.uxkg}</td>
                          <td style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-success)', fontWeight: 700 }}>
                            {m.total > 0 ? (m.procesable / m.total * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '13px' }}>{m.total > 0 ? (m.rechazos / m.total * 100).toFixed(1) : 0}%</td>
                          <td style={{ textAlign: 'center' }}>
                            {m.clasificaciones?.[0] ? <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>{m.clasificaciones[0].nombre}</span> : <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>S/C</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                              <button className="mx-action-btn print" style={{ width: '28px', height: '28px' }} title="Ver reporte" onClick={(e) => { e.stopPropagation(); verReporte(m); }}><Printer size={12} /></button>
                              <button className="mx-action-btn edit" style={{ width: '28px', height: '28px', opacity: isLoadingDetails && editingId === (m._id || m.id) ? 0.5 : 1 }} title="Editar" disabled={isLoadingDetails} onClick={(e) => { e.stopPropagation(); if (!isLoadingDetails) handleEdit(m); }}><Edit size={12} /></button>
                              <button className="mx-action-btn delete" style={{ width: '28px', height: '28px' }} title="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); setDeleteOpen(true); }}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {viewMode === 'list' && pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-subtle)' }}>
                {pagination.total} muestreos &nbsp;·&nbsp; Pág. {pagination.page} / {pagination.pages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="mx-btn mx-btn-outline sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ArrowLeft size={14} /> Anterior
                </button>
                <button
                  className="mx-btn mx-btn-outline sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                >
                  Siguiente <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar este muestreo?"
        itemName={deleteTarget?.proveedorNombre || deleteTarget?.proveedor}
        description={deleteTarget ? `Estás por eliminar el muestreo del ${new Date(deleteTarget.fecha).toLocaleDateString('es-CL')}${deleteTarget.centroCodigo ? ` en el centro ${deleteTarget.centroCodigo}` : ''}. Esta acción no se puede deshacer.` : ''}
      />

      {isModalOpen && (
        <div className="mx-modal-overlay mu-modal-overlay">
          <div className="mx-modal mu-main-modal">
            <div className="mx-modal-header" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 20px', minHeight: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                <h3 className="mx-modal-title" style={{ fontSize: '1rem', whiteSpace: 'nowrap' }}>
                  {editingId ? 'Editar' : 'Nuevo'} Muestreo Técnico
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
                          {n === 1 ? 'Contexto' : n === 2 ? 'Análisis' : 'Resultado'}
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
                          {filteredProviders.length > 0 && (
                            <div className="mu-dropdown shadow-lg">
                              {filteredProviders.map(p => (
                                <button key={p.id} type="button" onClick={() => handleSelectProvider(p)} className="mu-opt">
                                  <strong>{p.proveedorNombre}</strong>
                                  <span>{p.comuna} · {p.contactoNombre}</span>
                                </button>
                              ))}
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
                      <label className="mx-label">Línea</label>
                      <input className="mx-input" placeholder="N°" value={form.linea} onChange={e => setForm({...form, linea: e.target.value})} />
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
                      <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>Parámetros</h4>
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
                        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800 }}>Análisis Técnico</h4>
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
                          <span>+ Añadir {activeTab}s...</span>
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
                                  No hay más ítems disponibles
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
                    <h3 className="am-mt-16">Resumen del Análisis</h3>
                    <p className="am-mb-32">Verifica los datos antes de guardar la calificación oficial.</p>
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
                    <span>Este muestreo será registrado por <strong>{form.responsable || 'Usuario Sistema'}</strong> para el proveedor <strong>{form.proveedorNombre}</strong>.</span>
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
                <ArrowLeft size={16} /> Atrás
              </button>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                {step < 3 ? (
                  <button className="mx-btn mx-btn-primary" onClick={() => setStep(s => s + 1)} disabled={isLoadingDetails}>
                    Siguiente <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="mx-btn mx-btn-primary" onClick={handleSave} disabled={isLoadingDetails}>
                    <CheckCircle2 size={16} /> Guardar Calificación
                  </button>
                )}
              </div>
            </div>
          </div>

          {step === 2 && (
            <div className="mu-side-car">
              <div className="mu-side-car-header">Métricas Resumen</div>
              
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
              {resultData.clasificaciones?.[0]?.nombre || 'Sin Clasificación'}
            </h2>
            <p style={{ color: 'var(--color-text-subtle)', marginTop: '8px' }}>
              La materia prima ha sido analizada y calificada según los parámetros vigentes.
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

    </div>
  );
}
