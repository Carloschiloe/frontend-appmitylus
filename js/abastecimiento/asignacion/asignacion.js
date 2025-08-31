// js/abastecimiento/asignacion/asignacion.js
import { fmt, altoDisponible /*, etiquetaMes */ } from './utilidades.js';
import * as estado from './estado.js';
import * as api from './api.js';

let tablaAsignar = null;              // tu tabla original (ofertas)
let tablaRevisar = null;              // nueva bandeja de asignaciones
let modoActual   = 'asignar';         // 'asignar' | 'revisar'

/* === Mes label SIN Date (evita TZ) === */
const MES_TXT = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
function etiquetaMesKey(k){
  if (!k || typeof k !== 'string') return '(vacío)';
  const p = k.split('-'); if (p.length<2) return k;
  const y = p[0]; const m = Math.max(1, Math.min(12, parseInt(p[1],10)||0));
  return `${MES_TXT[m-1]} ${y}`;
}

/* === Helpers de altura robusta === */
function altura(hostId){
  const host = document.getElementById(hostId);
  if (!host) return 480;
  let h = altoDisponible(host);
  if (!h || h < 160) h = Math.max(420, host.clientHeight || host.parentElement?.clientHeight || 420);
  return h;
}

/* =================================================================================
 *  MODO ASIGNAR (tu UI original)  ————————————————————————————————————————————————
 * ================================================================================= */
function kpisAsignar(){
  const rows = tablaAsignar ? tablaAsignar.getData('active') : [];
  const t = rows.reduce((s,x)=>s+(+x.Tons||0),0);
  const elFil = document.getElementById('asiKpiFilas');
  const elTons= document.getElementById('asiKpiTons');
  const elCam = document.getElementById('asiKpiCam');
  if (elFil) elFil.textContent = rows.length.toLocaleString('es-CL');
  if (elTons) elTons.textContent = fmt(t);
  if (elCam) elCam.textContent  = fmt(t/10);
}

function construirToolbarAsignar(){
  const wrap = document.getElementById('asiToolbar');
  if (!wrap) return;

  // toolbar existente (no la toco), pero si alguien cambió de modo, aseguro que exista
  if (!wrap.dataset.inicializado){
    wrap.dataset.inicializado = '1';

    wrap.innerHTML = `
      <div class="row" style="margin:0;align-items:flex-end">
        <div class="input-field col s12 m6">
          <i class="material-icons prefix">search</i>
          <input id="asi_buscar" type="text" placeholder="Buscar (mes, proveedor, comuna, centro...)" />
          <label for="asi_buscar">Buscar</label>
        </div>
        <div class="input-field col s6 m3">
          <select id="asi_grp1">
            <option value="MesLabel" selected>Mes</option>
            <option value="Comuna">Comuna</option>
            <option value="Proveedor">Proveedor</option>
          </select>
          <label>Agrupar por</label>
        </div>
        <div class="input-field col s6 m3">
          <select id="asi_grp2">
            <option value="">— Ninguno —</option>
            <option value="Comuna" selected>Comuna</option>
            <option value="Proveedor">Proveedor</option>
          </select>
          <label>Subgrupo</label>
        </div>
      </div>
    `;
    try { M.FormSelect.init(wrap.querySelectorAll('select')); } catch {}

    // Buscador
    const $q = wrap.querySelector('#asi_buscar');
    if ($q){
      $q.addEventListener('input', ()=>{
        if (modoActual!=='asignar' || !tablaAsignar) return;
        const q = ($q.value||'').toLowerCase();
        tablaAsignar.clearFilter(true);
        if(q){
          tablaAsignar.setFilter([
            {field:'MesLabel', type:'like', value:q},
            {field:'Proveedor', type:'like', value:q},
            {field:'Comuna', type:'like', value:q},
            {field:'Centro', type:'like', value:q},
            {field:'Área', type:'like', value:q},
            {field:'Fuente', type:'like', value:q},
          ], 'or');
        }
        kpisAsignar();
      });
    }

    wrap.querySelector('#asi_grp1')?.addEventListener('change', agruparAsignar);
    wrap.querySelector('#asi_grp2')?.addEventListener('change', agruparAsignar);
  }
}

function agruparAsignar(){
  if (!tablaAsignar) return;
  const g1 = document.getElementById('asi_grp1')?.value || '';
  const g2 = document.getElementById('asi_grp2')?.value || '';
  if (g1 && g2) tablaAsignar.setGroupBy([g1, g2]);
  else if (g1)  tablaAsignar.setGroupBy([g1]);
  else          tablaAsignar.setGroupBy([]);
}

