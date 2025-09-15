// /js/centros.page.js — inicializa tabs, tabla y mapa
import { initMapaCentros, focusEnCentro } from './mapa.centros.js';

const API_BASE = window.API_URL || '/api';
let centrosCache = [];

// ---- Materialize init ----
document.addEventListener('DOMContentLoaded', () => {
  const tabsEl = document.getElementById('tabs');
  if (tabsEl) M.Tabs.init(tabsEl);

  M.Modal.init(document.querySelectorAll('.modal'));
  // Botones de modales
  document.getElementById('btnOpenCentroModal')?.addEventListener('click', () => {
    M.Modal.getInstance(document.getElementById('centroModal')).open();
  });
  document.getElementById('btnOpenImportarModal')?.addEventListener('click', () => {
    M.Modal.getInstance(document.getElementById('modalImportarCentros')).open();
  });

  cargarCentros();
});

// ---- Fetch centros desde backend ----
async function cargarCentros(){
  try{
    const res = await fetch(`${API_BASE}/centros`);
    const data = await res.json();
    // normalizar (ajusta a tu modelo real)
    centrosCache = (Array.isArray(data) ? data : data.items || []).map(x => ({
      id: x._id || x.id,
      proveedor: x.proveedorNombre || x.proveedor || '',
      comuna: x.comuna || '',
      codigo: x.codigo || x.code || '',
      hectareas: Number(x.hectareas ?? x.ha ?? 0),
      lineas: Number(x.lineas ?? x.lineasCount ?? 0),
      tons: Number(x.tons ?? 0),
      unkg: Number(x.unKg ?? x.unkg ?? 0),
      rechazo: Number(x.rechazoPct ?? x.rechazo ?? 0),
      rdmto: Number(x.rendimiento ?? x.rdmto ?? 0),
      polygon: x.polygon || x.coordenadas || x.coordinates || []
    }));
    pintarTabla(centrosCache);
    const mapaCtx = initMapaCentros(centrosCache);
    // conectar sidebar con foco a mapa
    document.getElementById('listaCentrosSidebar').addEventListener('click', (e)=>{
      const li = e.target.closest('li[data-id]');
      if(!li) return;
      focusEnCentro(li.dataset.id);
      const tabs = M.Tabs.getInstance(document.getElementById('tabs'));
      tabs.select('tab-mapa');
    });
    // KPIs chips
    renderKPIs(centrosCache);
  }catch(err){
    console.error('Error cargando centros', err);
    M.toast({html:'No se pudo cargar centros', classes:'red'});
  }
}

// ---- DataTable ----
let dt;
function pintarTabla(rows){
  const table = $('#centrosTable');
  if (dt) dt.destroy();
  dt = table.DataTable({
    data: rows,
    responsive: true,
    colReorder: true,
    dom: 'Bfrtip',
    buttons: ['copy', 'csv', 'excel', 'pdf'],
    pageLength: 25,
    order: [[0,'asc']],
    columns: [
      { data:'proveedor' },
      { data:'comuna' },
      { data:'codigo' },
      { data:'hectareas', render:(v)=>fmtNum(v,2), className:'right-align' },
      { data:'lineas', className:'right-align' },
      { data:'tons', className:'right-align' },
      { data:'unkg', className:'right-align' },
      { data:'rechazo', render:(v)=>fmtNum(v,1)+'%', className:'right-align' },
      { data:'rdmto', render:(v)=>fmtNum(v,1)+'%', className:'right-align' },
      { data:null, orderable:false, render:(_,__,row)=>`<a class="btn-flat waves-effect" data-id="${row.id}"><i class="material-icons">visibility</i></a>`},
      { data:null, orderable:false, render:(_,__,row)=>`<a class="btn-flat"><i class="material-icons">edit</i></a> <a class="btn-flat"><i class="material-icons">delete</i></a>`}
    ],
    drawCallback: ()=> actualizarTotales(rows)
  });

  // click en "detalle" -> ir al mapa y enfocar
  table.on('click','a[data-id]', (e)=>{
    const id = e.currentTarget.getAttribute('data-id');
    focusEnCentro(id);
    const tabs = M.Tabs.getInstance(document.getElementById('tabs'));
    tabs.select('tab-mapa');
  });

  // Sidebar listado
  renderSidebar(rows);
}

function actualizarTotales(rows){
  const sum = (k)=> rows.reduce((a,b)=> a + Number(b[k]||0), 0);
  $('#totalHect').text(fmtNum(sum('hectareas'),2));
  $('#totalLineas').text(fmtNum(sum('lineas'),0));
  $('#totalTons').text(fmtNum(sum('tons'),0));
  $('#totalUnKg').text(fmtNum(sum('unkg'),0));
  $('#totalRechazo').text(fmtNum(sum('rechazo')/Math.max(rows.length,1),1)+'%');
  $('#totalRdmto').text(fmtNum(sum('rdmto')/Math.max(rows.length,1),1)+'%');
}

function renderKPIs(rows){
  const sum = (k)=> rows.reduce((a,b)=> a + Number(b[k]||0), 0);
  const chips = [
    {icon:'terrain', label:'Hectáreas', v: fmtNum(sum('hectareas'),2)},
    {icon:'linear_scale', label:'Líneas', v: fmtNum(sum('lineas'),0)},
    {icon:'local_shipping', label:'Tons', v: fmtNum(sum('tons'),0)},
  ];
  const wrap = document.getElementById('kpiChips');
  wrap.innerHTML = chips.map(c=>`<span class="chip"><i class="material-icons">${c.icon}</i>${c.label}: <b>${c.v}</b></span>`).join('');
}

// ---- Sidebar ----
function renderSidebar(rows){
  const ul = document.getElementById('listaCentrosSidebar');
  const toLI = (r)=> `<li data-id="${r.id}"><div><b>${r.proveedor}</b><div class="mini">${r.comuna} · ${r.codigo}</div></div></li>`;
  ul.innerHTML = rows.slice(0,400).map(toLI).join(''); // recorta para performance
  const input = document.getElementById('filtroSidebar');
  input.oninput = (e)=>{
    const q = e.target.value.trim().toLowerCase();
    const filtered = q ? rows.filter(r => (r.proveedor||'').toLowerCase().includes(q) || (r.comuna||'').toLowerCase().includes(q)) : rows;
    ul.innerHTML = filtered.slice(0,400).map(toLI).join('');
  };
  document.getElementById('toggleSidebar').onclick = ()=>{
    document.getElementById('sidebarCentros').classList.toggle('collapsed');
  };
}

// ---- utils ----
function fmtNum(n, d=0){
  n = Number.isFinite(n) ? n : 0;
  return n.toLocaleString('es-CL',{minimumFractionDigits:d, maximumFractionDigits:d});
}
