import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/apiClient.js';
import './AlertasCampana.css';

const ESTADO_LABEL = { rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo' };
const ACTIVIDAD_LABEL = {
  programa_cosecha: 'Programa de cosecha activo',
  trato: 'Trato en seguimiento',
  biomasa_disponible: 'Biomasa disponible',
};
const ALERTAS_POLL_MS = 5 * 60 * 1000;

// Dedup: esta campana se monta dos veces a la vez (header de escritorio y
// header móvil, ver comentario más abajo) — ambas instancias piden lo mismo
// casi en el mismo instante. Sin esto, cada una dispara su propio
// GET /alertas-sanitarias (y su propio error si el token está vencido en
// ese momento), duplicando peticiones y ruido en consola sin ningún
// beneficio: ambas terminan mostrando el mismo dato igual.
let alertasInFlight = null;
function fetchAlertasShared() {
  if (!alertasInFlight) {
    alertasInFlight = apiClient.get('/alertas-sanitarias').finally(() => { alertasInFlight = null; });
  }
  return alertasInFlight;
}

// Ícono de campana con alertas sanitarias — usado tanto en el header de
// escritorio (AppHeader) como en el header móvil (App.jsx MainLayout), así
// se ve/comporta igual en ambos y solo hay una fuente de la lógica.
export default function AlertasCampana() {
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState([]);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const alertasRef = useRef(null);
  const fetchAlertasRef = useRef(() => {});

  useEffect(() => {
    const activeTenant = localStorage.getItem('selected_tenant_db');
    if (!activeTenant) return;

    let cancelled = false;
    const fetchAlertas = () => {
      fetchAlertasShared()
        .then((data) => { if (!cancelled) setAlertas(Array.isArray(data?.items) ? data.items : []); })
        .catch(() => {});
    };
    fetchAlertasRef.current = fetchAlertas;
    fetchAlertas();
    const interval = setInterval(fetchAlertas, ALERTAS_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!alertasOpen) return;
    const onDown = (e) => {
      if (!alertasRef.current?.contains(e.target)) setAlertasOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [alertasOpen]);

  const irACentro = () => {
    setAlertasOpen(false);
    navigate('/centros/sanitario');
  };

  const reactivarAlerta = (e, alerta) => {
    e.stopPropagation();
    if (!alerta.envioId) return;
    apiClient.post(`/alertas-sanitarias/${alerta.envioId}/reactivar`)
      .then(() => fetchAlertasRef.current())
      .catch(() => {});
  };

  return (
    <div className="mx-app-header-alertas" ref={alertasRef}>
      <button
        type="button"
        className="mx-aha-btn"
        onClick={() => setAlertasOpen((v) => !v)}
        title="Alertas sanitarias"
      >
        <Bell size={17} />
        {alertas.length > 0 && <span className="mx-aha-badge">{alertas.length}</span>}
      </button>

      {alertasOpen && (
        <div className="mx-aha-dropdown">
          <div className="mx-aha-dropdown-header">Alertas sanitarias</div>
          {alertas.length === 0 ? (
            <div className="mx-aha-empty">No hay alertas activas.</div>
          ) : (
            <div className="mx-aha-list">
              {alertas.map((a) => (
                <div
                  key={`${a.centroCodigo}-${a.areaPSMB}`}
                  role="button"
                  tabIndex={0}
                  className="mx-aha-item"
                  onClick={irACentro}
                  onKeyDown={(e) => { if (e.key === 'Enter') irACentro(); }}
                >
                  <span className={`mx-aha-dot mx-aha-dot-${a.estado}`} />
                  <div className="mx-aha-item-body">
                    <div className="mx-aha-item-title">
                      {a.centroCodigo} {a.centroNombre ? `- ${a.centroNombre}` : ''}
                      <span className="mx-aha-item-estado">{ESTADO_LABEL[a.estado] || a.estado}</span>
                    </div>
                    <div className="mx-aha-item-sub">Área {a.areaPSMB}</div>
                    <div className="mx-aha-item-actividades">
                      {(a.actividades || []).map((t) => ACTIVIDAD_LABEL[t] || t).join(' · ')}
                    </div>
                    {a.silenciada && (
                      <div className="mx-aha-item-silenciada">
                        <BellOff size={11} /> Avisos por correo silenciados
                        <button type="button" className="mx-aha-reactivar-btn" data-edit onClick={(e) => reactivarAlerta(e, a)}>
                          <RotateCcw size={11} /> Reactivar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