/* —— Panel derecho (saldo + selección + asignar) ——— */
function panelDerechoAsignar(){
  const p = document.getElementById('asiPanel');
  if (!p) return;

  p.innerHTML = `
    <div class="card-soft" style="padding:12px;margin-bottom:12px">
      <div class="row" style="margin:0">
        <div class="input-field col s12">
          <input id="asig_mes" type="month"><label class="active" for="asig_mes">Mes a asignar</label>
        </div>
        <div class="input-field col s12">
          <select id="asig_tipo">
            <option value="NORMAL" selected>Normal</option>
            <option value="BAP">BAP</option>
          </select>
          <label>Tipo MMPP</label>
        </div>
      </div>
      <div class="kpi" style="grid-template-columns:repeat(1,1fr)">
        <div class="card-soft">
          <h6>Saldo del mes elegido</h6>
          <p><span id="kpiMesDisp">Disp: 0 t</span> · <span id="kpiMesAsig">Asig: 0 t</span> · <span id="kpiMesSaldo">Saldo: 0 t</span></p>
        </div>
      </div>
    </div>

    <div class="card-soft" style="padding:12px;margin-bottom:12px">
      <h6 style="margin:0 0 8px">Selección actual</h6>
      <p class="grey-text" id="selResumen">0 filas · 0,00 t (0 cam)</p>
      <div class="row" style="margin:0">
        <div class="input-field col s7">
          <input id="montoAsignar" type="number" min="0" step="0.01" />
          <label class="active" for="montoAsignar">Monto a asignar</label>
        </div>
        <div class="input-field col s5">
          <select id="unidadMonto">
            <option value="tons" selected>Toneladas</option>
            <option value="trucks">Camiones (10 t)</option>
          </select>
          <label>Unidad</label>
        </div>
      </div>
      <div class="row" style="margin:0;gap:8px">
        <a class="btn-flat teal-text" id="btnUsarSeleccion"><i class="material-icons left">done_all</i>Usar selección</a>
        <a class="btn-flat teal-text" id="btnUsarSaldo"><i class="material-icons left">equalizer</i>Usar saldo</a>
      </div>
    </div>

    <div class="card-soft" style="padding:12px">
      <a class="btn teal" id="btnAsignar"><i class="material-icons left">playlist_add</i>Asignar</a>
      <p class="grey-text" style="margin-top:8px">Se asigna <b>proporcional</b> a los proveedores seleccionados. (1 camión = 10 t)</p>
    </div>
  `;

  try { M.FormSelect.init(p.querySelectorAll('select')); } catch {}

  p.querySelector('#asig_mes').value = new Date().toISOString().slice(0,7);
  M.updateTextFields();

  const refreshSaldo = ()=>{
    const mesKey = p.querySelector('#asig_mes').value;
    const tipo   = p.querySelector('#asig_tipo').value;
    const invPorTipo  = estado.totalesMesPorTipo();
    const asigPorTipo = estado.asignadoMesPorTipo();

    const inv = (tipo==='ALL')
      ? [...invPorTipo.entries()].filter(([k])=>k.startsWith(`${mesKey}|`)).reduce((s,[,v])=>s+v,0)
      : (invPorTipo.get(`${mesKey}|${tipo}`)||0);

    const asig = (tipo==='ALL')
      ? (estado.datos.asignadoPorMes.get(mesKey)||0)
      : (asigPorTipo.get(`${mesKey}|${tipo}`)||0);

    const saldo = inv - asig;
    document.getElementById('kpiMesDisp').textContent  = `Disp: ${fmt(inv)} t`;
    document.getElementById('kpiMesAsig').textContent  = `Asig: ${fmt(asig)} t`;
    document.getElementById('kpiMesSaldo').textContent = `Saldo: ${fmt(saldo)} t`;
  };
  refreshSaldo();
  p.querySelector('#asig_mes')?.addEventListener('change', refreshSaldo);
  p.querySelector('#asig_tipo')?.addEventListener('change', refreshSaldo);

  p.querySelector('#btnUsarSeleccion')?.addEventListener('click', ()=>{
    if (!tablaAsignar) return;
    const sel = tablaAsignar.getSelectedData();
    const totalTons = sel.reduce((s,x)=>s+(+x.Tons||0),0);
    const unit = p.querySelector('#unidadMonto').value;
    p.querySelector('#montoAsignar').value = unit==='trucks'
      ? Math.round((totalTons/10)*100)/100
      : Math.round(totalTons*100)/100;
    M.updateTextFields();
  });

  p.querySelector('#btnUsarSaldo')?.addEventListener('click', ()=>{
    const mesKey = p.querySelector('#asig_mes').value;
    const tipo   = p.querySelector('#asig_tipo').value;
    const saldo  = estado.saldoMes({mesKey, tipo});
    const unit   = p.querySelector('#unidadMonto').value;
    p.querySelector('#montoAsignar').value = unit==='trucks'
      ? Math.max(0, Math.round((saldo/10)*100)/100)
      : Math.max(0, Math.round(saldo*100)/100);
    M.updateTextFields();
  });

  p.querySelector('#btnAsignar')?.addEventListener('click', async ()=>{
    const mesKey = p.querySelector('#asig_mes').value;
    const tipo   = p.querySelector('#asig_tipo').value;
    const unit   = p.querySelector('#unidadMonto').value;
    let monto = Number(p.querySelector('#montoAsignar').value||0);
    if(unit==='trucks') monto = monto*10;
    if(!mesKey || !monto || monto<=0){ return M.toast({html:'Completa mes y monto válido', classes:'red'}); }

    const saldo = estado.saldoMes({mesKey, tipo});
    const asignable = Math.max(0, Math.min(monto, saldo));
    if(asignable<=0) return M.toast({html:'No hay saldo disponible', classes:'red'});

    if (!tablaAsignar) return M.toast({html:'Tabla no lista', classes:'red'});
    const sel = tablaAsignar.getSelectedData();
    if(sel.length===0) return M.toast({html:'Selecciona filas', classes:'red'});

    const porProv = new Map();
    for(const r of sel){ porProv.set(r.Proveedor, (porProv.get(r.Proveedor)||0) + (+r.Tons||0)); }
    const totalSel = [...porProv.values()].reduce((s,n)=>s+n,0);
    if(totalSel<=0) return M.toast({html:'Selección sin toneladas', classes:'red'});

    const payload=[]; let acum=0; const provs=[...porProv.keys()];
    provs.forEach((prov,i)=>{
      let parte=asignable*(porProv.get(prov)/totalSel);
      parte = Math.round(parte*100)/100;
      if(i===provs.length-1) parte = Math.round((asignable-acum)*100)/100; else acum+=parte;
      if(parte>0) payload.push({mesKey, proveedorNombre:prov, tons:parte, tipo, fuente:'ui-asignacion'});
    });

    try{
      await Promise.all(payload.map(x=>api.crearAsignacion(x)));
      M.toast({html:'Asignación registrada', classes:'teal'});
      await estado.refrescar(api);
    }catch(e){
      console.error(e);
      M.toast({html:'Error guardando asignación', classes:'red'});
    }
  });
}

