// js/abastecimiento/asignacion/programa_semanal.js
import { fmt, altoDisponible, fechasDeSemanaISO, aToneladas } from './utilidades.js';
import * as estado from './estado.js';
import * as api from './api.js';

let tabla = null, weekKeyActual = null, fechasSemana = [];
let activeDate = null; // día “target” para el Catálogo

/* ========== helpers de altura ========== */
function alturaTabla(){
  const host = document.getElementById('progMain');
  if (!host) return 480;
  let h = altoDisponible(host);
  if (!h || h < 160) h = Math.max(420, host.clientHeight || host.parentElement?.clientHeight || 420);
  return h;
}

/* ========== montar layout (grid: catálogo + tabla) ========== */
function ensureLayout(){
  const tab = document.getElementById('tabPrograma');
  if (!tab || document.getElementById('progGrid')) return;

  // Grid de dos columnas
  const grid = document.createElement('div');
  grid.id = 'progGrid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '350px 1fr';
  grid.style.gap = '12px';

  // Catálogo (izquierda)
  const cat = document.createElement('div');
  cat.id = 'progCatalog';
  cat.innerHTML = `
    <div class="card-soft" style="padding:12px">
      <h6 style="margin:0 0 8px">Catálogo (oferta del mes)</h6>
      <div class="row" style="margin:0">
        <div class="input-field col s12">
          <input id="cat_mes" type="month" />
          <label class="active" for="cat_mes">Mes</label>
        </div>
        <div class="input-field col s12">
          <select id="cat_tipo">
            <option value="ALL" selected>Todos</option>
            <option value="NORMAL">Normal</option>
            <option value="BAP">BAP</option>
          </select>
          <label>Tipo</label>
        </div>
        <div class="input-field col s12">
          <input id="cat_buscar" type="text" placeholder="Buscar proveedor, comuna…" />
          <label class="active" for="cat_buscar">Buscar</label>
        </div>
        <div class="input-field col s12">
          <input id="cat_fecha" type="date" />
          <label class="active" for="cat_fecha">Fecha destino</label>
        </div>
      </div>
      <div id="catSaldo" class="grey-text" style="margin:8px 0 6px"></div>
      <div id="catList" style="max-height:60vh; overflow:auto"></div>
    </div>
  `;

  // Derecha: toolbar + tabla ya existentes
  const rightWrap = document.createElement('div');
  rightWrap.id = 'progMain';
  rightWrap.appendChild(document.getElementById('progToolbar').parentElement);
  rightWrap.appendChild(document.getElementById('progTableWrap'));
  rightWrap.appendChild(document.getElementById('progNote'));

  grid.appendChild(cat);
  grid.appendChild(rightWrap);

  // Inserta antes del primer card de tabPrograma
  tab.innerHTML = ''; // limpia el contenido antiguo
  tab.appendChild(grid);

  try { M.FormSelect.init(cat.querySelectorAll('select')); } catch {}
}

/* ========== toolbar (derecha) ========== */
function construirToolbar(){
  const wrap = document.getElementById('progToolbar');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="input-field"><input id="prog_semana" type="week"><label class="active" for="prog_semana">Semana (ISO)</label></div>
    <div class="input-field">
      <select id="prog_unidad">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>
    <div class="input-field">
      <select id="prog_tipo">
        <option value="ALL" selected>Todos</option>
        <option value="NORMAL">Normal</option>
        <option value="BAP">BAP</option>
      </select>
      <label>Tipo MMPP</label>
    </div>
    <div class="right-actions" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
      <a class="btn teal" id="prog_noop"><i class="material-icons left">event_busy</i>No operación…</a>
      <a class="btn grey darken-2" id="prog_csv"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="prog_xlsx"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;
  try { M.FormSelect.init(wrap.querySelectorAll('select')); } catch {}

  // Semana ISO por defecto
  const now = new Date();
  const y = now.getFullYear();
  const jan1 = new Date(y,0,1);
  const d = Math.ceil((((now - jan1) / 86400000) + jan1.getDay()+1)/7);
  wrap.querySelector('#prog_semana').value = `${y}-W${String(d).padStart(2,'0')}`;

  wrap.querySelector('#prog_csv').addEventListener('click', ()=>{ if(tabla) tabla.download('csv','programa_semanal.csv'); });
  wrap.querySelector('#prog_xlsx').addEventListener('click', ()=>{ if(tabla) tabla.download('xlsx','programa_semanal.xlsx',{sheetName:'Programa'}); });
  wrap.querySelector('#prog_noop').addEventListener('click', ()=>{
    const modal=document.getElementById('modalNoOp');
    (M.Modal.getInstance(modal)||M.Modal.init(modal)).open();
    document.getElementById('noop_fecha').value = activeDate || (fechasSemana[0]||'');
    try { M.FormSelect.init(document.querySelectorAll('#modalNoOp select')); } catch {}
    try { M.updateTextFields(); } catch {}
  });

  wrap.querySelector('#prog_semana').addEventListener('change', cargarSemana);
  wrap.querySelector('#prog_unidad').addEventListener('change', renderTabla);
  wrap.querySelector('#prog_tipo').addEventListener('change', ()=>{ renderTabla(); refreshCatalog(); });
}

