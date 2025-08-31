// js/abastecimiento/asignacion/asignacion.js
import { fmt, altoDisponible /*, etiquetaMes */ } from './utilidades.js';
import * as estado from './estado.js';
import * as api from './api.js';

let tabla = null;

/* === Mes label SIN usar Date (evita desfases/TZ) === */
const MES_TXT = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
function etiquetaMesKey(k){
  if (!k || typeof k !== 'string') return '(vacío)';
  const p = k.split('-'); if (p.length<2) return k;
  const y = p[0]; const m = Math.max(1, Math.min(12, parseInt(p[1],10)||0));
  return `${MES_TXT[m-1]} ${y}`;
}

/* === Helpers de altura robusta (si el tab está oculto) === */
function alturaAsignacion(){
  const host = document.getElementById('asiTable');
  if (!host) return 480;
  let h = altoDisponible(host);
  if (!h || h < 160) h = Math.max(420, host.clientHeight || host.parentElement?.clientHeight || 420);
  return h;
}

/* === KPIs (usa data activa) === */
function kpis(){
  const rows = tabla ? tabla.getData('active') : [];
  const t = rows.reduce((s,x)=>s+(+x.Tons||0),0);
  const elFil = document.getElementById('asiKpiFilas');
  const elTons= document.getElementById('asiKpiTons');
  const elCam = document.getElementById('asiKpiCam');
  if (elFil) elFil.textContent = rows.length.toLocaleString('es-CL');
  if (elTons) elTons.textContent = fmt(t);
  if (elCam) elCam.textContent  = fmt(t/10);
}

/* === Toolbar (buscador + agrupadores) === */
function construirToolbar(){
  const wrap = document.getElementById('asiToolbar');
  if (!wrap) return;

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
      const q = ($q.value||'').toLowerCase();
      if (!tabla) return;
      tabla.clearFilter(true);
      if(q){
        tabla.setFilter([
          {field:'MesLabel', type:'like', value:q},
          {field:'Proveedor', type:'like', value:q},
          {field:'Comuna', type:'like', value:q},
          {field:'Centro', type:'like', value:q},
          {field:'Área', type:'like', value:q},
          {field:'Fuente', type:'like', value:q},
        ], 'or');
      }
      kpis();
    });
  }

  // Agrupar (se aplicará sólo si la tabla ya existe)
  wrap.querySelector('#asi_grp1')?.addEventListener('change', agrupar);
  wrap.querySelector('#asi_grp2')?.addEventListener('change', agrupar);
}

function agrupar(){
  if (!tabla) return;
  const g1 = document.getElementById('asi_grp1')?.value || '';
  const g2 = document.getElementById('asi_grp2')?.value || '';
  if (g1 && g2) tabla.setGroupBy([g1, g2]);
  else if (g1)  tabla.setGroupBy([g1]);
  else          tabla.setGroupBy([]);
}

/* === Panel derecho (saldo + selección + asignar) === */
function panelDerecho(){
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
    if (!tabla) return;
    const sel = tabla.getSelectedData();
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

    if (!tabla) return M.toast({html:'Tabla no lista', classes:'red'});
    const sel = tabla.getSelectedData();
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

/* === Tabla principal de “ofertas” con enriquecido === */
function construirTabla(){
  const base = estado.filasEnriquecidas({tipo:'ALL'});
  const rows = base.map(r => ({
    Mes: r.Mes,
    MesLabel: etiquetaMesKey(r.Mes), // <- seguro sin Date
    Proveedor: r.Proveedor,
    Comuna: r.Comuna,
    Centro: r.Centro,
    Área: r.Área,
    Tons: +r.Tons||0,
    Trucks: (+r.Tons||0)/10,
    Fuente: r.Fuente || ''
  }));

  const h = alturaAsignacion();

  if (tabla){
    try{
      tabla.updateOrReplaceData(rows);
      tabla.setHeight(h + 'px');
    }catch(e){
      // Si falla por estado interno, reconstruimos limpio
      try{ tabla.destroy(); }catch{}
      tabla = null;
    }
  }

  if (!tabla){
    const el = document.getElementById('asiTable');
    if (!el) return;

    // Render diferido para asegurar layout medido
    requestAnimationFrame(() => {
      tabla = new Tabulator(el, {
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
        dataLoaded:kpis,
        dataFiltered:kpis,
        rowSelectionChanged: ()=>{
          const sel = tabla.getSelectedData();
          const total = sel.reduce((s,x)=>s+(+x.Tons||0),0);
          const p = document.getElementById('selResumen');
          if (p) p.textContent = `${sel.length} filas · ${fmt(total)} t (${fmt(total/10)} cam)`;
        },
      });

      // aplicar agrupación sólo cuando la tabla esté lista
      tabla.on('tableBuilt', () => agrupar());

      // exponer para exportes
      window.getTablaAsignacion = () => tabla;
    });
  }

  kpis();
}

/* === Bootstrap del tab === */
export function montar(){
  construirToolbar();
  panelDerecho();
  construirTabla();

  window.addEventListener('resize', ()=>{
    if (!tabla) return;
    const h = alturaAsignacion();
    tabla.setHeight(h + 'px');
  });

  estado.on('actualizado', construirTabla);
}