/* —— Tabla “ofertas” (fuente para asignar) ——— */
function construirTablaAsignar(){
  const base = estado.filasEnriquecidas({tipo:'ALL'});
  const rows = base.map(r => ({
    Mes: r.Mes,
    MesLabel: etiquetaMesKey(r.Mes),
    Proveedor: r.Proveedor,
    Comuna: r.Comuna,
    Centro: r.Centro,
    Área: r.Área,
    Tons: +r.Tons||0,
    Trucks: (+r.Tons||0)/10,
    Fuente: r.Fuente || ''
  }));

  const h = altura('asiTable');

  if (tablaAsignar){
    try{
      tablaAsignar.updateOrReplaceData(rows);
      tablaAsignar.setHeight(h + 'px');
    }catch(e){
      try{ tablaAsignar.destroy(); }catch{}
      tablaAsignar = null;
    }
  }

  if (!tablaAsignar){
    const el = document.getElementById('asiTable');
    if (!el) return;

    requestAnimationFrame(() => {
      tablaAsignar = new Tabulator(el, {
        data: rows,
        height: h + 'px',
        layout: 'fitColumns',
        columnMinWidth: 110,
        selectable: true,
        groupStartOpen: false,
        groupToggleElement: 'header',
        groupHeader:(value,count,data,group)=>{
          const total=data.reduce((s,r)=>s+(+r.Tons||0),0);
          const field=group.getField();
          const label=(field==='MesLabel') ? etiquetaMesKey(value) : value;
          return `<span><strong>${field}:</strong> ${label} <span class="grey-text">(${count} ítem)</span> — <strong>Total:</strong> ${fmt(total)} t</span>`;
        },
        columns:[
          {formatter:'rowSelection', title:'Sel', hozAlign:'center', width:60, headerSort:false, cellClick:(e,cell)=>cell.getRow().toggleSelect()},
          {title:'Mes', field:'MesLabel', width:120},
          {title:'Proveedor', field:'Proveedor'},
          {title:'Comuna', field:'Comuna'},
          {title:'Centro', field:'Centro'},
          {title:'Área', field:'Área'},
          {title:'Tons', field:'Tons', hozAlign:'right', headerHozAlign:'right', formatter:(c)=>fmt(c.getValue())},
          {title:'Camiones', field:'Trucks', hozAlign:'right', headerHozAlign:'right', formatter:(c)=>fmt(c.getValue())},
          {title:'Fuente', field:'Fuente', width:120},
        ],
        dataLoaded:kpisAsignar,
        dataFiltered:kpisAsignar,
        rowSelectionChanged: ()=>{
          const sel = tablaAsignar.getSelectedData();
          const total = sel.reduce((s,x)=>s+(+x.Tons||0),0);
          const p = document.getElementById('selResumen');
          if (p) p.textContent = `${sel.length} filas · ${fmt(total)} t (${fmt(total/10)} cam)`;
        },
      });

      tablaAsignar.on('tableBuilt', () => agruparAsignar());
      window.getTablaAsignacion = () => tablaAsignar;   // export botones
    });
  }

  kpisAsignar();
}

