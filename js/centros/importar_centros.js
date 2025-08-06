import { createCentro, updateCentro, getCentroByCode } from '../core/centros_repo.js';

// ===== Helper para capitalizar =====
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Mapea los nombres de columnas de tu Excel a los campos de la base de datos
const MAPEO_CAMPOS = {
  'Proveedor': 'proveedor',
  'Comuna': 'comuna',
  'Codigo Centro': 'code',
  'Hectareas': 'hectareas',
  // 'Coordenadas' se procesa especial abajo
};

// --------- PARSING DE COORDENADAS ---------
function parsearCoordenadasDMS(str) {
  if (!str) return [];
  return str.split(';').filter(Boolean).map(p => {
    const [latDMS, lngDMS] = p.split(',').map(x => x.trim());
    return {
      lat: dmsToDecimal(latDMS),
      lng: dmsToDecimal(lngDMS)
    };
  });
}

function dmsToDecimal(dms) {
  if (!dms) return null;
  const regex = /([NSWE])\s*(\d+)°(\d+)´([\d\.]+)/i;
  const match = dms.match(regex);
  if (!match) return null;
  const [, dir, deg, min, sec] = match;
  let dec = parseInt(deg) + parseInt(min) / 60 + parseFloat(sec.replace(',', '.')) / 3600;
  if (dir === 'S' || dir === 'W') dec *= -1;
  return dec;
}

// --------- IMPORTADOR UI ---------
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
  let centrosData = [];

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    centrosData = await parseFileToJson(file);
    btnImportar.disabled = !centrosData.length;
    renderPreview(centrosData);
  });

  btnImportar.addEventListener('click', async () => {
    if (!centrosData.length) return;
    btnImportar.disabled = true;
    document.getElementById('resultadoImportacion').textContent = 'Importando...';
    let importados = 0, actualizados = 0, errores = 0;

    for (const fila of centrosData) {
      // Mapear campos principales
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

      // --- Capitalizar proveedor y comuna
      if (centro.proveedor) centro.proveedor = toTitleCase(centro.proveedor);
      if (centro.comuna) centro.comuna = toTitleCase(centro.comuna);

      // === Lógica ACTUALIZAR o CREAR ===
      try {
        const existente = await getCentroByCode(centro.code);
        if (existente) {
          await updateCentro(existente._id, { ...existente, ...centro });
          actualizados++;
        } else {
          await createCentro(centro);
          importados++;
        }
      } catch (err) {
        errores++;
        console.error('Error importando centro:', centro, err);
      }
    }

    document.getElementById('resultadoImportacion').textContent =
      `¡Importación completa! Creados: ${importados}, Actualizados: ${actualizados}, Errores: ${errores}`;
    btnImportar.disabled = false;
  });
}

// ========== Helpers Excel ==========

async function parseFileToJson(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target.result;
      let workbook;
      try {
        workbook = window.XLSX.read(data, { type: 'binary' });
      } catch (err) {
        alert('Error leyendo archivo. Asegúrate de que sea Excel/CSV válido.');
        resolve([]);
        return;
      }
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      let rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      resolve(rows);
    };
    reader.readAsBinaryString(file);
  });
}

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
