import { getCentrosAll } from '../../core/centros_repo.js';

let tabla;

document.addEventListener('DOMContentLoaded', async () => {
  await cargarTabla();

  // Refrescar automáticamente si se guarda inventario:
  window.addEventListener('inventario-guardado', async () => {
    await refrescarTabla();
  });
});

async function cargarTabla() {
  const data = await buildRows();

  tabla = $('#tablaInventarios').DataTable({
    data,
    columns: [
      { title: 'Fecha' },
      { title: 'Centro' },
      { title: 'Línea' },
      { title: 'Tot' },
      { title: 'NB Buenas' },
      { title: 'NB Malas' },
      { title: 'NA Buenas' },
      { title: 'NA Malas' },
      { title: 'Sueltas' },
      { title: 'Colchas' },
      { title: 'Estado Línea' },
      { title: 'Obs' },
      { title: 'Lat' },
      { title: 'Lng' }
    ],
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Inventarios_Lineas_Boyas' },
      { extend: 'pdfHtml5',   title: 'Inventarios_Lineas_Boyas', orientation: 'landscape', pageSize: 'A4' },
      'copy', 'print'
    ],
    responsive: true,
    scrollX: true,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' }
  });
}

async function refrescarTabla() {
  const data = await buildRows();
  tabla.clear().rows.add(data).draw();
}

async function buildRows() {
  const centros = await getCentrosAll();
  const rows = [];

  centros.forEach((c) => {
    (c.lines || []).forEach((l, idxLinea) => {
      (l.inventarios || []).forEach((reg) => {
        rows.push([
          reg.fecha ? new Date(reg.fecha).toLocaleString() : '-',  // Fecha
          c.name || '-',                                           // Centro
          l.number || (idxLinea + 1),                              // Línea
          reg.boyas?.total ?? 0,                                   // Tot
          reg.boyas?.negras?.buenas   ?? 0,                        // NB Buenas
          reg.boyas?.negras?.malas    ?? 0,                        // NB Malas
          reg.boyas?.naranjas?.buenas ?? 0,                        // NA Buenas
          reg.boyas?.naranjas?.malas  ?? 0,                        // NA Malas
          reg.sueltas ?? 0,                                        // Sueltas
          reg.colchas ?? 0,                                        // Colchas
          reg.estadoLinea || '-',                                  // Estado Línea
          reg.observaciones || '-',                                // Obs
          reg.gps?.lat ?? '',                                      // Lat
          reg.gps?.lng ?? ''                                       // Lng
        ]);
      });
    });
  });

  return rows;
}
