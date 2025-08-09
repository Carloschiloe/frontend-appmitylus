// js/centros/importar_centros.js
import { createCentro, updateCentro, getCentroByCode } from '../core/centros_repo.js';

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
const MAPEO_CAMPOS = {
  'Proveedor': 'proveedor',
  'Comuna': 'comuna',
  'Codigo Centro': 'code',
  'Hectareas': 'hectareas',
};

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
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(par => {
      const [latDMS, lngDMS] = par.split(',').map(x => x.trim());
      const lat = dmsToDecimal(latDMS);
      const lng = dmsToDecimal(lngDMS);
      return { lat, lng };
    })
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

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

  // ===== Importar en batches (concurrencia 8) =====
  btnImportar.addEventListener('click', async () => {
    if (!centrosData.length) return;

    let importados = 0, actualizados = 0, errores = 0;
    btnImportar.disabled = true;
    resultadoDiv.textContent = 'Importando...';

    async function runBatches(arr, concurrency, worker, onProgress) {
      let done = 0;
      const queue = arr.map((x, idx) => ({ x, idx }));
      async function runner() {
        while (queue.length) {
          const { x, idx } = queue.shift();
          await worker(x, idx);
          done++;
          if (onProgress && done % 25 === 0) onProgress(done, arr.length);
          if (done % 50 === 0) await new Promise(r => setTimeout(r, 0));
        }
      }
      await Promise.all(Array.from({ length: concurrency }, runner));
    }

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
        8,
        async (fila) => {
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
      if (window.M?.toast) window.M.toast({ html: msg, displayLength: 4000 });
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
