import React, { useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { empresasApi } from '../../api/api-empresas';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';

export default function TenantSelector() {
  const { user } = useAuth();
  const [selectedDb, setSelectedDb] = useState(localStorage.getItem('selected_tenant_db') || '');
  const [isOpen, setIsOpen] = useState(false);

  // Solo cargar empresas si es superadmin
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: empresasApi.getEmpresas,
    enabled: user?.rol === 'superadmin'
  });

  const handleSelect = (dbName) => {
    if (dbName === selectedDb) {
      localStorage.removeItem('selected_tenant_db');
      localStorage.removeItem('selected_tenant_nombre');
      localStorage.removeItem('selected_tenant_logo');
      setSelectedDb('');
    } else {
      const emp = empresas.find(e => e.dbName === dbName);
      localStorage.setItem('selected_tenant_db', dbName);
      localStorage.setItem('selected_tenant_nombre', emp?.nombre || '');
      localStorage.setItem('selected_tenant_logo', emp?.config?.logo || '');
      setSelectedDb(dbName);
    }
    setIsOpen(false);
    window.location.reload();
  };

  if (user?.rol !== 'superadmin') return null;

  const currentEmpresa = empresas.find(e => e.dbName === selectedDb);

  const EmpresaIcon = ({ emp, size = 16 }) => emp?.config?.logo
    ? <img src={emp.config.logo} alt={emp.nombre} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '3px', flexShrink: 0 }} />
    : <Building2 size={size} />;

  return (
    <div className="mx-tenant-selector">
      <button className="mx-tenant-btn" onClick={() => setIsOpen(!isOpen)}>
        <EmpresaIcon emp={currentEmpresa} size={16} />
        <span className="mx-tenant-label">
          {currentEmpresa ? currentEmpresa.nombre : 'Seleccionar Empresa'}
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="mx-tenant-dropdown">
          <div className="mx-tenant-dropdown-header">Cambiar Contexto</div>
          <button
            className={`mx-tenant-item ${!selectedDb ? 'is-active' : ''}`}
            onClick={() => handleSelect('')}
          >
            <span>Global / Sin Empresa</span>
            {!selectedDb && <Check size={14} />}
          </button>
          <div className="mx-tenant-divider"></div>
          {empresas.map(emp => (
            <button
              key={emp._id}
              className={`mx-tenant-item ${selectedDb === emp.dbName ? 'is-active' : ''}`}
              onClick={() => handleSelect(emp.dbName)}
            >
              <EmpresaIcon emp={emp} size={20} />
              <div>
                <div className="mx-tenant-name">{emp.nombre}</div>
                <div className="mx-tenant-db">{emp.dbName}</div>
              </div>
              {selectedDb === emp.dbName && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
