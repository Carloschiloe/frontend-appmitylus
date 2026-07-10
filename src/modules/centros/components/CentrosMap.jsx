import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Maximize, Minimize, Ruler, Search, Trash2, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
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
const CLOSED_COLOR = '#ef4444';
const INACTIVE_COLOR = '#a855f7';
const SUSPENDED_COLOR = '#f97316';

const SANITARIO_STATUS_CONFIG = {
  rojo:     { label: 'Bloqueada',   badge: 'mx-badge-danger'  },
  naranja:  { label: 'Alerta',      badge: 'mx-badge-warning' },
  amarillo: { label: 'Observación', badge: 'mx-badge-warning' },
  verde:    { label: 'OK',          badge: 'mx-badge-success' },
  gris:     { label: 'Sin datos',   badge: 'mx-badge-muted'   },
};

function getPolygonColor(centro, isHarvestActive) {
  if (isHarvestActive) return HARVEST_COLOR;
  const estado = String(centro.estadoAreaSernapesca || '').toLowerCase();
  if (estado === 'eliminada') return CLOSED_COLOR;
  if (estado === 'inactiva') return INACTIVE_COLOR;
  if (estado === 'suspendida') return SUSPENDED_COLOR;
  return CONCESSION_COLOR;
}
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
  isFocused,
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
        color: isFocused ? '#38bdf8' : color,
        fillColor: isFocused ? '#38bdf8' : color,
        fillOpacity: isFocused ? 0.48 : (isHarvestActive ? 0.34 : 0.22),
        weight: isFocused ? 5 : (isHarvestActive ? 3 : 2),
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
      {showLabel ? (
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
      ) : (
        <Tooltip sticky className="map-tooltip-hover">
          <div className="tooltip-inner">
            <div className="tooltip-code">{centro.code}</div>
            <div className="tooltip-provider">{centro.proveedor}</div>
            {centro.estadoAreaSernapesca && (
              <div className="tooltip-estado">{centro.estadoAreaSernapesca}</div>
            )}
            {centro.hectareas != null && (
              <div className="tooltip-meta">{centro.hectareas} ha</div>
            )}
          </div>
        </Tooltip>
      )}
    </Polygon>
  );
});

