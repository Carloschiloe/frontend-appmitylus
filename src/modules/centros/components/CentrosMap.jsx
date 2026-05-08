import React, { useState, useEffect, useMemo } from 'react';
import { Search, Maximize, Ruler, X } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { getCentros } from '../../../api/api-centros';

const SPECIES_CONFIG = {
  mitilidos: { label: 'En Cosecha', color: '#22c55e', keys: ['mitilidos', 'choritos', 'mejillon', 'moluscos'] },
  semilla:   { label: 'Semilla',    color: '#3b82f6', keys: ['semilla', 'recoleccion'] },
  otros:     { label: 'Otros',      color: '#94a3b8', keys: ['otros', 'varios'] }
};

const MAP_LAYERS = {
  street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
};

// Componente para invalidar el tamaño del mapa cuando cambia la vista
function InvalidateSize({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150); // Reducido para mayor agilidad
    return () => clearTimeout(timer);
  }, [map, trigger]);

  useEffect(() => {
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  return null;
}

function ZoomHandler({ setZoom }) {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });
  return null;
}

export default function CentrosMap() {
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSpecies, setActiveSpecies] = useState('all');
  const [mapType, setMapType] = useState('street');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [selectedCentro, setSelectedCentro] = useState(null);
  const [zoom, setZoom] = useState(9);
  const [mapInstance, setMapInstance] = useState(null);

  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['centros', 'mapa'],
    queryFn: ({ signal }) => getCentros({}, { signal }),
    enabled: Boolean(selectedTenantDb),
  });

  // Efecto para manejar el scroll y sidebar en fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      const sidebar = document.querySelector('.mx-sidebar');
      if (sidebar) sidebar.style.display = 'none';
    } else {
      document.body.style.overflow = 'auto';
      const sidebar = document.querySelector('.mx-sidebar');
      if (sidebar) sidebar.style.display = 'flex';
    }
    return () => {
      document.body.style.overflow = 'auto';
      const sidebar = document.querySelector('.mx-sidebar');
      if (sidebar) sidebar.style.display = 'flex';
    };
  }, [isFullscreen]);

  const searchSuggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return data.filter(c => 
      c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.proveedor?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 8);
  }, [data, searchTerm]);

  const handleSelectSuggestion = (centro) => {
    setSearchTerm(centro.code);
    setSelectedCentro(centro);
    if (mapInstance && centro.coords?.length > 0) {
      const firstCoord = [centro.coords[0].lat, centro.coords[0].lng];
      mapInstance.flyTo(firstCoord, 16, { duration: 0.8 }); // Animación más rápida
    }
  };

  const mapCentros = useMemo(() => {
    return data.filter(c => {
      const hasCoords = Array.isArray(c.coords) && c.coords.length >= 3;
      const matchesSearch = searchTerm === '' || 
        c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const grupo = (c.grupoEspecie || '').toLowerCase();
      const especies = Array.isArray(c.especies) ? c.especies.map(e => e.toLowerCase()) : [];
      
      let matchesSpecies = activeSpecies === 'all';
      if (!matchesSpecies) {
        const config = SPECIES_CONFIG[activeSpecies];
        matchesSpecies = config.keys.some(k => grupo.includes(k) || especies.some(e => e.includes(k)));
      }

      return hasCoords && matchesSearch && matchesSpecies;
    });
  }, [data, searchTerm, activeSpecies]);

  const centerPosition = [-42.5, -73.5]; // Centro aproximado de Chiloé

  return (
    <div className={`centros-map-container ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="map-toolbar">
        <div className="centros-search-wrap" style={{ maxWidth: '320px' }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar código o proveedor..." 
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchSuggestions.length > 0 && (
            <div className="mx-search-dropdown">
              {searchSuggestions.map(c => (
                <div 
                  key={c._id} 
                  className="mx-search-item"
                  onClick={() => handleSelectSuggestion(c)}
                >
                  <div className="search-item-main">{c.code}</div>
                  <div className="search-item-sub">{c.proveedor}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-toggle-group">
          <button 
            className={`mx-toggle-btn ${activeSpecies === 'all' ? 'active' : ''}`}
            onClick={() => setActiveSpecies('all')}
          >Todo</button>
          {Object.entries(SPECIES_CONFIG).map(([id, cfg]) => (
            <button 
              key={id}
              className={`mx-toggle-btn ${activeSpecies === id ? 'active' : ''}`}
              onClick={() => setActiveSpecies(id)}
              style={{ borderLeft: activeSpecies === id ? `3px solid ${cfg.color}` : '' }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }}></div>

        <div className="mx-toggle-group">
          <button 
            className={`mx-toggle-btn ${mapType === 'street' ? 'active' : ''}`}
            onClick={() => setMapType('street')}
          >Calles</button>
          <button 
            className={`mx-toggle-btn ${mapType === 'satellite' ? 'active' : ''}`}
            onClick={() => setMapType('satellite')}
          >Satélite</button>
        </div>

        <button 
          className={`mx-btn mx-btn-outline ${isMeasuring ? 'active' : ''}`}
          onClick={() => setIsMeasuring(!isMeasuring)}
          title="Medir distancia"
        >
          <Ruler size={18} />
        </button>

        <button className="mx-btn mx-btn-outline" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <X size={18} /> : <Maximize size={18} />}
          {isFullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {!selectedTenantDb ? (
          <div className="mx-loading-placeholder">
            <p>Selecciona una empresa para ver el mapa de centros.</p>
          </div>
        ) : loading ? (
          <div className="mx-loading-placeholder">
            <div className="mx-spinner"></div>
            <p>Preparando cartografía...</p>
          </div>
        ) : (
          <MapContainer 
            key={`${isFullscreen}-${mapType}`}
            center={centerPosition} 
            zoom={zoom} 
            scrollWheelZoom={true}
            style={{ height: isFullscreen ? 'calc(100vh - 100px)' : '650px', width: '100%', borderRadius: '12px', background: '#f8fafc' }}
            ref={setMapInstance}
          >
            <TileLayer
              attribution={mapType === 'street' ? '&copy; OpenStreetMap' : 'Tiles &copy; Esri'}
              url={MAP_LAYERS[mapType]}
              maxZoom={mapType === 'satellite' ? 18 : 19}
            />
            <InvalidateSize trigger={isFullscreen} />
            <ZoomHandler setZoom={setZoom} />
            
            {mapCentros.map(centro => {
              // Si hay un filtro activo, forzamos ese color para evitar confusión
              let especieKey = activeSpecies !== 'all' ? activeSpecies : null;
              
              if (!especieKey) {
                especieKey = Object.keys(SPECIES_CONFIG).find(k => 
                  SPECIES_CONFIG[k].keys.some(key => 
                    (centro.grupoEspecie || '').toLowerCase().includes(key) || 
                    (centro.especies || []).some(e => e.toLowerCase().includes(key))
                  )
                ) || 'mitilidos';
              }
              
              const color = SPECIES_CONFIG[especieKey]?.color || '#6366f1';

              return (
                <Polygon
                  key={centro._id}
                  positions={centro.coords.map(p => [p.lat, p.lng])}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: mapType === 'satellite' ? 0.2 : 0.4,
                    weight: 2
                  }}
                  eventHandlers={{
                    click: () => setSelectedCentro(centro)
                  }}
                >
                  <Tooltip 
                    key={`tooltip-${centro._id}-${zoom > 10}`}
                    permanent={zoom > 10} 
                    direction="center" 
                    className="map-tooltip-custom"
                  >
                    <div className="tooltip-inner">
                      <div className="tooltip-code">{centro.code}</div>
                      {zoom > 13 && <div className="tooltip-provider">{centro.proveedor}</div>}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="map-popup-content">
                      <h4 style={{ margin: '0 0 4px 0', color: color }}>{centro.proveedor}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>
                        <strong>Código:</strong> {centro.code}<br />
                        <strong>Hectáreas:</strong> {centro.hectareas} ha
                      </p>
                      <button 
                        className="mx-btn mx-btn-primary sm am-mt-8" 
                        style={{ width: '100%', padding: '4px' }}
                        onClick={() => setSelectedCentro(centro)}
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* MODAL DE DETALLES */}
      {selectedCentro && (
        <div className="mx-modal-overlay" style={{ zIndex: 100000 }}>
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-head">
              <div>
                <h3 className="mx-modal-title">{selectedCentro.proveedor}</h3>
                <p className="mx-modal-sub">Centro de Cultivo {selectedCentro.code}</p>
              </div>
              <button className="mx-btn-icon" onClick={() => setSelectedCentro(null)}><X size={20} /></button>
            </div>
            <div className="mx-modal-body">
              <div className="centros-detail-grid">
                <div className="detail-item">
                  <label>Comuna</label>
                  <span>{selectedCentro.comuna}</span>
                </div>
                <div className="detail-item">
                  <label>Región</label>
                  <span>{selectedCentro.region || 'X Región'}</span>
                </div>
                <div className="detail-item">
                  <label>Hectáreas</label>
                  <span>{selectedCentro.hectareas} ha</span>
                </div>
                <div className="detail-item">
                  <label>Estado Sernapesca</label>
                  <span className={`mx-badge ${selectedCentro.estadoAreaSernapesca === 'Abierta' ? 'mx-badge-success' : 'mx-badge-muted'}`}>
                    {selectedCentro.estadoAreaSernapesca || 'N/A'}
                  </span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <label>Especies Autorizadas</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(selectedCentro.especies || [selectedCentro.grupoEspecie]).map(e => (
                      <span key={e} className="mx-badge mx-badge-info">{e}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-modal-foot">
              <button className="mx-btn mx-btn-primary" style={{ width: '100%' }} onClick={() => setSelectedCentro(null)}>
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