/* ========== Cargar semana ========== */
async function cargarSemana(){
  const weekInput = document.getElementById('prog_semana').value;
  if(!weekInput) return;
  weekKeyActual = weekInput.replace('W','-'); // YYYY-WW
  fechasSemana = fechasDeSemanaISO(weekKeyActual);
  activeDate = fechasSemana[0];

  // Ajusta Mes y Fecha destino del catálogo a la semana seleccionada
  const mesKey = fechasSemana[0]?.slice(0,7) || new Date().toISOString().slice(0,7);
  const $catMes = document.getElementById('cat_mes');
  const $catFecha = document.getElementById('cat_fecha');
  if ($catMes) $catMes.value = mesKey;
  if ($catFecha) $catFecha.value = activeDate;

  await estado.cargarProgramaSemana(api, weekKeyActual, fechasSemana); // stub ≈ [], no rompe
  renderTabla();
  refreshCatalog();
}

/* ========== Tabla de programa por semana ========== */
function renderTabla(){
  if(!fechasSemana.length) return;
  const unidad = document.getElementById('prog_unidad').value || 'tons';
  const tipo   = document.getElementById('prog_tipo').value || 'ALL';

  const dayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const cols = [{ title:'Proveedor', field:'Proveedor', width:260 }];

  fechasSemana.forEach((f, idx)=>{
    const noop = estado.esNoOperacion(f);
    cols.push({
      title: `${dayNames[idx]} ${f.slice(5)}${noop?` <span class="badge-noop">${noop.status==='HOLIDAY'?'Feriado':'No operación'}</span>`:''}`,
      field: `d${idx}`,
      hozAlign:'right', headerHozAlign:'right', formatter:(c)=>fmt(c.getValue()||0), cssClass: noop ? 'col-noop' : '',
      headerClick: ()=>{ activeDate = f; const $catFecha = document.getElementById('cat_fecha'); if ($catFecha) $catFecha.value = f; },
      cellClick:(e,cell)=>{
        activeDate = f;
        const noop = estado.esNoOperacion(f);
        if (noop) return M.toast({html:`Día bloqueado (${noop.reason||'sin motivo'})`, classes:'orange'});

        // abre modal para agregar/editar entrada rápida
        const modal=document.getElementById('modalProgramar'); (M.Modal.getInstance(modal)||M.Modal.init(modal)).open();
        document.getElementById('prog_fecha').value=f;
        document.getElementById('prog_camiones').value=''; document.getElementById('prog_tons').value=''; document.getElementById('prog_notas').value='';
        document.getElementById('prog_proveedor').value = cell.getRow().getData().Proveedor || '';
        document.getElementById('prog_comuna').value = '';
        try { M.FormSelect.init(document.querySelectorAll('#modalProgramar select')); } catch {}
        try { M.updateTextFields(); } catch {}
      }
    });
  });
  cols.push({ title:'Total', field:'total', hozAlign:'right', headerHozAlign:'right', formatter:(c)=>fmt(c.getValue()||0), width:110 });

  // Agregación por proveedor
  const porProv = new Map();
  const entries = estado.datos.programaSemana.filter(e=> tipo==='ALL' ? true : (e.tipo||'NORMAL').toUpperCase()===tipo);

  for (const e of entries){
    const key = e.proveedorNombre || '(sin proveedor)';
    if (!porProv.has(key)) porProv.set(key, {Proveedor:key, total:0});
    const row = porProv.get(key);
    const idx = fechasSemana.indexOf(e.fecha);
    if (idx >= 0){
      const value = (unidad==='trucks') ? e.camiones : e.tons;
      row[`d${idx}`] = (row[`d${idx}`]||0) + (Number(value)||0);
      row.total      = (row.total||0) + (Number(value)||0);
    }
  }

  const data = [...porProv.values()].sort((a,b)=>String(a.Proveedor).localeCompare(String(b.Proveedor)));
  const h = alturaTabla();

  if (tabla){
    try{
      tabla.setColumns(cols);
      tabla.replaceData(data);
      tabla.setHeight(h + 'px');
    }catch(e){
      try{ tabla.destroy(); }catch{}
      tabla = null;
    }
  }
  if (!tabla){
    requestAnimationFrame(()=>{
      tabla = new Tabulator('#progTable', {
        data,
        columns: cols,
        height: h + 'px',
        layout: 'fitColumns',
        columnMinWidth: 110,
        movableColumns: true,
      });
      window.getTablaPrograma = () => tabla;
    });
  }

  const resumenDias = fechasSemana.map(f=>{ const st=estado.esNoOperacion(f); return st?`${f} (${st.status})`:''; }).filter(Boolean).join(' · ');
  document.getElementById('progNote').textContent = `Semana ${weekKeyActual} — ${fechasSemana[0]} a ${fechasSemana[6]}${resumenDias? ' — ' + resumenDias : ''}`;
}