/* =================================================================================
 *  MODO REVISAR (NUEVO)  ————————————————————————————————————————————————————————
 * ================================================================================= */
function uiRevisarEnsure(){
  // crea contenedor si no existe
  let pane = document.getElementById('paneRevisar');
  if (!pane){
    pane = document.createElement('div');
    pane.id = 'paneRevisar';
    pane.style.display = 'none';
    document.querySelector('#tabAsignacion .assign-grid > div').after(pane);
  }

  // si ya está armado, salgo
  if (pane.dataset.ready) return;

  pane.innerHTML = `
    <div class="card-soft" style="padding:12px;margin-bottom:8px">
      <div class="row" style="margin:0;align-items:flex-end">
        <div class="input-field col s12 m4">
          <input id="rev_mes" type="month" />
          <label class="active" for="rev_mes">Mes</label>
        </div>
        <div class="input-field col s6 m3">
          <select id="rev_tipo">
            <option value="ALL" selected>Todos</option>
            <option value="NORMAL">Normal</option>
            <option value="BAP">BAP</option>
          </select>
          <label>Tipo</label>
        </div>
        <div class="input-field col s6 m3">
          <input id="rev_buscar" type="text" placeholder="Buscar proveedor, planta, comuna..." />
          <label class="active" for="rev_buscar">Buscar</label>
        </div>
        <div class="input-field col s12 m2">
          <a class="btn grey darken-2" id="rev_actualizar" style="width:100%">
            <i class="material-icons left" style="margin:0">refresh</i> Actualizar
          </a>
        </div>
      </div>
      <div class="row" style="margin:0">
        <div class="col s12">
          <span id="rev_saldo" class="badge" style="font-size:13px"></span>
        </div>
      </div>
    </div>

    <div id="asiRevisarWrap" class="card-soft">
      <div id="asiRevisarTable"></div>
    </div>
  `;

  try { M.FormSelect.init(pane.querySelectorAll('select')); } catch {}
  pane.querySelector('#rev_mes').value = new Date().toISOString().slice(0,7);

  pane.dataset.ready = '1';

  // eventos
  pane.querySelector('#rev_actualizar')?.addEventListener('click', cargarRevisar);
  pane.querySelector('#rev_tipo')?.addEventListener('change', cargarRevisar);
  pane.querySelector('#rev_mes')?.addEventListener('change', cargarRevisar);
  pane.querySelector('#rev_buscar')?.addEventListener('input', ()=>{
    if (!tablaRevisar) return;
    const q = (pane.querySelector('#rev_buscar').value || '').toLowerCase();
    tablaRevisar.setFilter((row)=>{
      const r = row.getData();
      const hay = (r.proveedorNombre||'').toLowerCase().includes(q)
               || (r.plantaNombre||'').toLowerCase().includes(q)
               || (r.comuna||'').toLowerCase().includes(q);
      return hay;
    });
  });
}

