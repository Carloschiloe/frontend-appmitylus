import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Edit,
  Trash2,
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  ShieldAlert,
  UserX,
  UserCheck,
  X,
  Lock,
} from 'lucide-react';

import { usuariosApi } from '../../api/api-usuarios';
import { empresasApi } from '../../api/api-empresas';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import './usuarios.css';

const EMPTY_CONFIRM = {
  isOpen: false,
  type: '',
  user: null,
  title: '',
  message: '',
  actionLabel: '',
  isDestructive: false,
};

export default function Usuarios() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isConfirmStatusOpen, setIsConfirmStatusOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [confirmModal, setConfirmModal] = useState(EMPTY_CONFIRM);

  const { data: usuarios = [], isLoading: loading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosApi.getUsuarios,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasApi.getEmpresas,
    enabled: currentUser?.rol === 'superadmin',
  });

  const closeConfirmModal = () => setConfirmModal(EMPTY_CONFIRM);

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editingUser
        ? usuariosApi.actualizarUsuario(editingUser._id, body)
        : usuariosApi.crearUsuario(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setIsModalOpen(false);
      setEditingUser(null);
      addToast({ title: 'Éxito', message: 'Usuario guardado correctamente.', type: 'success' });
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo guardar el usuario.', type: 'error' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, activo }) => usuariosApi.toggleEstado(id, activo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setIsConfirmStatusOpen(false);
      setUserToToggle(null);
      addToast({ title: 'Éxito', message: 'Estado del usuario actualizado.', type: 'success' });
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo cambiar el estado del usuario.', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usuariosApi.eliminarUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      addToast({ title: 'Éxito', message: 'Usuario eliminado correctamente.', type: 'success' });
      closeConfirmModal();
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo eliminar el usuario.', type: 'error' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id) => usuariosApi.restablecerPassword(id),
    onSuccess: () => {
      addToast({ title: 'Éxito', message: 'Contraseña restablecida y correo enviado.', type: 'success' });
      closeConfirmModal();
    },
    onError: () => {
      addToast({ title: 'Error', message: 'No se pudo restablecer la contraseña.', type: 'error' });
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());
    body.activo = formData.get('activo') === 'on';
    saveMutation.mutate(body);
  };

  const handleToggleStatus = () => {
    if (!userToToggle) return;
    toggleStatusMutation.mutate({ id: userToToggle._id, activo: !userToToggle.activo });
  };

  const resetPassword = (u) => {
    setConfirmModal({
      isOpen: true,
      type: 'reset',
      user: u,
      title: 'Restablecer Contraseña',
      message: `¿Restablecer la contraseña de ${u.nombre}? Se enviará un correo con un link de activación válido por 24 horas.`,
      actionLabel: 'Sí, Restablecer',
      isDestructive: false,
    });
    setActiveMenu(null);
  };

  const deleteUser = (u) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      user: u,
      title: 'Eliminar Usuario',
      message: `¿ELIMINAR PERMANENTEMENTE a ${u.nombre}? Esta acción no se puede deshacer.`,
      actionLabel: 'Sí, Eliminar',
      isDestructive: true,
    });
    setActiveMenu(null);
  };

  const handleConfirmAction = () => {
    if (confirmModal.type === 'reset') {
      resetPasswordMutation.mutate(confirmModal.user._id);
      return;
    }
    if (confirmModal.type === 'delete') {
      deleteMutation.mutate(confirmModal.user._id);
    }
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const initials = (nombre) =>
    nombre?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';

  const getRolConfig = (rol) => {
    const configs = {
      admin: { label: 'ADMINISTRADOR', color: '#1d4ed8', icon: ShieldAlert, bg: '#dbeafe' },
      usuario: { label: 'USUARIO', color: '#059669', icon: ShieldCheck, bg: '#d1fae5' },
      lectura: { label: 'SOLO LECTURA', color: '#475569', icon: Shield, bg: '#f1f5f9' },
      superadmin: { label: 'SUPERADMIN', color: '#7c3aed', icon: ShieldAlert, bg: '#f5f3ff' },
    };
    return configs[rol] || configs.usuario;
  };

  const getEmpresaNombre = (empresaId) => {
    if (!empresaId) return 'N/A';
    const emp = empresas.find((e) => e._id === empresaId);
    return emp ? emp.nombre : 'Cargando...';
  };

  return (
    <div className="mx-page" onClick={() => setActiveMenu(null)}>
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Configuración · Accesos</p>
          <h1>Gestión de Usuarios</h1>
          <p>Control de acceso, roles y permisos de la plataforma.</p>
        </div>
        <div className="mx-hero-actions">
          <button
            className="mx-btn mx-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              setEditingUser(null);
              setIsModalOpen(true);
            }}
          >
            <UserPlus size={18} /> Nuevo Usuario
          </button>
        </div>
      </header>

      <div className="mx-content-frame">
        <div className="mx-toolbar am-mt-16">
          <div className="mx-search-box" style={{ maxWidth: '300px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="mx-badge mx-badge-muted" style={{ marginLeft: 'auto' }}>
            <Users size={16} /> <span>{filteredUsuarios.length} Usuarios</span>
          </div>
        </div>

        <div className="mx-table-card am-mt-16">
          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Usuario</th>
                  <th>Rol</th>
                  <th>Empresa</th>
                  <th style={{ width: '120px' }}>Estado</th>
                  <th>Último Acceso</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6">
                      <div className="mx-state-placeholder">
                        <div className="mx-spinner"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="mx-state-placeholder">No hay resultados.</div>
                    </td>
                  </tr>
                ) : (
                  filteredUsuarios.map((u) => {
                    const rol = getRolConfig(u.rol);
                    return (
                      <tr key={u._id}>
                        <td>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className="mx-btn-icon sm" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 'var(--weight-bold)' }}>
                              {initials(u.nombre)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'var(--weight-bold)' }}>{u.nombre}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mx-badge" style={{ background: rol.bg, color: rol.color }}>
                            <rol.icon size={12} /> {rol.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                            {getEmpresaNombre(u.empresaId)}
                          </div>
                        </td>
                        <td>
                          <span className={`mx-badge mx-badge-${u.activo ? 'success' : 'muted'}`}>
                            {u.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--color-text-subtle)' }}>
                          {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('es-CL') : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="mx-table-actions-cell" style={{ justifyContent: 'flex-end', position: 'relative' }}>
                            <button className="mx-action-btn edit" onClick={(e) => { e.stopPropagation(); setEditingUser(u); setIsModalOpen(true); }}>
                              <Edit size={14} />
                            </button>
                            <button className="mx-action-btn delete" onClick={(e) => { e.stopPropagation(); setUserToToggle(u); setIsConfirmStatusOpen(true); }}>
                              {u.activo ? <UserX size={14} /> : <UserCheck size={14} style={{ color: 'var(--color-success)' }} />}
                            </button>
                            <button
                              className="mx-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === u._id ? null : u._id);
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {activeMenu === u._id && (
                              <div className="usuarios-dropdown-menu">
                                <button className="usuarios-dropdown-item" onClick={() => resetPassword(u)}>
                                  <Lock size={14} /> Restablecer Clave
                                </button>
                                <button className="usuarios-dropdown-item error" onClick={() => deleteUser(u)}>
                                  <Trash2 size={14} /> Eliminar Usuario
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-header">
              <h2>{editingUser ? 'Editar' : 'Nuevo'} Usuario</h2>
              <button type="button" className="mx-btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} key={editingUser?._id || 'nuevo-usuario'} autoComplete="off" className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Nombre Completo</label>
                  <input
                    name="nombre"
                    className="mx-input"
                    defaultValue={editingUser?.nombre || ''}
                    placeholder="Ej: Juan Pérez"
                    required
                    autoComplete="none"
                  />
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Email</label>
                  <input
                    name="email"
                    type="email"
                    className="mx-input"
                    defaultValue={editingUser?.email || ''}
                    placeholder="usuario@appmitylus.com"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="mx-form-group">
                  <select name="rol" className="mx-select" defaultValue={editingUser?.rol || 'usuario'}>
                    <option value="superadmin">SuperAdmin (Global)</option>
                    <option value="admin">Administrador Empresa</option>
                    <option value="usuario">Usuario Operativo</option>
                    <option value="lectura">Solo Lectura</option>
                  </select>
                </div>

                {currentUser?.rol === 'superadmin' && (
                  <div className="mx-form-group">
                    <label className="mx-label">Asignar Empresa</label>
                    <select name="empresaId" className="mx-select" defaultValue={editingUser?.empresaId || ''}>
                      <option value="">Global / Sin Empresa</option>
                      {empresas.map((e) => (
                        <option key={e._id} value={e._id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!editingUser && (
                  <div className="mx-form-group">
                    <label className="mx-label">
                      Contraseña inicial{' '}
                      <span style={{ fontWeight: 400, color: 'var(--color-text-subtle)' }}>
                        (opcional — el usuario la cambia al activar su cuenta)
                      </span>
                    </label>
                    <input
                      name="password"
                      type="password"
                      className="mx-input"
                      placeholder="Dejar vacío para generar automáticamente"
                      autoComplete="new-password"
                    />
                  </div>
                )}

                <div className="mx-form-group usuarios-modal-checkbox">
                  <label className="mx-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" name="activo" defaultChecked={editingUser ? editingUser.activo : true} />
                    Usuario Activo
                  </label>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConfirmStatusOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '400px' }}>
            <div className="mx-modal-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
              <div
                className="usuarios-confirm-icon"
                style={{
                  background: userToToggle?.activo ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                  color: userToToggle?.activo ? 'var(--color-error)' : 'var(--color-success)',
                }}
              >
                {userToToggle?.activo ? <UserX size={32} /> : <UserCheck size={32} />}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>¿{userToToggle?.activo ? 'Desactivar' : 'Activar'} usuario?</h3>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Esto cambiará los permisos de acceso para <strong>{userToToggle?.nombre}</strong>.
              </p>
            </div>
            <div className="mx-modal-footer">
              <button type="button" className="mx-btn mx-btn-outline" style={{ flex: 1 }} onClick={() => setIsConfirmStatusOpen(false)}>
                Cancelar
              </button>
              <button
                className="mx-btn"
                style={{ flex: 1, background: userToToggle?.activo ? 'var(--color-error)' : 'var(--color-success)', color: 'white' }}
                onClick={handleToggleStatus}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'delete'}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        title="¿Eliminar usuario?"
        itemName={confirmModal.user?.nombre}
      />

      {confirmModal.isOpen && confirmModal.type !== 'delete' && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '400px' }}>
            <div className="mx-modal-header">
              <h2>{confirmModal.title}</h2>
              <button type="button" className="mx-btn-icon" onClick={closeConfirmModal}>
                <X size={20} />
              </button>
            </div>
            <div className="mx-modal-body">
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{confirmModal.message}</p>
            </div>
            <div className="mx-modal-footer">
              <button type="button" className="mx-btn mx-btn-outline" onClick={closeConfirmModal}>
                Cancelar
              </button>
              <button
                className={`mx-btn ${confirmModal.isDestructive ? 'mx-btn-danger' : 'mx-btn-primary'}`}
                onClick={handleConfirmAction}
                disabled={resetPasswordMutation.isPending || deleteMutation.isPending}
              >
                {resetPasswordMutation.isPending || deleteMutation.isPending ? 'Procesando...' : confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
