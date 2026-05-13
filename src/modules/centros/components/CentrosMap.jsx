import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Maximize, Ruler, Search, Trash2, X } from 'lucide-react';
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { getCentrosMapa } from '../../../api/api-centros';
import { apiClient } from '../../../api/apiClient';

const CONCESSION_COLOR = '#22c55e';
const HARVEST_COLOR = '#f59e0b';
const SATELLITE_LAYER = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const ALLOWED_SPECIES_KEYS = [
  'mitilido',
  'mitilidos',
  'mitílido',
  'chorito',
  'mejillon',
  'mejillón',
  'molusco',
  'alga',
  'huiro',
  'pelillo',
  'luga',
];

const EXCLUDED_SPECIES_KEYS = ['salmon', 'salmón', 'salmonido', 'salmónido', 'trucha'];

const LABEL_CONFIG = {
  alta: { label: 'Alta', showZoom: 10, providerZoom: 13 },
  media: { label: 'Media', showZoom: 12, providerZoom: 14 },
  baja: { label: 'Baja', showZoom: 14, providerZoom: 99 },
};

function InvalidateSize({ trigger }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map, trigger]);

  useEffect(() => {
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  return null;
}

function getCentroText(centro) {
  return [
    centro.grupoEspecie,
    ...(Array.isArray(centro.especies) ? centro.especies : []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isAllowedConcession(centro) {
  const text = getCentroText(centro);
  if (!text) return true;
  if (EXCLUDED_SPECIES_KEYS.some((key) => text.includes(key))) return false;
  return ALLOWED_SPECIES_KEYS.some((key) => text.includes(key));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date = new Date()) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isProgramActiveThisWeek(program) {
  const from = program?.vigenciaDesde ? new Date(program.vigenciaDesde) : null;
  const to = program?.vigenciaHasta ? new Date(program.vigenciaHasta) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  return from <= weekEnd && to >= weekStart;
}

function distanceMeters(a, b) {
  const radius = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatMeters(meters) {
  return `${Math.round(meters || 0).toLocaleString('es-CL')} m`;
}

function MapViewportHandler({ onViewportChange, setZoom }) {
  const map = useMapEvents({
    moveend: () => {
      onViewportChange(map.getBounds().pad(0.35));
    },
    zoomend: () => {
      setZoom(map.getZoom());
      onViewportChange(map.getBounds().pad(0.35));
    },
  });

  useEffect(() => {
    setZoom(map.getZoom());
    onViewportChange(map.getBounds().pad(0.35));
  }, [map, onViewportChange, setZoom]);

  return null;
}

function MeasureLayer({ enabled, points, onAddPoint }) {
  useMapEvents({
    click: (event) => {
      if (!enabled) return;
      onAddPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  if (!points.length) return null;

  const positions = points.map((point) => [point.lat, point.lng]);
  const segmentMeters = points.map((point, index) => {
    if (index === 0) return 0;
    return distanceMeters(points[index - 1], point);
  });

  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: '#f97316', weight: 3, dashArray: '6 6' }} />
      {points.map((point, index) => (
        <CircleMarker
          key={`${point.lat}-${point.lng}-${index}`}
          center={[point.lat, point.lng]}
          radius={5}
          pathOptions={{ color: '#f97316', fillColor: '#fff7ed', fillOpacity: 1, weight: 2 }}
        >
          {index > 0 && (
            <Tooltip permanent direction="top" offset={[0, -8]} className="map-measure-tooltip">
              {formatMeters(segmentMeters[index])}
            </Tooltip>
          )}
        </CircleMarker>
      ))}
    </>
  );
}

const CentroPolygon = memo(function CentroPolygon({
  centro,
  color,
  labelLevel,
  zoom,
  isHarvestActive,
  isMeasuring,
  onSelect,
  onMeasurePoint,
}) {
  const labelSettings = LABEL_CONFIG[labelLevel] || LABEL_CONFIG.media;
  const showLabel = zoom >= labelSettings.showZoom;
  const showProvider = zoom >= labelSettings.providerZoom;

  return (
    <Polygon
      positions={centro.coordsPositions}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: isHarvestActive ? 0.34 : 0.22,
        weight: isHarvestActive ? 3 : 2,
      }}
      eventHandlers={{
        click: (event) => {
          if (isMeasuring) {
            if (event.originalEvent) {
              event.originalEvent._stopped = true;
              event.originalEvent.stopPropagation?.();
            }
            onMeasurePoint({ lat: event.latlng.lat, lng: event.latlng.lng });
            return;
          }
          onSelect(centro);
        },
      }}
    >
      {showLabel && (
        <Tooltip
          key={`tooltip-${centro._id}-${labelLevel}-${showProvider}`}
          permanent
          direction="center"
          className={`map-tooltip-custom label-${labelLevel}`}
        >
          <div className="tooltip-inner">
            <div className="tooltip-code">{centro.code}</div>
            {showProvider && <div className="tooltip-provider">{centro.proveedor}</div>}
          </div>
        </Tooltip>
      )}
      {!isMeasuring && (
      <Popup>
        <div className="map-popup-content">
          <h4 style={{ margin: '0 0 4px 0', color }}>{centro.proveedor}</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            <strong>Codigo:</strong> {centro.code}<br />
            <strong>Hectareas:</strong> {centro.hectareas} ha<br />
            <strong>Cosecha:</strong> {isHarvestActive ? 'Activa esta semana' : 'Sin programa activo'}
          </p>
          <button
            className="mx-btn mx-btn-primary sm am-mt-8"
            style={{ width: '100%', padding: '4px' }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(centro);
            }}
          >
            Ver Detalle
          </button>
        </div>
      </Popup>
      )}
    </Polygon>
  );
});

export default function CentrosMap() {
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [concessionFilter, setConcessionFilter] = useState('all');
  const [labelLevel, setLabelLevel] = useState('media');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState(null);
  const [zoom, setZoom] = useState(9);
  const [mapInstance, setMapInstance] = useState(null);
  const [viewportBounds, setViewportBounds] = useState(null);
  const selectedCentroCode = searchParams.get('centro') || '';

  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['centros', 'mapa'],
    queryFn: ({ signal }) => getCentrosMapa({ signal }),
    enabled: Boolean(selectedTenantDb),
    staleTime: 5 * 60_000,
  });

  const { data: programasRes = { items: [] } } = useQuery({
    queryKey: ['programa-cosecha', 'mapa-centros'],
    queryFn: ({ signal }) => apiClient.get('/programa-cosecha?estado=activo', { signal }),
    enabled: Boolean(selectedTenantDb),
    staleTime: 60_000,
  });

  const harvestKeys = useMemo(() => {
    const programas = Array.isArray(programasRes?.items) ? programasRes.items : [];
    const activePrograms = programas.filter(isProgramActiveThisWeek);
    return {
      codes: new Set(activePrograms.map((program) => normalizeText(program.centroCodigo)).filter(Boolean)),
      providers: new Set(activePrograms.map((program) => normalizeText(program.proveedorNombre)).filter(Boolean)),
    };
  }, [programasRes]);

  const measuredDistance = useMemo(() => {
    return measurePoints.reduce((total, point, index) => {
      if (index === 0) return total;
      return total + distanceMeters(measurePoints[index - 1], point);
    }, 0);
  }, [measurePoints]);

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

  const allowedCentros = useMemo(() => {
    return data.map((centro) => {
      const coords = Array.isArray(centro.coords) ? centro.coords : [];
      const latSum = coords.reduce((sum, point) => sum + Number(point.lat || 0), 0);
      const lngSum = coords.reduce((sum, point) => sum + Number(point.lng || 0), 0);
      return {
        ...centro,
        coords,
        coordsPositions: coords.map((point) => [point.lat, point.lng]),
        centerLat: coords.length ? latSum / coords.length : null,
        centerLng: coords.length ? lngSum / coords.length : null,
        codeNorm: normalizeText(centro.code),
        proveedorNorm: normalizeText(centro.proveedor),
      };
    }).filter((centro) => {
      const hasCoords = Array.isArray(centro.coords) && centro.coords.length >= 3;
      return hasCoords && isAllowedConcession(centro);
    });
  }, [data]);

  const handleViewportChange = useCallback((bounds) => {
    setViewportBounds({
      south: bounds.getSouth(),
      north: bounds.getNorth(),
      west: bounds.getWest(),
      east: bounds.getEast(),
    });
  }, []);

  const searchSuggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const query = searchTerm.toLowerCase();
    return allowedCentros.filter((centro) =>
      centro.code?.toLowerCase().includes(query) ||
      centro.proveedor?.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [allowedCentros, searchTerm]);

  const handleSelectSuggestion = useCallback((centro) => {
    setSearchTerm('');
    setSelectedCentro(centro);
    setSearchParams({ centro: centro.code }, { replace: true });
    if (mapInstance && centro.coords?.length > 0) {
      const firstCoord = [centro.coords[0].lat, centro.coords[0].lng];
      mapInstance.flyTo(firstCoord, 16, { duration: 0.8 });
    }
  }, [mapInstance, setSearchParams]);

  const handleToggleMeasure = useCallback(() => {
    setIsMeasuring((value) => !value);
    setMeasurePoints([]);
  }, []);

  const handleAddMeasurePoint = useCallback((point) => {
    setMeasurePoints((points) => [...points, point]);
  }, []);

  const handleSelectCentro = useCallback((centro) => {
    if (isMeasuring) return;
    setSelectedCentro(centro);
  }, [isMeasuring]);

  useEffect(() => {
    const centroCode = String(selectedCentroCode || '').trim().toUpperCase();
    if (!centroCode || !allowedCentros.length) return;

    const target = allowedCentros.find((centro) => String(centro.code || '').trim().toUpperCase() === centroCode);
    if (!target) {
      return;
    }

    if (mapInstance && target.coords?.length > 0) {
      const firstCoord = [target.coords[0].lat, target.coords[0].lng];
      mapInstance.flyTo(firstCoord, 16, { duration: 0.8 });
      setSearchParams({}, { replace: true });
    }
  }, [allowedCentros, mapInstance, selectedCentroCode, setSearchParams]);

  const mapCentros = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return allowedCentros.filter((centro) => {
      const matchesSearch = !query ||
        centro.code?.toLowerCase().includes(query) ||
        centro.proveedor?.toLowerCase().includes(query);

      const inHarvest = harvestKeys.codes.has(centro.codeNorm)
        || harvestKeys.providers.has(centro.proveedorNorm);
      const matchesHarvest = concessionFilter === 'all' || inHarvest;
      const inViewport = query || !viewportBounds || (
        centro.centerLat >= viewportBounds.south &&
        centro.centerLat <= viewportBounds.north &&
        centro.centerLng >= viewportBounds.west &&
        centro.centerLng <= viewportBounds.east
      );

      return matchesSearch && matchesHarvest && inViewport;
    });
  }, [allowedCentros, searchTerm, concessionFilter, harvestKeys, viewportBounds]);

  const centerPosition = [-42.5, -73.5];

  return (
    <div className={`centros-map-container ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="map-toolbar">
        <div className="centros-search-wrap map-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar codigo o proveedor..."
            className="centros-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="map-search-clear"
              onClick={() => setSearchTerm('')}
              title="Limpiar busqueda"
            >
              <X size={14} />
            </button>
          )}
          {searchSuggestions.length > 0 && (
            <div className="mx-search-dropdown">
              {searchSuggestions.map((centro) => (
                <div
                  key={centro._id}
                  className="mx-search-item"
                  onClick={() => handleSelectSuggestion(centro)}
                >
                  <div className="search-item-main">{centro.code}</div>
                  <div className="search-item-sub">{centro.proveedor}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-toggle-group">
          <button
            className={`mx-toggle-btn ${concessionFilter === 'all' ? 'active' : ''}`}
            onClick={() => setConcessionFilter('all')}
          >
            Todas
          </button>
          <button
            className={`mx-toggle-btn ${concessionFilter === 'harvest' ? 'active' : ''}`}
            onClick={() => setConcessionFilter('harvest')}
          >
            En Cosecha
          </button>
        </div>

        <div className="map-toolbar-spacer" />

        <div className="mx-toggle-group label-toggle" aria-label="Nivel de etiquetas">
          {Object.entries(LABEL_CONFIG).map(([id, cfg]) => (
            <button
              key={id}
              className={`mx-toggle-btn ${labelLevel === id ? 'active' : ''}`}
              onClick={() => setLabelLevel(id)}
              title={`Etiquetas ${cfg.label.toLowerCase()}`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <button
          className={`mx-btn mx-btn-outline map-icon-btn ${isMeasuring ? 'active' : ''}`}
          onClick={handleToggleMeasure}
          title="Medir distancia"
        >
          <Ruler size={18} />
        </button>

        {measurePoints.length > 0 && (
          <button
            className="mx-btn mx-btn-outline map-icon-btn"
            onClick={() => setMeasurePoints([])}
            title="Limpiar medicion"
          >
            <Trash2 size={16} />
          </button>
        )}

        <button className="mx-btn mx-btn-outline map-fullscreen-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <X size={18} /> : <Maximize size={18} />}
          {isFullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      <div className="map-frame">
        {!selectedTenantDb ? (
          <div className="mx-loading-placeholder">
            <p>Selecciona una empresa para ver el mapa de centros.</p>
          </div>
        ) : loading ? (
          <div className="mx-loading-placeholder">
            <div className="mx-spinner"></div>
            <p>Preparando cartografia...</p>
          </div>
        ) : (
          <MapContainer
            center={centerPosition}
            zoom={zoom}
            preferCanvas
            scrollWheelZoom
            style={{
              height: isFullscreen ? 'calc(100vh - 100px)' : '650px',
              width: '100%',
              borderRadius: '12px',
              background: '#0f172a',
            }}
            ref={setMapInstance}
          >
            <TileLayer attribution="Tiles &copy; Esri" url={SATELLITE_LAYER} maxZoom={18} />
            <InvalidateSize trigger={isFullscreen} />
            <MapViewportHandler onViewportChange={handleViewportChange} setZoom={setZoom} />
            <MeasureLayer enabled={isMeasuring} points={measurePoints} onAddPoint={handleAddMeasurePoint} />

            {mapCentros.map((centro) => {
              const isHarvestActive = harvestKeys.codes.has(centro.codeNorm)
                || harvestKeys.providers.has(centro.proveedorNorm);
              const color = isHarvestActive ? HARVEST_COLOR : CONCESSION_COLOR;

              return (
                <CentroPolygon
                  key={centro._id}
                  centro={centro}
                  color={color}
                  labelLevel={labelLevel}
                  zoom={zoom}
                  isHarvestActive={isHarvestActive}
                  isMeasuring={isMeasuring}
                  onSelect={handleSelectCentro}
                  onMeasurePoint={handleAddMeasurePoint}
                />
              );
            })}
          </MapContainer>
        )}

        {isMeasuring && (
          <div className="map-measure-panel">
            <strong>Medicion activa</strong>
            <span>Haz clic en el mapa para trazar puntos.</span>
            <b>{formatMeters(measuredDistance)}</b>
          </div>
        )}

        {!loading && selectedTenantDb && (
          <div className="map-count-chip">
            {mapCentros.length.toLocaleString('es-CL')} visibles de {allowedCentros.length.toLocaleString('es-CL')}
          </div>
        )}
      </div>

      {selectedCentro && (
        <div className="mx-modal-overlay" style={{ zIndex: 100000 }}>
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-header">
              <div>
                <h2>{selectedCentro.proveedor}</h2>
                <p className="mx-modal-sub" style={{ margin: 0, color: 'var(--color-text-muted)' }}>Centro de Cultivo {selectedCentro.code}</p>
              </div>
              <button type="button" className="mx-btn-icon" onClick={() => setSelectedCentro(null)}><X size={20} /></button>
            </div>
            <div className="mx-modal-body">
              <div className="centros-detail-grid">
                <div className="detail-item">
                  <label>Codigo centro</label>
                  <span>{selectedCentro.code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Proveedor</label>
                  <span>{selectedCentro.proveedor || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Comuna</label>
                  <span>{selectedCentro.comuna || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Region</label>
                  <span>{selectedCentro.region || 'X Region'}</span>
                </div>
                <div className="detail-item">
                  <label>Hectareas</label>
                  <span>{selectedCentro.hectareas != null ? `${selectedCentro.hectareas} ha` : 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Tons max</label>
                  <span>{selectedCentro.tonsMax != null ? `${selectedCentro.tonsMax} t` : 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Estado Sernapesca</label>
                  <span className={`mx-badge ${selectedCentro.estadoAreaSernapesca === 'Abierta' ? 'mx-badge-success' : 'mx-badge-muted'}`}>
                    {selectedCentro.estadoAreaSernapesca || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Area PSMB</label>
                  <span>{selectedCentro.areaPSMB || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Codigo area</label>
                  <span>{selectedCentro.codigoArea || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Grupo especie</label>
                  <span>{selectedCentro.grupoEspecie || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Nro permiso</label>
                  <span>{selectedCentro.nroPermiso || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>RUT</label>
                  <span>{selectedCentro.rut || 'N/A'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <label>Especies Autorizadas</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(selectedCentro.especies || [selectedCentro.grupoEspecie]).map((especie) => (
                      <span key={especie} className="mx-badge mx-badge-info">{especie}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-modal-footer">
              <button type="button" className="mx-btn mx-btn-primary" style={{ width: '100%' }} onClick={() => setSelectedCentro(null)}>
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