async function cargarRevisar(){
  const mesKey = document.getElementById('rev_mes')?.value || '';
  const tipo   = document.getElementById('rev_tipo')?.value || 'ALL';

  let items = [];
  try{ items = await api.getAsignacionesListado({ mesKey, q:'' }); }
  catch(e){ console.error(e); M.toast({html:'No se pudo cargar asignaciones', classes:'red'}); }

  // saldo chip
  const saldo = estado.saldoMes({ mesKey, tipo });
  const invPorTipo  = estado.totalesMesPorTipo();
  const asigPorTipo = estado.asignadoMesPorTipo();
  const inv = (tipo==='ALL')
      ? [...invPorTipo.entries()].filter(([k])=>k.startsWith(`${mesKey}|`)).reduce((s,[,v])=>s+v,0)
      : (invPorTipo.get(`${mesKey}|${tipo}`)||0);
  const asig = (tipo==='ALL')
      ? (estado.datos.asignadoPorMes.get(mesKey)||0)
      : (asigPorTipo.get(`${mesKey}|${tipo}`)||0);
  const $saldo = document.getElementById('rev_saldo');
  if ($saldo) $saldo.textContent = `Mes ${etiquetaMesKey(mesKey)} — Disp: ${fmt(inv)} t · Asig: ${fmt(asig)} t · Saldo: ${fmt(saldo)} t`;

  renderTablaRevisar(items, { mesKey, tipo });
}

function renderTablaRevisar(items, ctx){
  const cols = [
    { title:'Mes', field:'mesKey', width:110, formatter:c=>etiquetaMesKey(c.getValue()) },
    { title:'Proveedor', field:'proveedorNombre', width:240 },
    { title:'Tipo', field:'tipo', width:90 },
    { title:'Tons', field:'tonsAsignadas', hozAlign:'right', headerHozAlign:'right',
      editor:'number', editorParams:{ min:0, step:0.01 },
      cellEdited: async (cell)=>{
        const row = cell.getRow().getData();
        const prev = Number(cell.getOldValue()||0);
        const next = Number(cell.getValue()||0);
        if (Number.isNaN(next) || next<0){ cell.setValue(prev, true); return; }

        // validador de saldo: delta no puede exceder saldoMes actual
        const delta = next - prev;
        const saldo = estado.saldoMes({ mesKey: ctx.mesKey, tipo: row.tipo || 'NORMAL' });
        if (delta > saldo){
          M.toast({html:`Excede el saldo del mes por ${fmt(delta - saldo)} t`, classes:'red'});
          cell.setValue(prev, true);
          return;
        }

        try{
          await api.updateAsignacion(row._id, { tonsAsignadas: next });
          await estado.refrescar(api);
          M.toast({html:'Asignación actualizada', classes:'teal'});
          // refrescar chip de saldo
          cargarRevisar();
        }catch(e){
          console.error(e);
          M.toast({html:'No se pudo guardar', classes:'red'});
          cell.setValue(prev, true);
        }
      }
    },
    { title:'Estado', field:'estado', width:110 },
    { title:'Acciones', field:'_acc', width:210, headerSort:false, formatter:(c)=>{
        const d = c.getRow().getData();
        return `
          <a class="btn-flat teal-text" data-acc="dup">Duplicar</a>
          <a class="btn-flat" data-acc="prog">Programar</a>
          <a class="btn-flat red-text" data-acc="anular">Anular</a>
        `;
      },
      cellClick: async (e,cell)=>{
        const el = e.target.closest('[data-acc]');
        if (!el) return;
        const acc = el.dataset.acc;
        const row = cell.getRow().getData();

        if (acc === 'anular'){
          if (!confirm('¿Anular esta asignación?')) return;
          try{
            await api.anularAsignacion(row._id);
            await estado.refrescar(api);
            M.toast({html:'Asignación anulada', classes:'teal'});
            cargarRevisar();
          }catch(e){
            console.error(e);
            M.toast({html:'Error al anular', classes:'red'});
          }
        }

        if (acc === 'dup'){
          // Pre rellena panel derecho en modo Asignar con mismos datos
          const pane = document.getElementById('asiPanel');
          if (pane){
            const mesInput = pane.querySelector('#asig_mes');
            const tipoSel  = pane.querySelector('#asig_tipo');
            const montoInp = pane.querySelector('#montoAsignar');
            const unitSel  = pane.querySelector('#unidadMonto');

            if (mesInput) mesInput.value = row.mesKey;
            if (tipoSel){
              try{ tipoSel.value = (row.tipo||'NORMAL').toUpperCase(); M.FormSelect.init(tipoSel); }catch{}
            }
            if (unitSel) unitSel.value = 'tons';
            if (montoInp){ montoInp.value = row.tonsAsignadas; M.updateTextFields(); }

            // cambia a modo asignar y selecciona proveedor en la tabla si existe
            setMode('asignar');
            setTimeout(()=>{
              if (tablaAsignar){
                tablaAsignar.deselectRow();
                const r = tablaAsignar.searchRows('Proveedor', '=', row.proveedorNombre)[0];
                if (r) r.select();
              }
            }, 100);
          }
        }

        if (acc === 'prog'){
          M.toast({html:'Enlazaremos con Programa Semanal (pendiente)', classes:'orange'});
        }
      }
    }
  ];

  const h = altura('asiRevisarWrap');

  if (tablaRevisar){
    try{
      tablaRevisar.setColumns(cols);
      tablaRevisar.replaceData(items);
      tablaRevisar.setHeight(h + 'px');
    }catch(e){
      try{ tablaRevisar.destroy(); }catch{}
      tablaRevisar = null;
    }
  }
  if (!tablaRevisar){
    requestAnimationFrame(()=>{
      tablaRevisar = new Tabulator('#asiRevisarTable', {
        data: items,
        columns: cols,
        height: h + 'px',
        layout: 'fitColumns',
        columnMinWidth: 110,
        movableColumns: true,
      });
      window.getTablaAsignacionesRevisar = () => tablaRevisar;
    });
  }
}