/* ========== Catálogo (oferta por mes/tipo/proveedor) ========== */
function proveedorStatsDelMes(mesKey, tipo){
  // Usa las filas enriquecidas del estado (traen Asignado/Saldo por fila)
  const base = estado.filasEnriquecidas({ tipo: (tipo==='ALL'?'ALL':tipo) })
    .filter(r => r.Mes === mesKey);

  const porProv = new Map();
  for (const r of base){
    const k = r.Proveedor || '(sin proveedor)';
    if (!porProv.has(k)) porProv.set(k, { prov: k, disp:0, asig:0, saldo:0, comuna:r.Comuna||'', centro:r.Centro||'' });
    const o = porProv.get(k);
    o.disp  += Number(r.Tons)||0;
    o.asig  += Number(r.Asignado)||0;
    o.saldo += Number(r.Saldo)||0;
  }
  return [...porProv.values()].sort((a,b)=> a.prov.localeCompare(b.prov));
}

function refreshCatalog(){
  const mesKey = document.getElementById('cat_mes')?.value || fechasSemana[0]?.slice(0,7) || new Date().toISOString().slice(0,7);
  const tipo   = document.getElementById('cat_tipo')?.value || 'ALL';
  const q      = (document.getElementById('cat_buscar')?.value || '').toLowerCase();

  // Chips de saldo del mes
  const invPorTipo  = estado.totalesMesPorTipo();
  const asigPorTipo = estado.asignadoMesPorTipo();
  const inv = (tipo==='ALL')
    ? [...invPorTipo.entries()].filter(([k])=>k.startsWith(`${mesKey}|`)).reduce((s,[,v])=>s+v,0)
    : (invPorTipo.get(`${mesKey}|${tipo}`)||0);
  const asig = (tipo==='ALL')
    ? (estado.datos.asignadoPorMes.get(mesKey)||0)
    : (asigPorTipo.get(`${mesKey}|${tipo}`)||0);
  const saldo = inv - asig;
  const $saldo = document.getElementById('catSaldo');
  if ($saldo) $saldo.textContent = `Mes ${mesKey} — Disp: ${fmt(inv)} t · Asig: ${fmt(asig)} t · Saldo: ${fmt(saldo)} t`;

  // Lista por proveedor
  const list = proveedorStatsDelMes(mesKey, tipo)
    .filter(r => r.prov.toLowerCase().includes(q) || r.comuna.toLowerCase().includes(q));

  const host = document.getElementById('catList');
  if (!host) return;
  host.innerHTML = '';

  if (list.length === 0){
    host.innerHTML = `<p class="grey-text" style="margin:8px 4px">Sin resultados</p>`;
    return;
  }

  for (const r of list){
    const card = document.createElement('div');
    card.className = 'card-soft';
    card.style.padding = '10px';
    card.style.marginBottom = '8px';
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px">
        <div style="flex:1 1 auto">
          <div style="font-weight:600">${r.prov}</div>
          <div class="grey-text" style="font-size:12px">${r.comuna || ''}</div>
          <div class="grey-text" style="font-size:12px">Disp: <b>${fmt(r.disp)}</b> · Asig: <b>${fmt(r.asig)}</b> · Saldo: <b>${fmt(r.saldo)}</b> t</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center">
          <input type="number" min="0" step="0.01" placeholder="t" style="width:90px" data-prop="tons">
          <a class="btn teal" data-acc="add">Agregar</a>
        </div>
      </div>
    `;
    host.appendChild(card);

    const btn = card.querySelector('[data-acc="add"]');
    btn.addEventListener('click', ()=>{
      const tons = Number(card.querySelector('[data-prop="tons"]').value || 0);
      if (!tons || tons <= 0) return M.toast({html:'Ingresa toneladas', classes:'red'});

      const fecha = document.getElementById('cat_fecha')?.value || activeDate || fechasSemana[0];
      if (!fecha) return M.toast({html:'Elige una fecha válida', classes:'red'});

      // Validador por proveedor (saldo del proveedor en el mes)
      if (tons > r.saldo){
        return M.toast({html:`Excede saldo del proveedor (${fmt(r.saldo)} t)`, classes:'red'});
      }

      // Prellenar y abrir modal programar
      const modal=document.getElementById('modalProgramar');
      (M.Modal.getInstance(modal)||M.Modal.init(modal)).open();
      document.getElementById('prog_fecha').value = fecha;
      document.getElementById('prog_proveedor').value = r.prov;
      document.getElementById('prog_camiones').value = '';
      document.getElementById('prog_tons').value = tons;
      document.getElementById('prog_notas').value = '';
      // Tipo queda sincronizado con select de la derecha
      document.getElementById('prog_tipo').value = (document.getElementById('prog_tipo')?.value || 'NORMAL');
      try { M.FormSelect.init(document.querySelectorAll('#modalProgramar select')); } catch {}
      try { M.updateTextFields(); } catch {}
    });
  }
}

/* ========== Guardar entradas y no-op (con validadores) ========== */
async function guardarProgramaDesdeModal(){
  const fecha  = document.getElementById('prog_fecha')?.value;
  const tipo   = document.getElementById('prog_tipo')?.value || 'NORMAL';
  const prov   = (document.getElementById('prog_proveedor')?.value || '').trim();
  const comuna = (document.getElementById('prog_comuna')?.value || '').trim();
  let camiones = Number(document.getElementById('prog_camiones')?.value || 0);
  let tons     = Number(document.getElementById('prog_tons')?.value || 0);
  const notas  = document.getElementById('prog_notas')?.value || '';
  if(!fecha || !prov || (!camiones && !tons)) return M.toast({html:'Completa fecha, proveedor y cantidad', classes:'red'});
  if(!tons && camiones) tons = aToneladas(camiones);

  // Validador de saldo por mes
  const mesKey = fecha.slice(0,7);
  const saldoMes = estado.saldoMes({mesKey, tipo});
  if (tons > saldoMes) return M.toast({html:`Excede el saldo del mes (${fmt(saldoMes)} t)`, classes:'red'});

  // Validador por proveedor (saldo del proveedor en el mes)
  const provStats = proveedorStatsDelMes(mesKey, tipo).find(x => x.prov === prov);
  const saldoProv = provStats ? provStats.saldo : 0;
  if (tons > saldoProv) return M.toast({html:`Excede saldo del proveedor (${fmt(saldoProv)} t)`, classes:'red'});

  try{
    await api.guardarPrograma({fecha, proveedorNombre:prov, comuna, tipo, camiones, tons, notas, estado:'BORRADOR'});
    M.toast({html:'Programa guardado', classes:'teal'});
    const modal = document.getElementById('modalProgramar');
    try { M.Modal.getInstance(modal)?.close(); } catch {}
    await estado.cargarProgramaSemana(api, weekKeyActual, fechasSemana);
    renderTabla();
    refreshCatalog(); // se mueve el saldo del proveedor
  }catch(e){
    console.error(e);
    M.toast({html:'Error guardando programa', classes:'red'});
  }
}

async function guardarNoOpDesdeModal(){
  const date   = document.getElementById('noop_fecha')?.value;
  const status = document.getElementById('noop_estado')?.value;
  const reason = document.getElementById('noop_motivo')?.value || '';
  if(!date) return;
  try{
    await api.guardarEstadoDia({date, status, reason});
    M.toast({html:'Estado del día guardado', classes:'teal'});
    const modal = document.getElementById('modalNoOp');
    try { M.Modal.getInstance(modal)?.close(); } catch {}
    await estado.cargarProgramaSemana(api, weekKeyActual, fechasSemana);
    renderTabla();
  }catch(e){
    console.error(e);
    M.toast({html:'Error guardando estado de día', classes:'red'});
  }
}

/* ========== Boot ========== */
export async function montar(){
  ensureLayout();
  construirToolbar();

  // Catálogo: eventos
  document.getElementById('cat_mes').addEventListener('change', refreshCatalog);
  document.getElementById('cat_tipo').addEventListener('change', refreshCatalog);
  document.getElementById('cat_buscar').addEventListener('input', refreshCatalog);
  document.getElementById('cat_fecha').addEventListener('change', (e)=>{ activeDate = e.target.value; });

  try { M.Modal.init(document.querySelectorAll('.modal')); } catch {}
  await cargarSemana();

  window.addEventListener('resize', ()=>{ if(tabla) tabla.setHeight(alturaTabla() + 'px'); });

  // Eventos de botones del modal
  document.getElementById('btnGuardarPrograma').addEventListener('click', guardarProgramaDesdeModal);
  document.getElementById('btnGuardarNoOp').addEventListener('click', guardarNoOpDesdeModal);

  estado.on('actualizado-programa', ()=>{ renderTabla(); refreshCatalog(); });
}
