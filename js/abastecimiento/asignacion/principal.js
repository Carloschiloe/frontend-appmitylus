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
  if(id==='#tabInventario') return (window.getTablaInventario?.()) || window.tableInv || window.tablePivot || null;
  if(id==='#tabAsignacion') return (window.getTablaAsignacion?.()) || window.tableAsign || null;
  if(id==='#tabPrograma')   return (window.getTablaPrograma?.())   || window.tableProg  || null;
  return window.tableInv || window.tableAsign || window.tableProg || null;
}
function nombreActivo(){
  const m={'#tabInventario':'inventarios_stock','#tabAsignacion':'asignacion','#tabPrograma':'programa_semanal'};
  return m[activeTabId()] || 'export';
}

/* =============== UI: Back en navbar =============== */
function inyectarVolverNavbar(){
  // evita duplicar
  if(document.getElementById('btnVolverNavbar')) return;

  const navWrap=document.querySelector('nav .nav-wrapper');
  if(!navWrap) return;

  // contenedor izquierdo si existe, si no creamos
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

/* =============== UI: Excel/PDF junto a “N registros” =============== */
function esconderDescargasDuplicadas(scope){
  // oculta botones CSV/XLSX del toolbar original
  const dupBtns = scope.querySelectorAll('a.btn,button').forEach? 
    scope.querySelectorAll('a.btn, button') : [];
  dupBtns.forEach(b=>{
    const t=(b.textContent||'').trim().toUpperCase();
    if(t==='CSV' || t==='XLSX' || t==='DESCARGAR' || b.id==='btnCSV' || b.id==='btnXLSX'){
      b.style.display='none';
    }
  });
}

function encontrarChipRegistros(scope){
  // Busca el chip "N registros"
  let chip = scope.querySelector('#badgeReg');
  if(chip) return chip;

  // heurística: span/pill que contenga "registros"
  chip = [...scope.querySelectorAll('span,div')].find(x=>(x.textContent||'').toLowerCase().includes('registros'));
  return chip || null;
}

function crearBotonClase(icono, label){
  const a=document.createElement('a');
  a.className='btn grey darken-2';
  a.style.display='inline-flex';
  a.style.alignItems='center';
  a.style.gap='6px';
  a.style.height='36px';
  a.innerHTML=`<i class="material-icons left" style="margin:0">${icono}</i>${label}`;
  return a;
}

function colocarExportesEnToolbar(tabRoot){
  if(!tabRoot) return;
  const toolbar = tabRoot.querySelector('.toolbar') || tabRoot.querySelector('[id*="Toolbar"]') || tabRoot;
  if(!toolbar) return;

  esconderDescargasDuplicadas(toolbar);

  const chip = encontrarChipRegistros(toolbar);
  if(!chip) return;

  // evita duplicar
  if(toolbar.querySelector('#btnExcelJuntoChip')) return;

  const wrap=document.createElement('span');
  wrap.style.display='inline-flex';
  wrap.style.gap='8px';
  wrap.style.marginLeft='8px';
  wrap.style.verticalAlign='middle';

  const btnX = crearBotonClase('grid_on','EXCEL');
  btnX.id='btnExcelJuntoChip';
  const btnP = crearBotonClase('picture_as_pdf','PDF');
  btnP.id='btnPdfJuntoChip';

  wrap.append(btnX, btnP);
  chip.after(wrap);

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

function reubicarExportesSegunPestaña(){
  const id = activeTabId();
  if(id==='#tabInventario')  colocarExportesEnToolbar(document.querySelector('#tabInventario'));
  if(id==='#tabAsignacion')  colocarExportesEnToolbar(document.querySelector('#tabAsignacion'));
  if(id==='#tabPrograma')    colocarExportesEnToolbar(document.querySelector('#tabPrograma'));
}

/* =============== bootstrap =============== */
document.addEventListener('DOMContentLoaded', async () => {
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.FormSelect.init(document.querySelectorAll('select'));

  // Back dentro de la barra verde
  inyectarVolverNavbar();

  // Datos iniciales
  try{ await estado.cargarTodo(api); }
  catch(e){ console.error(e); M.toast({html:'No se pudo cargar datos iniciales', classes:'red'}); }

  // Montar vistas
  inventario.montar();
  asignacion.montar();
  programaSemanal.montar();

  // Reubicar exportes tras montar y al cambiar de pestaña
  setTimeout(reubicarExportesSegunPestaña, 150);
  document.querySelectorAll('.tabs .tab a').forEach(a=>{
    a.addEventListener('click', ()=> setTimeout(reubicarExportesSegunPestaña, 120));
  });

  // Observa cambios en toolbars (p.ej. cuando se redibuja)
  const obs = new MutationObserver(()=> setTimeout(reubicarExportesSegunPestaña, 60));
  ['#tabInventario','#tabAsignacion','#tabPrograma'].forEach(sel=>{
    const el=document.querySelector(sel);
    if(el) obs.observe(el, {childList:true, subtree:true});
  });

  // Debug
  window.__api = api; window.__estado = estado;
});