/* =================================================================================
 *  MODO / BOOT ————————————————————————————————————————————————————————————————
 * ================================================================================= */
function ensureModeChips(){
  // Insertar chips si no existen
  let modeBar = document.getElementById('asiMode');
  if (!modeBar){
    modeBar = document.createElement('div');
    modeBar.id = 'asiMode';
    modeBar.className = 'chip-group';
    modeBar.style.cssText = 'display:flex;gap:8px;margin-bottom:8px';
    modeBar.innerHTML = `
      <a class="chip teal white-text" data-mode="asignar">Asignar</a>
      <a class="chip" data-mode="revisar">Revisar</a>
    `;
    const gridLeft = document.querySelector('#tabAsignacion .assign-grid > div');
    if (gridLeft) gridLeft.prepend(modeBar);
  }

  modeBar.querySelectorAll('.chip').forEach(c=>{
    c.onclick = ()=> setMode(c.dataset.mode);
  });
}

function setMode(m){
  modoActual = m;

  // chips activos
  document.querySelectorAll('#asiMode .chip').forEach(c=>{
    const active = (c.dataset.mode===m);
    c.classList.toggle('teal', active);
    c.classList.toggle('white-text', active);
  });

  // pane asignar = lo que ya tenías (toolbar+tabla+panel)
  const leftCol = document.querySelector('#tabAsignacion .assign-grid > div');
  const paneAsignar = leftCol; // contiene toolbar+tabla
  const paneRevisar = document.getElementById('paneRevisar');

  if (m==='asignar'){
    if (paneAsignar) paneAsignar.style.display = 'block';
    if (paneRevisar) paneRevisar.style.display = 'none';
    construirToolbarAsignar();
    panelDerechoAsignar();
    construirTablaAsignar();
  } else {
    if (paneAsignar) paneAsignar.style.display = 'none';
    uiRevisarEnsure();
    const pr = document.getElementById('paneRevisar');
    if (pr) pr.style.display = 'block';
    cargarRevisar();
  }
}

/* =================================================================================
 *  EXPORTS
 * ================================================================================= */
export function montar(){
  ensureModeChips();

  // Modo default
  setMode('asignar');

  // Resize
  window.addEventListener('resize', ()=>{
    if (modoActual==='asignar' && tablaAsignar) tablaAsignar.setHeight(altura('asiTable') + 'px');
    if (modoActual==='revisar' && tablaRevisar) tablaRevisar.setHeight(altura('asiRevisarWrap') + 'px');
  });

  // Cuando cambian los datos base (inventarios/asignado), refrescar vistas
  estado.on('actualizado', ()=>{
    if (modoActual==='asignar') construirTablaAsignar();
    if (modoActual==='revisar') cargarRevisar();
  });
}
