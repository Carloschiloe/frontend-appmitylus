// js/abastecimiento/asignacion/principal.js
import * as api from './api.js';
import * as estado from './estado.js';
import * as inventario from './inventario.js';
import * as asignacion from './asignacion.js';
import * as programaSemanal from './programa_semanal.js';

/* =============== utilidades =============== */
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src=src; s.async=true; s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}
async function ensureXLSX(){
  if(window.XLSX) return true;
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    return !!window.XLSX;
  }catch{ return false; }
}
async function ensurePDF(){
  if(window.jspdf || window.jsPDF) return true;
  try{
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
    return !!(window.jspdf || window.jsPDF);
  }catch{ return false; }
}

function activeTabId(){
  const a=document.querySelector('.tabs .tab a.active');
  return a ? a.getAttribute('href') : '#tabInventario';
}
function tablaActiva(){
  const id=activeTabId();
  if(id==='#tabInventario') return (window.getTablaInventario?.()) || null;
  if(id==='#tabAsignacion') return (window.getTablaAsignacion?.()) || null;
  if(id==='#tabPrograma')   return (window.getTablaPrograma?.())   || null;
  return null;
}
function nombreActivo(){
  const m={'#tabInventario':'inventarios_stock','#tabAsignacion':'asignacion','#tabPrograma':'programa_semanal'};
  return m[activeTabId()] || 'export';
}

/* =============== UI: Back en navbar =============== */
function inyectarVolverNavbar(){
  if(document.getElementById('btnVolverNavbar')) return;
  const navWrap=document.querySelector('nav .nav-wrapper');
  if(!navWrap) return;

  let leftSlot=navWrap.querySelector('.left');
  if(!leftSlot){
    leftSlot=document.createElement('div');
    leftSlot.className='left';
    leftSlot.style.display='flex';
    leftSlot.style.alignItems='center';
    leftSlot.style.gap='8px';
    navWrap.prepend(leftSlot);
  }

  const a=document.createElement('a');
  a.id='btnVolverNavbar';
  a.href='../../../html/Abastecimiento/categorias.html';
  a.className='btn-flat white-text';
  a.style.display='flex';
  a.style.alignItems='center';
  a.style.gap='6px';
  a.innerHTML=`<i class="material-icons">arrow_back</i><span>Volver</span>`;
  leftSlot.prepend(a);
}

/* ========== Botones de exportación: fijos a la derecha ========== */
function crearBoton(icono, label, id){
  const a=document.createElement('a');
  a.id=id;
  a.className='btn grey darken-2';
  a.style.display='inline-flex';
  a.style.alignItems='center';
  a.style.gap='6px';
  a.style.height='36px';
  a.innerHTML=`<i class="material-icons left" style="margin:0">${icono}</i>${label}`;
  return a;
}

function colocarExportes(tabRoot){
  if(!tabRoot) return;
  const toolbar = tabRoot.querySelector('.toolbar') || tabRoot.querySelector('[id*="Toolbar"]');
  if(!toolbar) return;

  // contenedor estable (lo empujamos a la derecha)
  const actions = toolbar.querySelector('.right-actions') || toolbar;
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '8px';
  actions.style.flexWrap = 'nowrap';
  actions.style.marginLeft = 'auto';
  actions.style.justifyContent = 'flex-end';

  // quitar botones viejos conocidos para no duplicar
  ['inv_csv','inv_xlsx','btnCSV','btnXLSX','btnExcelJuntoChip','btnPdfJuntoChip']
    .forEach(id=>{ const el=actions.querySelector('#'+id); if(el) el.remove(); });

  const btnX = crearBoton('grid_on','EXCEL','btnExcelJuntoChip');
  const btnP = crearBoton('picture_as_pdf','PDF','btnPdfJuntoChip');

  actions.append(btnX, btnP);

  btnX.addEventListener('click', async ()=>{
    const table = tablaActiva();
    if(!table){ M.toast({html:'No hay tabla para exportar', classes:'orange'}); return; }
    const ok = await ensureXLSX(); if(!ok){ M.toast({html:'XLSX no disponible', classes:'orange'}); return; }
    try{ table.download('xlsx', `${nombreActivo()}.xlsx`, {sheetName:'Datos'}); }
    catch(e){ console.error(e); M.toast({html:'Error al exportar Excel', classes:'red'}); }
  });

  btnP.addEventListener('click', async ()=>{
    const table = tablaActiva();
    if(!table){ M.toast({html:'No hay tabla para exportar', classes:'orange'}); return; }
    const ok = await ensurePDF(); if(!ok){ M.toast({html:'PDF no disponible', classes:'orange'}); return; }
    try{
      table.download('pdf', `${nombreActivo()}.pdf`, {
        orientation:'landscape',
        autoTable:{styles:{fontSize:8, cellPadding:2}, margin:{top:14}}
      });
    }catch(e){ console.error(e); M.toast({html:'Error al exportar PDF', classes:'red'}); }
  });
}

function colocarExportesTodas(){
  colocarExportes(document.querySelector('#tabInventario'));
  colocarExportes(document.querySelector('#tabAsignacion'));
  colocarExportes(document.querySelector('#tabPrograma'));
}

/* =============== bootstrap =============== */
document.addEventListener('DOMContentLoaded', async () => {
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.FormSelect.init(document.querySelectorAll('select'));

  inyectarVolverNavbar();

  try{ await estado.cargarTodo(api); }
  catch(e){ console.error(e); M.toast({html:'No se pudo cargar datos iniciales', classes:'red'}); }

  inventario.montar();
  asignacion.montar();
  programaSemanal.montar();

  // coloca exportes una vez y al cambiar de pestaña
  setTimeout(colocarExportesTodas, 120);
  document.querySelectorAll('.tabs .tab a').forEach(a=>{
    a.addEventListener('click', ()=> setTimeout(colocarExportesTodas, 120));
  });

  window.__api = api; window.__estado = estado;
});
