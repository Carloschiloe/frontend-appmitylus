import React, { useState, useEffect } from 'react';
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
      // Deseleccionar
      localStorage.removeItem('selected_tenant_db');
      setSelectedDb('');
    } else {
      localStorage.setItem('selected_tenant_db', dbName);
      setSelectedDb(dbName);
    }
    setIsOpen(false);
    // Recargar la página para limpiar estados de query y forzar refetch con el nuevo header
    window.location.reload();
  };

  if (user?.rol !== 'superadmin') return null;

  const currentEmpresa = empresas.find(e => e.dbName === selectedDb);

  return (
    <div className="mx-tenant-selector">
      <button className="mx-tenant-btn" onClick={() => setIsOpen(!isOpen)}>
        <Building2 size={16} />
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
