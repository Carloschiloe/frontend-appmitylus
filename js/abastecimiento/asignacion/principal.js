// js/abastecimiento/asignacion/principal.js
import * as api from './api.js';
import * as estado from './estado.js';
import * as inventario from './inventario.js';
import * as asignacion from './asignacion.js';
import * as programaSemanal from './programa_semanal.js';

/* ===================== Helpers UI ===================== */
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureXLSX(){
  if (window.XLSX) return true;
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    return !!window.XLSX;
  }catch{ return false; }
}

async function ensurePDF(){
  if (window.jspdf || window.jsPDF) return true;
  try{
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
    return !!(window.jspdf || window.jsPDF);
  }catch{ return false; }
}

function activeTabId(){
  const a = document.querySelector('.tabs .tab a.active');
  return a ? a.getAttribute('href') : null; // #tabInventario | #tabAsignacion | #tabPrograma
}

function tablaActiva(){
  const id = activeTabId();
  if (id === '#tabInventario') {
    return (window.getTablaInventario && window.getTablaInventario()) || window.tableInv || window.tablePivot || null;
  }
  if (id === '#tabAsignacion') {
    return (window.getTablaAsignacion && window.getTablaAsignacion()) || window.tableAsign || null;
  }
  if (id === '#tabPrograma') {
    return (window.getTablaPrograma && window.getTablaPrograma()) || window.tableProg || null;
  }
  return window.tableInv || window.tableAsign || window.tableProg || null;
}

function nombreActivo(){
  const map = {
    '#tabInventario': 'inventarios_stock',
    '#tabAsignacion': 'asignacion',
    '#tabPrograma'  : 'programa_semanal',
  };
  return map[activeTabId()] || 'export';
}

function crearBarraAcciones(){
  if (document.getElementById('actionBarGlobal')) return;

  const container = document.querySelector('.container');
  if (!container) return;

  const bar = document.createElement('div');
  bar.id = 'actionBarGlobal';
  bar.className = 'card-soft';
  bar.style.cssText = 'padding:10px 12px;display:flex;gap:8px;align-items:center;justify-content:space-between;margin:8px 0;position:relative;z-index:4';

  bar.innerHTML = `
    <div class="left">
      <a href="../../../html/Abastecimiento/categorias.html" class="btn-flat">
        <i class="material-icons left">arrow_back</i>Volver
      </a>
    </div>
    <div class="right" style="display:flex;gap:8px">
      <a class="btn grey darken-2" id="btnExcelGlobal">
        <i class="material-icons left">grid_on</i>Excel
      </a>
      <a class="btn grey darken-2" id="btnPdfGlobal">
        <i class="material-icons left">picture_as_pdf</i>PDF
      </a>
    </div>
  `;

  // Inserta la barra justo antes de las tabs (si existen); si no, al inicio.
  const tabsCard = container.querySelector('.tabs')?.closest('.card-soft');
  if (tabsCard) {
    container.insertBefore(bar, tabsCard);
  } else {
    container.insertBefore(bar, container.firstChild);
  }

  // Listeners exportación (tabla activa)
  document.getElementById('btnExcelGlobal').addEventListener('click', async ()=>{
    const table = tablaActiva();
    if (!table){ M.toast({html:'No hay tabla para exportar', classes:'orange'}); return; }
    const ok = await ensureXLSX();
    if (!ok){ M.toast({html:'XLSX no disponible', classes:'orange'}); return; }
    try{
      table.download('xlsx', `${nombreActivo()}.xlsx`, { sheetName: 'Datos' });
    }catch(e){
      console.error(e); M.toast({html:'Error al exportar Excel', classes:'red'});
    }
  });

  document.getElementById('btnPdfGlobal').addEventListener('click', async ()=>{
    const table = tablaActiva();
    if (!table){ M.toast({html:'No hay tabla para exportar', classes:'orange'}); return; }
    const ok = await ensurePDF();
    if (!ok){ M.toast({html:'PDF no disponible', classes:'orange'}); return; }
    try{
      table.download('pdf', `${nombreActivo()}.pdf`, {
        orientation: 'landscape',
        autoTable: { styles:{ fontSize: 8, cellPadding: 2 }, margin:{ top: 14 } }
      });
    }catch(e){
      console.error(e); M.toast({html:'Error al exportar PDF', classes:'red'});
    }
  });
}

/* ===================== App bootstrap ===================== */
document.addEventListener('DOMContentLoaded', async () => {
  // Materialize
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.FormSelect.init(document.querySelectorAll('select'));

  // Barra superior consistente (volver + Excel + PDF)
  crearBarraAcciones();

  // Carga de estado y módulos
  try{
    await estado.cargarTodo(api);
  }catch(e){
    console.error(e);
    M.toast({html:'No se pudo cargar datos iniciales', classes:'red'});
  }

  // Montar vistas
  inventario.montar();
  asignacion.montar();
  programaSemanal.montar();

  // Re-inicializa la barra al cambiar de pestaña para exportar la tabla visible
  document.querySelectorAll('.tabs .tab a').forEach(a=>{
    a.addEventListener('click', ()=>{
      // leve delay para asegurar activación visual
      setTimeout(()=>crearBarraAcciones(), 50);
    });
  });

  // Exponer para depuración
  window.__api = api;
  window.__estado = estado;
});