export default function CentrosMap() {
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [concessionFilter, setConcessionFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [labelLevel, setLabelLevel] = useState('media');
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState(null);
  const [focusedCentroCode, setFocusedCentroCode] = useState('');
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

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      const sidebar = document.querySelector('.mx-sidebar');
      if (sidebar) sidebar.style.display = active ? 'none' : 'flex';
      document.body.style.overflow = active ? 'hidden' : '';
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      const sidebar = document.querySelector('.mx-sidebar');
      if (sidebar) sidebar.style.display = 'flex';
      document.body.style.overflow = '';
    };
  }, []);

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
    const query = deferredSearchTerm.trim().toLowerCase();
    if (query.length < 2) return [];
    return allowedCentros.filter((centro) =>
      centro.code?.toLowerCase().includes(query) ||
      centro.proveedor?.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [allowedCentros, deferredSearchTerm]);

  const handleSelectSuggestion = useCallback((centro) => {
    setSearchTerm(centro.code || centro.proveedor || '');
    setFocusedCentroCode(normalizeText(centro.code));
    setSelectedCentro(null);
    if (mapInstance && centro.coords?.length > 0) {
      const targetLat = centro.centerLat ?? centro.coords[0].lat;
      const targetLng = centro.centerLng ?? centro.coords[0].lng;
      mapInstance.flyTo([targetLat, targetLng], 16, { duration: 0.8 });
    }
  }, [mapInstance]);

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
    if (!target) return;

    if (mapInstance && target.coords?.length > 0) {
      setFocusedCentroCode(target.codeNorm);
      const targetLat = target.centerLat ?? target.coords[0].lat;
      const targetLng = target.centerLng ?? target.coords[0].lng;
      mapInstance.flyTo([targetLat, targetLng], 16, { duration: 0.8 });
      setSearchParams({}, { replace: true });
    }
  }, [allowedCentros, mapInstance, selectedCentroCode, setSearchParams]);

  const estadoCounts = useMemo(() => {
    const counts = { inactiva: 0, eliminada: 0, abierta: 0 };
    for (const c of allowedCentros) {
      const e = String(c.estadoAreaSernapesca || '').toLowerCase();
      if (e === 'inactiva') counts.inactiva++;
      else if (e === 'eliminada') counts.eliminada++;
      else counts.abierta++;
    }
    return counts;
  }, [allowedCentros]);

  const mapCentros = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
    const effectiveQuery = query.length >= 2 ? query : '';
    return allowedCentros.filter((centro) => {
      const matchesSearch = !effectiveQuery ||
        centro.code?.toLowerCase().includes(query) ||
        centro.proveedor?.toLowerCase().includes(query);

      const inHarvest = harvestKeys.codes.has(centro.codeNorm)
        || harvestKeys.providers.has(centro.proveedorNorm);
      const matchesHarvest = concessionFilter === 'all' || inHarvest;

      const estadoVal = String(centro.estadoAreaSernapesca || '').toLowerCase();
      const matchesEstado = estadoFilter === 'all' ||
        (estadoFilter === 'abierta' ? (!estadoVal || estadoVal === 'abierta') : estadoVal === estadoFilter);

      const inViewport = effectiveQuery || !viewportBounds || (
        centro.centerLat >= viewportBounds.south &&
        centro.centerLat <= viewportBounds.north &&
        centro.centerLng >= viewportBounds.west &&
        centro.centerLng <= viewportBounds.east
      );

      return matchesSearch && matchesHarvest && matchesEstado && inViewport;
    });
  }, [allowedCentros, deferredSearchTerm, concessionFilter, estadoFilter, harvestKeys, viewportBounds]);

  const centerPosition = [-42.5, -73.5];

  const harvestCount = useMemo(() =>
    mapCentros.filter((c) => harvestKeys.codes.has(c.codeNorm) || harvestKeys.providers.has(c.proveedorNorm)).length,
    [mapCentros, harvestKeys]
  );

  return (
    <div className={`centros-map-container ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="map-toolbar">
        <div className="map-toolbar-left">
          <div className="centros-search-wrap map-search" style={{ position: 'relative' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar código o proveedor..."
              className="centros-search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setFocusedCentroCode('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchSuggestions[0]) {
                  handleSelectSuggestion(searchSuggestions[0]);
                }
              }}
            />
            {searchTerm && (
              <button
                type="button"
                className="map-search-clear"
                onClick={() => { setSearchTerm(''); setFocusedCentroCode(''); }}
                title="Limpiar búsqueda"
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
              {harvestCount > 0 && <span className="map-harvest-badge">{harvestCount}</span>}
            </button>
          </div>

          {!loading && selectedTenantDb && (
            <div className="map-count-inline">
              <span className="map-count-num">{mapCentros.length.toLocaleString('es-CL')}</span>
              <span className="map-count-of">de {allowedCentros.length.toLocaleString('es-CL')} centros</span>
            </div>
          )}
        </div>

        <div className="map-toolbar-right">
          <div className="map-density-group">
            <span className="map-density-label">Etiquetas</span>
            <div className="mx-toggle-group">
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
          </div>

          <div className="map-action-group">
            <button
              className={`mx-btn-icon ${isMeasuring ? 'map-btn-active' : ''}`}
              onClick={handleToggleMeasure}
              title="Medir distancia"
            >
              <Ruler size={16} />
            </button>
            {measurePoints.length > 0 && (
              <button
                className="mx-btn-icon"
                onClick={() => setMeasurePoints([])}
                title="Limpiar medición"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              className="mx-btn-icon"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>

      {!loading && selectedTenantDb && (
        <div className="map-filter-bar">
          <span className="map-filter-bar-label">Estado área</span>
          {[
            { key: 'abierta',   label: 'Abierta',   color: CONCESSION_COLOR, count: estadoCounts.abierta },
            { key: 'inactiva',  label: 'Inactiva',  color: INACTIVE_COLOR,   count: estadoCounts.inactiva },
            { key: 'eliminada', label: 'Eliminada', color: CLOSED_COLOR,     count: estadoCounts.eliminada },
          ].filter(e => e.count > 0).map(({ key, label, color, count }) => (
            <button
              key={key}
              className={`map-estado-chip ${estadoFilter === key ? 'active' : ''}`}
              style={estadoFilter === key ? { borderColor: color, background: `${color}18`, color: 'var(--color-text-primary)' } : {}}
              onClick={() => setEstadoFilter(estadoFilter === key ? 'all' : key)}
              title={`Filtrar: solo áreas ${label}s`}
            >
              <span className="map-estado-dot" style={{ background: color }} />
              {label}
              <span className="map-chip-count" style={{ background: color }}>{count.toLocaleString('es-CL')}</span>
            </button>
          ))}
          {estadoFilter !== 'all' && (
            <button className="map-filter-clear" onClick={() => setEstadoFilter('all')} title="Quitar filtro de estado">
              <X size={11} /> Limpiar
            </button>
          )}
        </div>
      )}

      {isMeasuring && (
        <div className="map-measure-banner">
          <Ruler size={13} />
          <span>Modo medición — haz clic en el mapa para trazar puntos</span>
          {measurePoints.length > 1 && (
            <strong className="map-measure-total">{formatMeters(measuredDistance)}</strong>
          )}
          <button type="button" className="map-measure-exit" onClick={handleToggleMeasure}>
            <X size={13} /> Salir
          </button>
        </div>
      )}

      <div className="map-frame">
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
            center={centerPosition}
            zoom={zoom}
            preferCanvas
            scrollWheelZoom
            style={{
              height: isFullscreen ? '100vh' : 'calc(100vh - 160px)',
              minHeight: '400px',
              width: '100%',
              borderRadius: isFullscreen ? '0' : '12px',
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
              const color = getPolygonColor(centro, isHarvestActive);

              return (
                <CentroPolygon
                  key={centro._id}
                  centro={centro}
                  color={color}
                  labelLevel={labelLevel}
                  zoom={zoom}
                  isHarvestActive={isHarvestActive}
                  isFocused={focusedCentroCode === centro.codeNorm}
                  isMeasuring={isMeasuring}
                  onSelect={handleSelectCentro}
                  onMeasurePoint={handleAddMeasurePoint}
                />
              );
            })}
          </MapContainer>
        )}

        <div className="map-legend">
          <span className="map-legend-item">
            <span className="map-legend-dot" style={{ background: CONCESSION_COLOR }}></span>
            Abierta
          </span>
          <span className="map-legend-item">
            <span className="map-legend-dot" style={{ background: HARVEST_COLOR }}></span>
            En cosecha
          </span>
          <span className="map-legend-item">
            <span className="map-legend-dot" style={{ background: INACTIVE_COLOR }}></span>
            Inactiva
          </span>
          <span className="map-legend-item">
            <span className="map-legend-dot" style={{ background: CLOSED_COLOR }}></span>
            Eliminada
          </span>
          {focusedCentroCode && (
            <span className="map-legend-item">
              <span className="map-legend-dot" style={{ background: '#38bdf8' }}></span>
              Seleccionado
            </span>
          )}
        </div>
      </div>

      {selectedCentro && (
        <>
          <div className="map-panel-backdrop" onClick={() => setSelectedCentro(null)} />
          <div className="map-detail-panel">
            <div className="map-panel-header">
              <div className="map-panel-title">
                <div className="map-panel-code">{selectedCentro.code}</div>
                <div className="map-panel-provider">{selectedCentro.proveedor}</div>
                <span className={`mx-badge mx-badge-${
                  selectedCentro.estadoAreaSernapesca === 'Abierta' ? 'success' :
                  selectedCentro.estadoAreaSernapesca === 'Inactiva' ? 'purple' :
                  selectedCentro.estadoAreaSernapesca === 'Eliminada' ? 'danger' : 'muted'
                }`} style={{ marginTop: '4px', display: 'inline-flex' }}>
                  {selectedCentro.estadoAreaSernapesca || 'Desconocido'}
                </span>
              </div>
              <button type="button" className="mx-btn-icon" onClick={() => setSelectedCentro(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="map-panel-body">
              <div className="map-panel-section">
                <div className="map-panel-row">
                  <span className="map-panel-label">Código</span>
                  <span className="map-panel-value"><code className="ct-code">{selectedCentro.code || '—'}</code></span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Proveedor</span>
                  <span className="map-panel-value">{selectedCentro.proveedor || '—'}</span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Comuna</span>
                  <span className="map-panel-value">{selectedCentro.comuna || '—'}</span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Región</span>
                  <span className="map-panel-value">{selectedCentro.region || '—'}</span>
                </div>
              </div>
              <div className="map-panel-divider" />
              <div className="map-panel-section">
                <div className="map-panel-row">
                  <span className="map-panel-label">Área PSMB</span>
                  <span className="map-panel-value">{selectedCentro.areaPSMB || '—'}</span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Código área</span>
                  <span className="map-panel-value">{selectedCentro.codigoArea || '—'}</span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Estado Sanitario</span>
                  {(() => {
                    const sanitario = selectedCentro.sanitario;
                    const estado = sanitario?.estado || 'gris';
                    if (!sanitario || estado === 'gris') {
                      return <span className="mx-badge mx-badge-muted">Sin muestreo sanitario</span>;
                    }
                    if (estado === 'verde') {
                      return <span className="mx-badge mx-badge-success">OK</span>;
                    }
                    const detalle = sanitario.detalle || [];
                    if (detalle.length) {
                      return (
                        <span className={`mx-badge ${SANITARIO_STATUS_CONFIG[estado]?.badge || 'mx-badge-warning'}`} title={detalle.map(d => `${d.tipoAnalisis}: ${d.glosaResultado || d.agenteCausal || 'Positivo'}`).join(' · ')}>
                          {detalle.map(d => d.glosaResultado || d.tipoAnalisis || d.agenteCausal || 'Positivo').join(' · ')}
                        </span>
                      );
                    }
                    return (
                      <span className={`mx-badge ${SANITARIO_STATUS_CONFIG[estado]?.badge || 'mx-badge-muted'}`}>
                        {SANITARIO_STATUS_CONFIG[estado]?.label || 'Sin datos'}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="map-panel-divider" />
              <div className="map-panel-section">
                <div className="map-panel-row">
                  <span className="map-panel-label">Hectáreas</span>
                  <span className="map-panel-value">{selectedCentro.hectareas != null ? `${selectedCentro.hectareas} ha` : '—'}</span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Tons máx</span>
                  <span className="map-panel-value">{selectedCentro.tonsMax != null ? `${selectedCentro.tonsMax} t` : '—'}</span>
                </div>
                <div className="map-panel-row">
                  <span className="map-panel-label">Grupo especie</span>
                  <span className="map-panel-value">{selectedCentro.grupoEspecie || '—'}</span>
                </div>
                {selectedCentro.nroPermiso && (
                  <div className="map-panel-row">
                    <span className="map-panel-label">Nro permiso</span>
                    <span className="map-panel-value">{selectedCentro.nroPermiso}</span>
                  </div>
                )}
              </div>
              {(selectedCentro.especies?.length > 0 || selectedCentro.grupoEspecie) && (
                <>
                  <div className="map-panel-divider" />
                  <div className="map-panel-section">
                    <div className="map-panel-label" style={{ marginBottom: '6px' }}>Especies autorizadas</div>
                    <div className="map-panel-badges">
                      {(selectedCentro.especies || [selectedCentro.grupoEspecie]).filter(Boolean).map((especie) => (
                        <span key={especie} className="mx-badge mx-badge-info">{especie}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="map-panel-footer">
              <button
                type="button"
                className="mx-btn mx-btn-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  setSelectedCentro(null);
                  navigate(`/centros/directorio?proveedor=${encodeURIComponent(selectedCentro.proveedorKey || selectedCentro.proveedor || '')}`);
                }}
              >
                Ver en Directorio
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
