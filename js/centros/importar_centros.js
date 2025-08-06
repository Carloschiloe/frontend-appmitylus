// js/centros/importar_centros.js

import { addCentro } from '../core/centros_repo.js';

// 1. Renderiza un input para cargar archivos
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

  // Inicializa lógica
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
    let importados = 0, errores = 0;
    for (const centro of centrosData) {
      try {
        await addCentro(centro);
        importados++;
      } catch (err) {
        errores++;
        console.error('Error importando centro:', centro, err);
      }
    }
    document.getElementById('resultadoImportacion').textContent =
      `¡Importación completa! Importados: ${importados}, Errores: ${errores}`;
    btnImportar.disabled = false;
  });
}

// 2. Lee archivo Excel/CSV y lo convierte a objetos JS
async function parseFileToJson(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target.result;
      let workbook;
      try {
        // SheetJS debe estar cargado en tu html como <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>
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

// 3. Renderiza preview de los datos antes de importar
function renderPreview(rows) {
  const previewDiv = document.getElementById('previewCentros');
  if (!rows || !rows.length) {
    previewDiv.innerHTML = '<em>No hay datos para mostrar.</em>';
    return;
  }
  // Solo mostramos las primeras 5 filas
  const keys = Object.keys(rows[0]);
  let html = '<table class="striped"><thead><tr>' +
    keys.map(k => `<th>${k}</th>`).join('') + '</tr></thead><tbody>';
  rows.slice(0, 5).forEach(r => {
    html += '<tr>' + keys.map(k => `<td>${r[k]}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  previewDiv.innerHTML = html;
}
