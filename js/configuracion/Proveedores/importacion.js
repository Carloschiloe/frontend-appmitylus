// /js/configuracion/proveedores/importacion.js
import { saveProveedoresMasivo } from './service.js';

export function importarProveedores() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = window.XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // Validación y preview rápida (puedes mejorar esto)
      if (confirm(`¿Importar ${rows.length} proveedores?`)) {
        await saveProveedoresMasivo(rows);
        import('./tabla.js').then(mod => mod.initTablaProveedores());
        M.toast({ html: 'Proveedores importados', classes: 'green' });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}
