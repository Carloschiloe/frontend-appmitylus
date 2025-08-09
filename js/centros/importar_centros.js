// js/centros/importar_centros.js
// Reemplazo completo

import { createCentro, updateCentro, getCentroByCode } from '../core/centros_repo.js';

/* =========================
   Helpers de formato
   ========================= */
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Clave determinista para el proveedor:
 * - minúsculas, sin tildes, espacios/puntuación -> "-"
 */
function makeProveedorKey(name) {
  if (!name) return '';
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/* =========================
   Mapeo columnas Excel -> modelo
   (ajusta si cambian los encabezados)
   ========================= */
const MAPEO_CAMPOS = {
  'Proveedor': 'proveedor',
  'Comuna': 'comuna',
  'Codigo Centro': 'code',
  'Hectareas': 'hectareas',
  // Coordenadas se procesa aparte
};

/* =========================
   Coordenadas DMS → decimal
   Admite: S 42°12´30.5, W 73°45´10.2
   ========================= */
function dmsToDecimal(dms) {
  if (!dms) return null;
  // Soporta ´ o ' como minutos
  const regex = /([NSWE])\s*(\d+)[°º]\s*(\d+)[´'\u2032]?\s*([\d.,]+)/i;
  const m = dms.match(regex);
  if (!m) return null;
  const [, dir, deg, min, secRaw] = m;
  const sec = parseFloat(String(secRaw).replace(',', '.'));
  let dec = parseInt(deg, 10) + parseInt(min, 10) / 60 + sec / 3600;
  if (dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W') dec *= -1;
  return dec;
}

function parsearCoordenadasDMS(str) {
  if (!str) return [];
  return String(str)
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(par => {
      // Ej: "S 42°12´30.5, W 73°45´10.2"
      const [latDMS, lngDMS] = par.split(',').map(x => x.trim());
      return { lat: dmsToDecimal(latDMS), lng: dmsToDecimal(lngDMS) };
    })
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/* =========================
   Render del importador
   ========================= */
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

  btnImportar.addEventListener('click', async () => {
  if (!centrosData.length) return;

  let importados = 0, actualizados = 0, errores = 0;
  btnImportar.disabled = true;
  resultadoDiv.textContent = 'Importando...';

  // Helper: procesa en paralelo con N "workers"
  async function runBatches(arr, concurrency, worker, onProgress) {
    let done = 0;
    const queue = arr.map((x, idx) => ({ x, idx }));
    async function runner() {
      while (queue.length) {
        const { x, idx } = queue.shift();
        await worker(x, idx);
        done++;
        if (onProgress && done % 25 === 0) onProgress(done, arr.length);
        // ceder tiempo al navegador
        if (done % 50 === 0) await new Promise(r => setTimeout(r, 0));
      }
    }
    await Promise.all(Array.from({ length: concurrency }, runner));
  }

  // Normalizador por fila (idéntico a tu lógica actual)
  const parseFila = (fila) => {
    const centro = {};
    const detalles = {};
    for (const k in fila) {
      if (MAPEO_CAMPOS[k]) {
        centro[MAPEO_CAMPOS[k]] = fila[k];
      } else if (k.toLowerCase().includes('coordenada')) {
        centro.coords = parsearCoordenadasDMS(fila[k]);
      } else {
        detalles[k] = fila[k];
      }
    }
    centro.detalles = detalles;
    if ((!centro.coords || !centro.coords.length) && detalles['Coordenadas']) {
      centro.coords = parsearCoordenadasDMS(detalles['Coordenadas']);
    }
    if (centro.proveedor) {
      centro.proveedor = toTitleCase(centro.proveedor);
      centro.proveedorKey = makeProveedorKey(centro.proveedor);
    } else {
      centro.proveedorKey = '';
    }
    if (centro.comuna) centro.comuna = toTitleCase(centro.comuna);
    if (centro.hectareas != null && centro.hectareas !== '') {
      const n = Number(String(centro.hectareas).replace(',', '.'));
      if (!Number.isNaN(n)) centro.hectareas = n;
    }
    return centro;
  };

  try {
    await runBatches(
      centrosData,
      8, // <= puedes subir a 12 si tu backend aguanta
      async (fila/*, idx*/) => {
        const centro = parseFila(fila);
        try {
          const existente = await getCentroByCode(centro.code);
          if (existente) {
            await updateCentro(existente._id, centro);
            actualizados++;
          } else {
            await createCentro(centro);
            importados++;
          }
        } catch (err) {
          console.error('Error importando centro:', centro, err);
          errores++;
        }
      },
      (done, total) => {
        resultadoDiv.textContent = `Importando... (${done}/${total})`;
      }
    );

    const msg = `¡Importación completa! Creados: ${importados}, Actualizados: ${actualizados}, Errores: ${errores}`;
    resultadoDiv.textContent = msg;
    if (window.M?.toast) M.toast({ html: msg, displayLength: 4000 });
  } finally {
    btnImportar.disabled = false;
    const modalEl = document.querySelector('#modalImportarCentros');
    if (modalEl && window.M?.Modal) {
      const instance = window.M.Modal.getInstance(modalEl);
      setTimeout(() => instance?.close(), 900);
    }
  }
});


/* =========================
   Excel/CSV → JSON
   Requiere window.XLSX cargado
   ========================= */
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

/* =========================
   Vista previa de primeras filas
   ========================= */
function renderPreview(rows) {
  const previewDiv = document.getElementById('previewCentros');
  if (!rows || !rows.length) {
    previewDiv.innerHTML = '<em>No hay datos para mostrar.</em>';
    return;
  }
  const keys = Object.keys(rows[0]);
  let html = '<table class="striped"><thead><tr>' +
    keys.map(k => `<th>${k}</th>`).join('') + '</tr></thead><tbody>';
  rows.slice(0, 5).forEach(r => {
    html += '<tr>' + keys.map(k => `<td>${r[k]}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  previewDiv.innerHTML = html;
}


