import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  X,
  Globe,
  Database,
} from 'lucide-react';

 import { empresasApi } from '../../api/api-empresas';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { useToast } from '../../context/ToastContext';
import './usuarios.css'; // Reutilizamos estilos de usuarios para consistencia
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

const MAX_LOGO_BYTES = 200 * 1024; // 200 KB

export default function Empresas() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [confirmDeleteEmpresa, setConfirmDeleteEmpresa] = useState(null);

  // React Query: Obtener empresas
  const { data: empresas = [], isLoading: loading } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasApi.getEmpresas,
  });

  // React Query: Mutaciones
  const saveMutation = useMutation({
    mutationFn: (body) => editingEmpresa
      ? empresasApi.updateEmpresa(editingEmpresa._id, body)
      : empresasApi.createEmpresa(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setIsModalOpen(false);
      addToast({ title: 'Éxito', message: 'Empresa guardada correctamente.', type: 'success' });
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo guardar la empresa.', type: 'error' });
    }
  });

   const deleteMutation = useMutation({
     mutationFn: (id) => empresasApi.deleteEmpresa(id),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['empresas'] });
       addToast({ title: 'Éxito', message: 'Empresa desactivada.', type: 'success' });
       setConfirmDeleteEmpresa(null);
     },
     onError: () => {
       addToast({ title: 'Error', message: 'No se pudo desactivar la empresa.', type: 'error' });
     }
   });

  const openModal = (empresa = null) => {
    setEditingEmpresa(empresa);
    setLogoPreview(empresa?.config?.logo || null);
    setIsModalOpen(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      addToast({ title: 'Error', message: 'El logo no debe superar 200 KB. Usa un PNG o SVG optimizado.', type: 'error' });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

   const handleSave = (e) => {
     e.preventDefault();
     const formData = new FormData(e.target);
     const body = Object.fromEntries(formData.entries());
     body.activo = formData.get('activo') === 'on';
     body.config = { logo: logoPreview || null };

     saveMutation.mutate(body);
   };

   const filteredEmpresas = empresas.filter(e =>
     e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
     e.rut?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     e.slug?.toLowerCase().includes(searchTerm.toLowerCase())
   );

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Administración Global · SaaS</p>
          <h1>Gestión de Empresas</h1>
          <p>Control de clientes, bases de datos y estados de suscripción.</p>
        </div>
        <div className="mx-hero-actions">
          <button className="mx-btn mx-btn-primary" onClick={(e) => { e.stopPropagation(); openModal(); }}>
            <Plus size={18} /> Nueva Empresa
          </button>
        </div>
      </header>

      <div className="mx-content-frame">
        <div className="centros-filters usuarios-toolbar">
          <div className="centros-search-wrap usuarios-search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar empresas..."
              className="centros-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="mx-badge-muted usuarios-count-badge">
            <Building2 size={16} /> <span>{filteredEmpresas.length} Empresas</span>
          </div>
        </div>

        <div className="mx-table-card am-mt-16">
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Empresa</th>
                  <th>ID / Slug</th>
                  <th>Base de Datos</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="usuarios-empty-state"><div className="mx-spinner usuarios-spinner-center"></div></td></tr>
                ) : (
                  filteredEmpresas.map(emp => (
                    <tr key={emp._id}>
                      <td data-label="Empresa">
                        <div className="usuarios-avatar-wrapper">
                          <div className="usuarios-avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)', overflow: 'hidden', padding: emp.config?.logo ? 0 : undefined }}>
                            {emp.config?.logo
                              ? <img src={emp.config.logo} alt={emp.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              : <Building2 size={20} />
                            }
                          </div>
                          <div>
                            <div className="usuarios-name">{emp.nombre}</div>
                            <div className="usuarios-email">{emp.rut || 'Sin RUT'}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="ID / Slug">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          <Globe size={14} /> {emp.slug}
                        </div>
                      </td>
                      <td data-label="Base de Datos">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 500 }}>
                          <Database size={14} /> {emp.dbName}
                        </div>
                      </td>
                      <td data-label="Estado">
                        <span className={`mx-badge ${emp.activo ? 'mx-badge-success' : 'mx-badge-muted'}`}>
                          {emp.activo ? 'ACTIVA' : 'INACTIVA'}
                        </span>
                      </td>
                       <td data-label="Acciones" style={{ textAlign: 'right' }}>
                         <div className="mx-table-actions-cell" style={{ display: 'inline-flex', justifyContent: 'flex-end', width: '100%' }}>
                           <button className="mx-action-btn edit" onClick={() => openModal(emp)}><Edit size={14} /></button>
                           <button className="mx-action-btn delete" onClick={() => setConfirmDeleteEmpresa(emp)}>
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteEmpresa)}
        onClose={() => setConfirmDeleteEmpresa(null)}
        onConfirm={() => confirmDeleteEmpresa?._id && deleteMutation.mutate(confirmDeleteEmpresa._id)}
        itemName={confirmDeleteEmpresa?.nombre}
        title="¿Desactivar empresa?"
        description={
          confirmDeleteEmpresa
            ? `Estás a punto de desactivar "${confirmDeleteEmpresa.nombre}". Podrás reactivarla más adelante si lo necesitas.`
            : ''
        }
        confirmLabel="Desactivar"
      />
      {/* Modal Empresa */}
      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-header">
              <h2>{editingEmpresa ? 'Editar' : 'Nueva'} Empresa</h2>
              <button type="button" className="mx-btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} autoComplete="off" className="mx-form">
              <div className="mx-modal-body">

                {/* Logo */}
                <div className="mx-form-group">
                  <label className="mx-label">Logo de la empresa</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '10px', border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                    }}>
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <Building2 size={28} color="var(--color-text-subtle)" />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoChange}
                        style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', width: '100%' }}
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        PNG, SVG o JPG · máx. 200 KB
                      </p>
                      {logoPreview && (
                        <button type="button"
                          onClick={() => setLogoPreview(null)}
                          style={{ fontSize: '0.75rem', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
                        >
                          Quitar logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mx-form-group">
                  <label className="mx-label">Nombre de la Empresa</label>
                  <input name="nombre" className="mx-input" defaultValue={editingEmpresa?.nombre || ''} placeholder="Ej: Pacific Gold Chile" required />
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">RUT</label>
                  <input name="rut" className="mx-input" defaultValue={editingEmpresa?.rut || ''} placeholder="Ej: 77.123.456-7" />
                </div>

                <div className="mx-form-group">
                  <label className="mx-label">Base de Datos (Nombre Físico)</label>
                  <input name="dbName" className="mx-input" defaultValue={editingEmpresa?.dbName || ''} placeholder="Ej: mitynex_db_original" />
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Si dejas este campo vacío, se generará uno automáticamente basado en el nombre.
                  </p>
                </div>

                <div className="mx-form-group usuarios-modal-checkbox">
                  <label className="mx-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" name="activo" defaultChecked={editingEmpresa ? editingEmpresa.activo : true} />
                    Empresa Activa
                  </label>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Guardando...' : editingEmpresa ? 'Guardar Cambios' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
         </div>
       )}
     </div>
   );
 }


