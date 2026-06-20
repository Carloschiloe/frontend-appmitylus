import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { X, MapPin } from 'lucide-react';
import { getCentrosMapa } from '../../../api/api-centros';
import { useAuth } from '../../../context/AuthContext';
import 'leaflet/dist/leaflet.css';

const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    const all = positions.flat();
    if (all.length < 2) return;
    map.fitBounds(all, { padding: [48, 48] });
  }, [map, positions]);
  return null;
}

export default function ProviderMapModal({ provider, onClose }) {
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ['centros', 'mapa'],
    queryFn: ({ signal }) => getCentrosMapa({ signal }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const providerKey = String(provider.key || provider.providerKey || '').trim().toLowerCase();
  const centroCodigo = String(provider.centroCodigo || '').trim().toLowerCase();

  const centros = useMemo(() => {
    return data
      .filter((c) => {
        if (!Array.isArray(c.coords) || c.coords.length < 3) return false;
        if (centroCodigo) return String(c.code || '').trim().toLowerCase() === centroCodigo;
        const key = String(c.proveedorKey || '').trim().toLowerCase();
        return key === providerKey;
      })
      .map((c) => ({
        ...c,
        positions: c.coords.map((p) => [Number(p.lat), Number(p.lng)]),
      }));
  }, [data, providerKey]);

  const allPositions = centros.map((c) => c.positions);

  return (
    <div className="dir-mapmodal-overlay" onClick={onClose}>
      <div className="dir-mapmodal" onClick={(e) => e.stopPropagation()}>
        <div className="dir-mapmodal-header">
          <div className="dir-mapmodal-title">
            <MapPin size={15} />
            <span>{provider.nombre}</span>
            {!isLoading && (
              <span className="dir-mapmodal-count">
                {centros.length} centro{centros.length !== 1 ? 's' : ''} con coordenadas
              </span>
            )}
          </div>
          <button type="button" className="mx-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="dir-mapmodal-body">
          {isLoading ? (
            <div className="dir-mapmodal-state">
              <div className="mx-spinner"></div>
            </div>
          ) : centros.length === 0 ? (
            <div className="dir-mapmodal-state">
              <MapPin size={36} style={{ opacity: 0.25 }} />
              <p>Sin coordenadas registradas para los centros de este proveedor.</p>
            </div>
          ) : (
            <MapContainer
              center={[-42.5, -73.5]}
              zoom={10}
              style={{ width: '100%', height: '100%' }}
              zoomControl
            >
              <TileLayer url={SATELLITE} attribution="" />
              <FitBounds positions={allPositions} />
              {centros.map((centro) => (
                <Polygon
                  key={centro.code || centro._id}
                  positions={centro.positions}
                  pathOptions={{
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.35,
                    weight: 2.5,
                  }}
                >
                  <Tooltip sticky>
                    <strong>{centro.code}</strong>
                    {centro.comuna && <><br />{centro.comuna}</>}
                    {centro.hectareas && <><br />{centro.hectareas} há</>}
                  </Tooltip>
                </Polygon>
              ))}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}
