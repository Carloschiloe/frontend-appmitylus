import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Maximize, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCentros } from '../../../api/api-centros';

// Componente para invalidar el tamaño del mapa cuando cambia la vista
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);
  return null;
}

export default function CentrosMap() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['centros', 'mapa'],
    queryFn: () => getCentros(),
  });

  // Filtrar centros que tienen coordenadas válidas (polígono con al menos 3 puntos)
  const mapCentros = useMemo(() => {
    return data.filter(c => {
      const hasCoords = Array.isArray(c.coords) && c.coords.length >= 3;
      const matchesSearch = searchTerm === '' || 
        c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
      return hasCoords && matchesSearch;
    });
  }, [data, searchTerm]);

  const centerPosition = [-42.5, -73.5]; // Centro aproximado de Chiloé

  return (
    <div className="centros-map-container">
      <div className="map-toolbar">
        <div className="centros-search-wrap" style={{ maxWidth: '300px' }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar en mapa..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="mx-btn mx-btn-outline">
          <Layers size={18} /> Capas
        </button>
        <button className="mx-btn mx-btn-outline">
          <Maximize size={18} /> Pantalla completa
        </button>
      </div>

      <div className="centros-map-shell">
        {loading ? (
          <div className="mx-loading-placeholder">
            <div className="mx-spinner"></div>
            <p>Preparando cartografía...</p>
          </div>
        ) : (
          <MapContainer 
            center={centerPosition} 
            zoom={9} 
            scrollWheelZoom={true}
            style={{ height: '600px', width: '100%', borderRadius: '12px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <InvalidateSize />
            
            {mapCentros.map(centro => (
              <Polygon
                key={centro._id}
                positions={centro.coords.map(p => [p.lat, p.lng])}
                pathOptions={{
                  color: '#6366f1',
                  fillColor: '#6366f1',
                  fillOpacity: 0.35,
                  weight: 2
                }}
              >
                <Popup>
                  <div className="map-popup-content">
                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--color-primary)' }}>{centro.proveedor}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      <strong>Código:</strong> {centro.code}<br />
                      <strong>Comuna:</strong> {centro.comuna}<br />
                      <strong>Hectáreas:</strong> {centro.hectareas} ha
                    </p>
                  </div>
                </Popup>
              </Polygon>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
