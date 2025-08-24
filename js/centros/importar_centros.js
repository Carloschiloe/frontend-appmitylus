// js/centros/importar_centros.js
import { bulkUpsertCentros } from '../core/centros_repo.js';

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
  'proveedor': 'proveedor',
  'comuna': 'comuna',
  'codigo centro': 'code',
  'hectareas': 'hectareas',
  'codigo area': 'codigoArea',
  'region': 'region',
  'ubicacion': 'ubicacion',
  'grupo especie': 'grupoEspecie',
  'tons max': 'tonsMax',
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
    <div class="card-panel" style="margin-bottom:1rem;">
      <h6>Importar centros desde Excel o CSV</h6>
      <input type="file" id="fileInputCentros" accept=".xlsx,.xls,.csv" />
      <button id="btnImportarCentros" class="btn teal" style="margin-left:1rem;" disabled>Importar</button>
      <div id="previewCentros" style="margin-top:1rem;max-height:180px;overflow:auto;font-size:.95em;"></div>
      <div id="resultadoImportacion" style="margin-top:1rem;font-weight:bold;"></div>
    </div>
  `;

  const fileInput = document.getElementById('fileInputCentros');
  const btnImportar = document.getElementById('btnImportarCentros');
  const resultadoDiv = document.getElementById('resultadoImportacion');

  let centrosData = [];

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    centrosData = await parseFileToJson(file);
    btnImportar.disabled = !centrosData.length;
    renderPreview(centrosData);
    resultadoDiv.textContent = centrosData.length
      ? `Archivo cargado. Registros detectados: ${centrosData.length}`
      : '';
  });

  // ===== Importar en BULK por lotes =====
  btnImportar.addEventListener('click', async () => {
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

      // rut / nroPert
      if (row['rut titular']) detalles.rutTitular = String(row['rut titular']).trim();
      if (row['nropert'])     detalles.nroPert    = String(row['nropert']).trim();

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
    let totalUpserted = 0, totalModified = 0, totalMatched = 0, lotesError = 0;

    try {
      for (let i = 0; i < lotes.length; i++) {
        resultadoDiv.textContent = `Importando... lote ${i + 1}/${lotes.length}`;
        try {
          const r = await bulkUpsertCentros(lotes[i]);
          totalMatched  += r?.matched  ?? 0;
          totalModified += r?.modified ?? 0;
          totalUpserted += r?.upserted ?? 0;
        } catch (e) {
          console.error('Error en lote', i + 1, e);
          lotesError++;
        }
        await new Promise(r => setTimeout(r, 0)); // evita congelar UI
      }

      const msg = `¡Importación completa! Upserted: ${totalUpserted}, Modificados: ${totalModified}, Coincidencias: ${totalMatched}, Lotes con error: ${lotesError}`;
      resultadoDiv.textContent = msg;
      window.M?.toast?.({ html: msg, displayLength: 5000 });
    } finally {
      btnImportar.disabled = false;
      const modalEl = document.querySelector('#modalImportarCentros');
      if (modalEl && window.M?.Modal) {
        const instance = window.M.Modal.getInstance(modalEl) || window.M.Modal.init(modalEl);
        setTimeout(() => instance.close(), 900);
      }
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
    previewDiv.innerHTML = '<em>No hay datos para mostrar.</em>';
    return;
  }
  const keys = Object.keys(rows[0]);
  let html = '<table class="striped"><thead><tr>';
  html += keys.map(k => `<th>${k}</th>`).join('');
  html += '</tr></thead><tbody>';
  rows.slice(0, 5).forEach(r => {
    html += '<tr>' + keys.map(k => `<td>${r[k]}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  previewDiv.innerHTML = html;
}
