import { saveProveedoresMasivo } from './service.js';

// IMPORTACIÓN MASIVA DE PROVEEDORES DESDE EXCEL
export function importarProveedores() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        // Lee el archivo Excel
        const data = new Uint8Array(evt.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) {
          M.toast({ html: 'El archivo está vacío.', classes: 'red' });
          return;
        }

        // Confirmación previa
        if (!confirm(`¿Importar ${rows.length} proveedores? Esto podría reemplazar datos existentes.`)) return;

        // Guarda en el "backend" (mock o API real en el futuro)
        await saveProveedoresMasivo(rows);

        // Refresca la tabla (import dinámico)
        import('/js/configuracion/proveedores/tabla.js').then(mod => mod.initTablaProveedores());

        M.toast({ html: `Importación exitosa (${rows.length} proveedores).`, classes: 'green' });

      } catch (err) {
        console.error('[Importación] Error:', err);
        M.toast({ html: 'Error al importar Excel', classes: 'red' });
      }
    };

    reader.readAsArrayBuffer(file);
  };
  input.click();
}
