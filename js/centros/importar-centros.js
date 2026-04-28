// js/centros/importar-centros.js
import { bulkUpsertCentros } from '../core/centros-repo.js';
import { toast } from '../ui/toast.js';

export async function syncSubpesca() {
  const r = await fetch('/api/centros/sync-subpesca', { method: 'POST' });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error || r.statusText);
  return json;
}

function notifyCentrosUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('mmpp:centros-updated'));
  } catch {}
}

/* ========= Helpers ========= */
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function makeProveedorKey(name) {
  if (!name) return '';
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

// Normaliza nombres de columnas: minúsculas, sin tildes, sin saltos ni dobles espacios
function normKey(k) {
  return String(k)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // sin tildes
    .toLowerCase()
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAPEO_CAMPOS = {
  'proveedor':      'proveedor',
  'comuna':         'comuna',
  'codigo centro':  'code',
  'hectareas':      'hectareas',
  'codigo area':    'codigoArea',
  'region':         'region',
  'ubicacion':      'ubicacion',
  'grupo especie':  'grupoEspecie',
  'tons max':       'tonsMax',
  // Nombre geográfico del área PSMB
  'area psmb':      'areaPSMB',
  'nombre area':    'areaPSMB',
  'area':           'areaPSMB',
  // RUT del titular
  'rut':            'rut',
  'rut titular':    'rut',
  'rut proveedor':  'rut',
  // Número de permiso / resolución
  'nropert':        'nroPermiso',
  'nro pert':       'nroPermiso',
  'nro permiso':    'nroPermiso',
  'numero permiso': 'nroPermiso',
  'n permiso':      'nroPermiso',
};

// convierte "Lat,Lon; Lat,Lon" o "Lat Lon | Lat Lon"
function parsearCoordenadasDecimales(str) {
  if (!str) return [];
  return String(str)
    .replace(/[\[\]\(\)]/g, ' ')
    .split(/[;|]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const a = pair.split(/[,\s]+/).filter(Boolean);
      if (a.length !== 2) return null;
      const lat = Number(String(a[0]).replace(',', '.'));
      const lng = Number(String(a[1]).replace(',', '.'));
      return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
    })
    .filter(Boolean);
}

function dmsToDecimal(dms) {
  if (!dms) return null;
  const re = /([NSWE])\s*(\d+)[°º]\s*(\d+)[´'\u2032]?\s*([\d.,]+)/i;
  const m = String(dms).match(re);
  if (!m) return null;
  const [, dir, deg, min, secRaw] = m;
  const sec = parseFloat(String(secRaw).replace(',', '.'));
  let dec = parseInt(deg, 10) + parseInt(min, 10) / 60 + sec / 3600;
  if (/[SW]/i.test(dir)) dec *= -1;
  return dec;
}
function parsearCoordenadasDMS(str) {
  if (!str) return [];
  return String(str)
    .split(/[;|]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(par => {
      const [latDMS, lngDMS] = par.split(',').map(x => x.trim());
      const lat = dmsToDecimal(latDMS);
      const lng = dmsToDecimal(lngDMS);
      return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
    })
    .filter(Boolean);
}

const splitList = (s) =>
  !s ? [] : String(s).split(/[;,|/]/).map(x => x.trim()).filter(Boolean);

// util para dividir en lotes
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

/* ========= UI ========= */
export function renderImportadorCentros(containerId = 'importarCentrosContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="am-card" style="padding:16px;">

      <!-- Sección 1: Actualizar desde SUBPESCA -->
      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-weight:800;color:#14532d;font-size:15px;margin-bottom:6px;">🌐 Actualizar desde SUBPESCA</div>
        <div style="font-size:12px;color:#166534;margin-bottom:12px;">
          Descarga el directorio oficial de concesiones de acuicultura de Los Lagos desde el Geoportal de SUBPESCA.<br>
          <strong>No requiere archivo.</strong> Puede tardar hasta 60 segundos.
        </div>
        <button id="btnSyncSubpesca" type="button" class="am-btn am-btn-primary" style="width:100%;font-size:14px;">
          <i class="bi bi-cloud-download"></i> Actualizar directorio desde SUBPESCA
        </button>
        <div id="resultadoSubpesca" style="margin-top:10px;font-size:13px;font-weight:600;padding:10px 12px;border-radius:8px;display:none;"></div>
      </div>

      <!-- Sección 2: Importar desde Excel -->
      <div style="border-top:1px solid #e2e8f0;padding-top:14px;">
        <div style="font-weight:800;color:#0f172a;font-size:14px;margin-bottom:4px;">📂 Importar desde Excel / CSV</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:10px;">Usa tu propio archivo. Se usa “Código Centro” como llave única.</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Archivo (.xlsx, .xls, .csv)</label>
            <input type="file" id="fileInputCentros" accept=".xlsx,.xls,.csv"
              style="width:100%;padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;"/>
          </div>
          <button id="btnImportarCentros" type="button" disabled
            style="background:#0f766e;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;opacity:0.5;">
            <i class="bi bi-upload"></i> Importar
          </button>
        </div>
        <div id="resultadoImportacion" style="margin-top:10px;font-size:13px;font-weight:600;display:none;padding:10px 12px;border-radius:8px;"></div>
        <div id="previewCentros" style="margin-top:12px;max-height:220px;overflow:auto;font-size:13px;"></div>
      </div>
    </div>
  `;

  // ── Botón SUBPESCA ──────────────────────────────────────────────────────────
  const btnSubpesca    = document.getElementById('btnSyncSubpesca');
  const resultSubpesca = document.getElementById('resultadoSubpesca');

  // Animación CSS spin
  if (!document.getElementById('_spinStyle')) {
    const s = document.createElement('style');
    s.id = '_spinStyle';
    s.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes progress-bar{from{width:0%}to{width:90%}}';
    document.head.appendChild(s);
  }

  function setSubpescaEstado(tipo, html) {
    resultSubpesca.style.display = 'block';
    const estilos = {
      info:    'background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;',
      success: 'background:#f0fdf4;color:#15803d;border:1px solid #86efac;',
      error:   'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;',
      warning: 'background:#fffbeb;color:#b45309;border:1px solid #fde68a;',
    };
    resultSubpesca.style.cssText = `margin-top:10px;font-size:13px;font-weight:600;padding:10px 12px;border-radius:8px;display:block;${estilos[tipo] || estilos.info}`;
    resultSubpesca.innerHTML = html;
  }

  let subpescaWorking = false;

  async function ejecutarSyncSubpesca() {
    if (subpescaWorking) return;
    subpescaWorking = true;

    const btn = document.getElementById('btnSyncSubpesca');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-clockwise" style="animation:spin 1s linear infinite;display:inline-block;"></i>&nbsp; Conectando con SUBPESCA...';
    }

    setSubpescaEstado('info', `
      <div style="margin-bottom:8px;font-size:13px;">⏳ Consultando Geoportal SUBPESCA — Región de Los Lagos...</div>
      <div style="background:#bae6fd;border-radius:6px;height:10px;overflow:hidden;">
        <div style="height:100%;background:#0284c7;border-radius:6px;width:0%;transition:width 55s linear;" id="subpescaBar"></div>
      </div>
      <div style="font-size:11px;color:#0369a1;margin-top:5px;">Descargando concesiones de acuicultura (puede tardar hasta 60 seg)...</div>
    `);
    // Inicia animación
    setTimeout(() => {
      const bar = document.getElementById('subpescaBar');
      if (bar) bar.style.width = '90%';
    }, 50);

    try {
      const r = await syncSubpesca();
      if (r.ok) {
        const errTxt = r.errores?.length ? ` · ${r.errores.length} comunas con error` : '';
        setSubpescaEstado('success', `
          ✅ <strong>${r.centros} centros actualizados</strong> desde SUBPESCA<br>
          <span style="font-weight:400;font-size:12px;">
            Nuevos: ${r.nuevos} &nbsp;·&nbsp; Modificados: ${r.actualizados} &nbsp;·&nbsp;
            Total fuente: ${r.totalFuente} &nbsp;·&nbsp; Mapeos área↔centro: ${r.mapaActualizado}${errTxt}
          </span>
        `);
        toast(`✅ ${r.centros} centros actualizados desde SUBPESCA`, { variant: 'success', durationMs: 6000 });
        notifyCentrosUpdated();
      } else {
        setSubpescaEstado('warning', `⚠️ ${r.mensaje || 'Sin datos obtenidos'}`);
      }
    } catch (err) {
      setSubpescaEstado('error', `❌ Error al conectar con SUBPESCA:<br><span style="font-weight:400;">${err.message}</span>`);
      toast(`Error SUBPESCA: ${err.message}`, { variant: 'error' });
    } finally {
      subpescaWorking = false;
      const btn2 = document.getElementById('btnSyncSubpesca');
      if (btn2) {
        btn2.disabled = false;
        btn2.innerHTML = '<i class="bi bi-cloud-download"></i> Actualizar directorio desde SUBPESCA';
      }
    }
  }

  // Delegación de eventos en el container (resiste rerenders del modal)
  container.addEventListener('click', (e) => {
    if (e.target.closest('#btnSyncSubpesca')) ejecutarSyncSubpesca();
  });
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('#btnSyncSubpesca')) ejecutarSyncSubpesca();
  });

  // ── Botón Excel ─────────────────────────────────────────────────────────────
  const fileInput = document.getElementById('fileInputCentros');
  const btnImportar = document.getElementById('btnImportarCentros');
  const resultadoDiv = document.getElementById('resultadoImportacion');

  let centrosData = [];

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    centrosData = await parseFileToJson(file);
    if (btnImportar) {
      btnImportar.disabled = !centrosData.length;
      btnImportar.style.opacity = centrosData.length ? '1' : '0.5';
    }
    renderPreview(centrosData);
    if (resultadoDiv) {
      resultadoDiv.style.display = centrosData.length ? 'block' : 'none';
      resultadoDiv.style.cssText = 'margin-top:10px;font-size:13px;font-weight:600;padding:10px 12px;border-radius:8px;display:block;background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;';
      resultadoDiv.textContent = centrosData.length
        ? `📂 Archivo cargado: ${centrosData.length} registros detectados. Presiona Importar.`
        : '';
    }
  });

  // ===== Importar en BULK por lotes =====
  btnImportar?.addEventListener('click', async () => {
    if (!centrosData.length) return;

    btnImportar.disabled = true;
    resultadoDiv.textContent = 'Preparando datos...';

    // 1) Normaliza TODAS las filas a tu esquema
    const parseFila = (fila) => {
      // normaliza headers de la fila
      const row = {};
      for (const [k, v] of Object.entries(fila)) row[normKey(k)] = v;

      const centro = {};
      const detalles = {};

      // mapeo directo de columnas conocidas
      for (const k in row) {
        if (MAPEO_CAMPOS[k]) {
          centro[MAPEO_CAMPOS[k]] = row[k];
          continue;
        }
        // saltar coordenadas y especies (los tratamos abajo)
        if (k.includes('coordenada')) continue;
        if (k === 'especies') continue;

        // saltar campos de resoluciones (se tratan abajo)
        if (k === 'numero resssp' || k === 'fecha resssp' ||
            k === 'numero resssffaa' || k === 'fecha resssffaa') continue;

        // acumula todo lo demás (clave ya normalizada)
        detalles[k] = row[k];
      }

      // coordenadas: intenta DMS, si falla usa decimales
      const strCoords = row['coordenadas'];
      const coordsDMS = parsearCoordenadasDMS(strCoords);
      centro.coords = coordsDMS.length ? coordsDMS : parsearCoordenadasDecimales(strCoords);

      // proveedor → title case + key
      if (centro.proveedor) {
        centro.proveedor = toTitleCase(centro.proveedor);
        centro.proveedorKey = makeProveedorKey(centro.proveedor);
      } else {
        centro.proveedorKey = '';
      }
      if (centro.comuna) centro.comuna = toTitleCase(centro.comuna);

      // números ("" => null; coma/ punto)
      if (centro.hectareas === '' || centro.hectareas == null) {
        centro.hectareas = null;
      } else {
        const n = Number(String(centro.hectareas).replace(',', '.'));
        centro.hectareas = Number.isNaN(n) ? null : n;
      }

      if (centro.tonsMax === '' || centro.tonsMax == null) {
        centro.tonsMax = null;
      } else {
        const t = Number(String(centro.tonsMax).replace(',', '.'));
        centro.tonsMax = Number.isFinite(t) ? t : null;
      }

      // codigoArea → string o null
      if (centro.codigoArea === '' || centro.codigoArea == null) {
        centro.codigoArea = null;
      } else {
        centro.codigoArea = String(centro.codigoArea).trim();
      }

      // strings simples (limpios)
      if (centro.region != null)       centro.region = String(centro.region).trim();
      if (centro.ubicacion != null)    centro.ubicacion = String(centro.ubicacion).trim();
      if (centro.grupoEspecie != null) centro.grupoEspecie = String(centro.grupoEspecie).trim();

      // especies (string o array)
      if (row['especies']) {
        centro.especies = splitList(row['especies']);
      }

      // normaliza resSSP / resSSFFAA en detalles (usando keys normalizadas)
      const resSSP = {};
      if (row['numero resssp']) resSSP.numero = String(row['numero resssp']).trim();
      if (row['fecha resssp'])  resSSP.fecha  = String(row['fecha resssp']).trim();
      if (Object.keys(resSSP).length) detalles.resSSP = resSSP;

      const resSSFFAA = {};
      if (row['numero resssffaa']) resSSFFAA.numero = String(row['numero resssffaa']).trim();
      if (row['fecha resssffaa'])  resSSFFAA.fecha  = String(row['fecha resssffaa']).trim();
      if (Object.keys(resSSFFAA).length) detalles.resSSFFAA = resSSFFAA;

      // opcional: guardar fila original por auditoría
      // detalles._raw = fila;

      centro.detalles = detalles;

      return centro;
    };

    const docs = centrosData.map(parseFila).filter(d => d && d.code != null && String(d.code).trim() !== '');
    if (!docs.length) {
      resultadoDiv.textContent = 'No hay filas válidas con "Código Centro" (code).';
      btnImportar.disabled = false;
      return;
    }

    // 2) Divide en lotes (300–500 recomendado)
    const lotes = chunk(docs, 300);
    let totalUpserted = 0, totalModified = 0, totalMatched = 0, totalMapa = 0, lotesError = 0;

    try {
      for (let i = 0; i < lotes.length; i++) {
        resultadoDiv.textContent = `Importando... lote ${i + 1}/${lotes.length}`;
        try {
          const r = await bulkUpsertCentros(lotes[i]);
          totalMatched  += r?.matched         ?? 0;
          totalModified += r?.modified        ?? 0;
          totalUpserted += r?.upserted        ?? 0;
          totalMapa     += r?.mapaActualizado ?? 0;
        } catch (e) {
          console.error('Error en lote', i + 1, e);
          lotesError++;
        }
        await new Promise(r => setTimeout(r, 0)); // evita congelar UI
      }

      const msg = `Importación completa. Nuevos/Actualizados: ${totalUpserted + totalModified}, Mapeos área↔centro creados: ${totalMapa}${lotesError ? `, Lotes con error: ${lotesError}` : ''}`;
      resultadoDiv.textContent = msg;
      toast(msg, { variant: lotesError ? 'warning' : 'success', durationMs: 5200 });
      notifyCentrosUpdated();
    } finally {
      btnImportar.disabled = false;
      const close = () => {
        try {
          if (typeof window.closeImportarModal === 'function') return window.closeImportarModal();
          const ov = document.getElementById('modalImportarCentrosOverlay');
          if (ov) ov.style.display = 'none';
        } catch {}
      };
      setTimeout(close, 900);
    }
  });
}

/* ========= Excel/CSV → JSON ========= */
async function parseFileToJson(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const wb = window.XLSX.read(data, { type: 'binary' });
        const first = wb.SheetNames[0];
        const sheet = wb.Sheets[first];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        console.error('Error leyendo archivo:', err);
        alert('Error leyendo archivo. Asegúrate de que sea Excel/CSV válido.');
        resolve([]);
      }
    };
    reader.readAsBinaryString(file);
  });
}

/* ========= Vista previa ========= */
function renderPreview(rows) {
  const previewDiv = document.getElementById('previewCentros');
  if (!rows || !rows.length) {
    previewDiv.innerHTML = '<div class="am-muted">No hay datos para mostrar.</div>';
    return;
  }
  const keys = Object.keys(rows[0]);
  let html = '<div class="config-table-wrap"><table class="am-table"><thead><tr>';
  html += keys.map(k => `<th>${k}</th>`).join('');
  html += '</tr></thead><tbody>';
  rows.slice(0, 5).forEach(r => {
    html += '<tr>' + keys.map(k => `<td>${r[k] ?? ''}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table></div>';
  previewDiv.innerHTML = html;
}
